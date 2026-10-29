/**
 * Leiaute do DANFSe v2.0 (NT 008/2026, Anexo I) — port dos métodos de
 * desenho de `Danfse` (BrazilFiscalReport). Coordenadas em mm, mesma grade
 * de 4 colunas e mesmas alturas de linha do original.
 */
import path from 'path';
import QRCode from 'qrcode';
import { ellipsize } from './format';
import { ASSETS_DIR } from './municipios';
import type { DanfseData, DanfsePerson } from './parse';
import { Pdf, type FontFiles } from './pdf';
import {
  TXT_DEST_IS_TAKER,
  TXT_DEST_NOT_IDENTIFIED,
  TXT_INTERM_NOT_IDENTIFIED,
  TXT_NO_ISSQN,
  TXT_NO_LEGAL_VALIDITY,
  TXT_QR_CODE,
  TXT_TAKER_NOT_IDENTIFIED,
} from './tables';

/** Espessuras de linha da NT 008/2026, item 2.2.3 (0,5 pt e 1 pt, em mm). */
const LINE_DIVIDER = 0.176;
const LINE_BORDER = 0.353;
/** Cinza claro, ~5% de densidade. */
const SHADE_GRAY = 242;
/** Altura padrão das linhas de campos. */
const ROW_H = 6.4;
/** Altura das linhas de supressão (mín. 0,32 cm). */
const STRIP_H = 3.4;

export interface RenderOptions {
  /** Margens em mm (NT 008/2026, item 2.2.2: entre 1,5 e 2 mm). */
  margins: { top: number; right: number; bottom: number; left: number };
  /** Fonte padrão do PDF; Helvetica é o equivalente métrico da Arial exigida pela NT. */
  fontType: 'Helvetica' | 'Times' | 'Courier';
  /** TTFs próprios, no lugar das fontes padrão do PDF. */
  fonts?: FontFiles;
  watermarkCancelled: boolean;
  watermarkReplaced: boolean;
  displayCanhoto: boolean;
  /** Logomarca do cabeçalho; `false` não imprime. */
  logo: string | Buffer | false;
  creationDate?: Date;
}

class DanfseRenderer {
  private readonly pdf: Pdf;
  private readonly font: string;
  private readonly bx: number;
  private readonly bw: number;
  private readonly colw: number;

  constructor(
    private readonly data: DanfseData,
    private readonly opts: RenderOptions
  ) {
    this.pdf = new Pdf({ title: 'DANFSE', creationDate: opts.creationDate, fonts: opts.fonts });
    const m = opts.margins;
    this.pdf.setMargins(m.left, m.top, m.right, m.bottom);
    this.font = opts.fontType;
    // Grade do leiaute: blocos com 1 mm de folga em relação à moldura.
    this.bx = this.pdf.lMargin + 1;
    this.bw = this.pdf.epw - 2;
    this.colw = this.bw / 4;
  }

  async render(): Promise<Buffer> {
    const pdf = this.pdf;
    this.drawHeader();
    await this.drawIdentification();
    this.drawProvider();
    this.drawTaker();
    this.drawDest();
    this.drawIntermediary();
    this.drawService();
    this.drawMunicipalTaxes();
    this.drawFederalTaxes();
    this.drawIbscbsTaxes();
    this.drawTotals();
    this.drawComplementaryInfo();
    this.drawCanhoto();

    pdf.setLineWidth(LINE_BORDER);
    pdf.rect(pdf.lMargin, pdf.tMargin, pdf.epw, pdf.eph);
    pdf.setLineWidth(LINE_DIVIDER);

    // Por último, acima dos quadros sombreados; a transparência preserva a
    // leitura do conteúdo sob a marca d'água.
    this.drawWatermark();
    return pdf.output();
  }

  // ── primitivas ────────────────────────────────────────────────────────────

  private col(index: number) {
    return this.bx + index * this.colw;
  }

  private hline(y: number) {
    this.pdf.setLineWidth(LINE_DIVIDER);
    this.pdf.line(this.bx, y, this.bx + this.bw, y);
  }

  private shade(x: number, y: number, w: number, h: number) {
    // Pequeno recuo no topo para não cobrir a linha divisória do bloco
    // anterior (desenhada centrada em y).
    this.pdf.setFillColor(SHADE_GRAY, SHADE_GRAY, SHADE_GRAY);
    this.pdf.rect(x, y + 0.15, w, h - 0.15, 'F');
  }

  private blockTitle(y: number, text: string) {
    this.shade(this.col(0), y, this.colw, ROW_H);
    this.pdf.setFont(this.font, 'B', 7);
    this.pdf.setXY(this.col(0) + 0.8, y);
    this.pdf.cell(this.colw - 1.6, ROW_H, text, 'L');
  }

  private titleStrip(text: string) {
    // Sem sombreamento: o modelo do Anexo I exibe o título de INFORMAÇÕES
    // COMPLEMENTARES sem fundo.
    const y = this.pdf.y;
    const h = STRIP_H + 0.5;
    this.pdf.setFont(this.font, 'B', 7);
    this.pdf.setXY(this.bx + 0.8, y);
    this.pdf.cell(this.bw - 1.6, h, text, 'L');
    this.pdf.setY(y + h);
  }

  private field(col: number, span: number, y: number, label: string, value: string, shaded = false) {
    const pdf = this.pdf;
    const x = this.col(col);
    const w = span * this.colw;
    if (shaded) this.shade(x, y, w, ROW_H);
    pdf.setFont(this.font, 'B', 6);
    pdf.setXY(x + 0.8, y + 0.5);
    pdf.cell(w - 1.6, 2.2, pdf.longField(label, w - 1.6), 'L');
    pdf.setFont(this.font, '', 7);
    pdf.setXY(x + 0.8, y + 3.0);
    pdf.cell(w - 1.6, 2.6, pdf.longField(value || '-', w - 1.6), 'L');
  }

  private strip(text: string) {
    const y = this.pdf.y;
    this.pdf.setFont(this.font, 'B', 7);
    this.pdf.setXY(this.bx, y);
    this.pdf.cell(this.bw, STRIP_H, text, 'C');
    this.pdf.setY(y + STRIP_H);
    this.hline(this.pdf.y);
  }

  private personRows(title: string, person: DanfsePerson, inscricao = true) {
    let y = this.pdf.y;
    this.blockTitle(y, title);
    this.field(1, 1, y, 'CNPJ / CPF / NIF', person.id);
    if (inscricao) this.field(2, 1, y, 'Indicador Municipal (Inscrição)', person.municipalRegistration ?? '-');
    this.field(3, 1, y, 'Telefone', person.phone);
    y += ROW_H;
    this.field(0, 2, y, 'Nome / Nome Empresarial', person.name);
    this.field(2, 1, y, 'Município / Sigla UF', person.city);
    this.field(3, 1, y, 'Código IBGE / CEP', person.ibgeCep);
    y += ROW_H;
    this.field(0, 2, y, 'Endereço', person.address);
    this.field(2, 2, y, 'E-mail', person.email);
    y += ROW_H;
    this.pdf.setY(y);
    this.hline(y);
  }

  // ── blocos ────────────────────────────────────────────────────────────────

  private drawWatermark() {
    let text: string;
    if (this.opts.watermarkCancelled) text = 'CANCELADA';
    else if (this.opts.watermarkReplaced) text = 'SUBSTITUÍDA';
    else return;
    // NT 008/2026, §2.5: diagonal, formato normal, mínimo 50 pt, Arial
    // (Helvetica como equivalente métrico), cinza K35 — preto a 35% de
    // opacidade, que sobre o papel equivale ao K35 e mantém o conteúdo
    // legível sob a marca d'água.
    const fontSize = 60;
    const pdf = this.pdf;
    pdf.setFont('Helvetica', '', fontSize);
    const width = pdf.stringWidth(text);
    const height = fontSize * 0.25;
    const xCenter = (pdf.w - width) / 2;
    const yCenter = (pdf.h + height) / 2;
    pdf.rotatedText(55, xCenter + width / 2, yCenter - height / 2, xCenter, yCenter, text, 0.35);
  }

  private drawHeader() {
    const pdf = this.pdf;
    const y0 = pdf.tMargin + 1;
    const bandH = 11.6;
    this.shade(this.bx, y0, this.bw, bandH);

    if (this.opts.logo !== false) pdf.image(this.opts.logo, this.bx + 2, y0 + 1.8, 8);

    pdf.setFont(this.font, 'B', 9);
    pdf.setXY(this.col(1), y0 + 1.6);
    pdf.multiCell(this.colw * 2, 3.6, 'DANFSe v2.0\nDocumento Auxiliar da NFS-e', 'C');
    if (this.data.environment === '2') {
      pdf.setFont(this.font, 'B', 9);
      pdf.setTextColor(255, 0, 0);
      pdf.setXY(this.col(1), y0 + 8.8);
      pdf.cell(this.colw * 2, 2.6, TXT_NO_LEGAL_VALIDITY, 'C');
      pdf.setTextColor(0, 0, 0);
    }

    const header = this.data.header;
    const xRight = this.col(3) + 0.8;
    const wRight = this.colw - 1.6;
    if (header.city) {
      pdf.setFont(this.font, '', 8);
      pdf.setXY(xRight, y0 + 1.2);
      pdf.cell(wRight, 3, pdf.longField(`Município: ${header.city}`, wRight), 'L');
    }
    pdf.setFont(this.font, '', 6);
    pdf.setXY(xRight, y0 + 6.4);
    pdf.cell(wRight, 2.2, `Ambiente Gerador: ${header.ambGer}`, 'L');
    pdf.setXY(xRight, y0 + 9.0);
    pdf.cell(wRight, 2.2, `Tipo de Ambiente: ${header.tpAmb}`, 'L');

    pdf.setY(y0 + bandH);
    this.hline(pdf.y);
  }

  private idField(col: number, y: number, label: string, value: string, shaded = false) {
    const pdf = this.pdf;
    const x = this.col(col);
    const w = this.colw;
    if (shaded) this.shade(x, y, w, 6.9);
    pdf.setFont(this.font, 'B', 7);
    pdf.setXY(x + 0.8, y + 0.6);
    pdf.cell(w - 1.6, 2.4, pdf.longField(label, w - 1.6), 'L');
    pdf.setFont(this.font, '', 7);
    pdf.setXY(x + 0.8, y + 3.6);
    pdf.cell(w - 1.6, 2.8, pdf.longField(value || '-', w - 1.6), 'L');
  }

  private async drawIdentification() {
    const pdf = this.pdf;
    const data = this.data;
    const y0 = pdf.y;

    // Chave de acesso (linha de largura ampla)
    pdf.setFont(this.font, 'B', 7);
    pdf.setXY(this.bx + 0.8, y0 + 0.8);
    pdf.cell(this.colw * 3, 2.4, 'CHAVE DE ACESSO DA NFS-e', 'L');
    pdf.setFont(this.font, '', 7);
    pdf.setXY(this.bx + 0.8, y0 + 3.8);
    pdf.cell(this.colw * 3, 2.8, data.keyNfse, 'L');

    let rowsY = y0 + 7.9;
    this.idField(0, rowsY, 'NÚMERO DA NFS-e', data.nfseNumber);
    this.idField(1, rowsY, 'COMPETÊNCIA DA NFS-e', data.competFmt);
    this.idField(2, rowsY, 'DATA E HORA DA EMISSÃO DA NFS-e', `${data.dtNfse} ${data.hrNfse}`.trim());
    rowsY += 6.9;
    this.idField(0, rowsY, 'NÚMERO DA DPS', data.dpsNumber);
    this.idField(1, rowsY, 'SÉRIE DA DPS', data.dpsSerie);
    this.idField(2, rowsY, 'DATA E HORA DA EMISSÃO DA DPS', `${data.dtDps} ${data.hrDps}`.trim());
    rowsY += 6.9;
    this.idField(0, rowsY, 'EMITENTE DA NFS-e', data.emitterType, true);
    this.idField(1, rowsY, 'SITUAÇÃO DA NFS-e', data.status);
    this.idField(2, rowsY, 'FINALIDADE', data.purpose);

    // QR Code (item 2.4.3: área útil mínima de 1,52 x 1,52 cm), na posição
    // fixa do §2.4.3 (X=17,48 / Y=1,67 cm para a área útil), independente das
    // margens. Desenhado em vetor, com 2 módulos de borda branca como o original.
    const url = `https://www.nfse.gov.br/ConsultaPublica/?tpc=1&chave=${data.keyNfse}`;
    const qr = QRCode.create(url, { errorCorrectionLevel: 'L' });
    const n = qr.modules.size;
    const border = 2;
    const side = 19;
    const moduleMm = side / (n + 2 * border);
    pdf.modules(
      n,
      (r, c) => !!qr.modules.get(r, c),
      172.87 + 1 + border * moduleMm,
      14.77 + 1 + border * moduleMm,
      n * moduleMm
    );
    pdf.setFont(this.font, '', 6);
    pdf.setXY(158, 34.3);
    pdf.multiCell(49, 2.1, TXT_QR_CODE, 'L');

    pdf.setY(rowsY + 6.9);
    this.hline(pdf.y);
  }

  private drawProvider() {
    const issuer = this.data.issuer;
    let y = this.pdf.y;
    this.blockTitle(y, 'PRESTADOR / FORNECEDOR');
    this.field(1, 1, y, 'CNPJ / CPF / NIF', issuer.id);
    this.field(2, 1, y, 'Indicador Municipal (Inscrição)', issuer.municipalRegistration);
    this.field(3, 1, y, 'Telefone', issuer.phone);
    y += ROW_H;
    this.field(0, 2, y, 'Nome / Nome Empresarial', issuer.name);
    this.field(2, 1, y, 'Município / Sigla UF', issuer.city);
    this.field(3, 1, y, 'Código IBGE / CEP', issuer.ibgeCep);
    y += ROW_H;
    this.field(0, 2, y, 'Endereço', issuer.address);
    this.field(2, 2, y, 'E-mail', issuer.email);
    y += ROW_H;
    this.field(0, 2, y, 'Simples Nacional na Data de Competência', issuer.simples);
    this.field(2, 2, y, 'Regime de Apuração Tributária pelo SN', issuer.taxRegim);
    y += ROW_H;
    this.pdf.setY(y);
    this.hline(y);
  }

  private drawTaker() {
    const taker = this.data.taker;
    if (!taker) return this.strip(TXT_TAKER_NOT_IDENTIFIED);
    this.personRows('TOMADOR / ADQUIRENTE', taker);
  }

  private drawDest() {
    const dest = this.data.dest;
    if (!dest) {
      // O grupo IBSCBS/dest só é informado quando o destinatário difere do
      // tomador (Notas 2 e 3 da NT 008/2026).
      return this.strip(this.data.taker ? TXT_DEST_IS_TAKER : TXT_DEST_NOT_IDENTIFIED);
    }
    this.personRows('DESTINATÁRIO DA OPERAÇÃO', dest, false);
  }

  private drawIntermediary() {
    const intermed = this.data.intermed;
    if (!intermed) return this.strip(TXT_INTERM_NOT_IDENTIFIED);
    this.personRows('INTERMEDIÁRIO DA OPERAÇÃO', intermed);
  }

  private drawService() {
    const pdf = this.pdf;
    const service = this.data.service;
    let y = pdf.y;
    this.blockTitle(y, 'SERVIÇO PRESTADO');
    this.field(1, 1, y, 'Código de Tributação Nacional / Municipal', service.taxCode);
    this.field(2, 1, y, 'Código da NBS', service.nbs);
    this.field(3, 1, y, 'Local da Prestação / Sigla UF / País', service.placeOfProvision);
    y += ROW_H;

    // Descrição do código de tributação (sem label, cf. tabela 2.4.5)
    pdf.setFont(this.font, '', 7);
    pdf.setXY(this.bx + 0.8, y + 0.5);
    pdf.cell(this.bw - 1.6, 2.8, pdf.longField(service.taxCodeDescription || '-', this.bw - 1.6), 'L');
    y += 3.8;

    pdf.setFont(this.font, 'B', 6);
    pdf.setXY(this.bx + 0.8, y + 0.5);
    pdf.cell(this.bw - 1.6, 2.2, 'Descrição do Serviço', 'L');

    // A descrição pode ter múltiplas linhas; limitar à altura disponível para
    // preservar a página única (NT 008/2026, §2.2).
    pdf.setFont(this.font, '', 7);
    let description = service.description;
    const available = pdf.tMargin + pdf.eph - this.reservedBelowService() - (y + 3.0);
    const maxLines = Math.max(Math.floor(available / 2.6), 1);
    const lines = pdf.wrap(this.bw - 1.6, description);
    if (lines.length > maxLines) {
      const kept = lines.slice(0, maxLines);
      const last = kept[kept.length - 1];
      kept[kept.length - 1] = `${last.slice(0, Math.max(last.length - 4, 0))}...`;
      description = kept.join('\n');
    }
    pdf.setXY(this.bx + 0.8, y + 3.0);
    pdf.multiCell(this.bw - 1.6, 2.6, description, 'L');
    y = Math.max(pdf.y, y + 5.6) + 0.6;
    pdf.setY(y);
    this.hline(y);
  }

  /** Altura mínima dos blocos abaixo de SERVIÇO PRESTADO. */
  private reservedBelowService() {
    let height = 0;
    height += this.data.municipalTaxes.suppressed ? STRIP_H : 4 * ROW_H;
    height += ROW_H; // tributação federal, linha 1
    if (this.data.federalTaxes.showPisCofins) height += ROW_H;
    height += 4 * ROW_H; // tributação IBS/CBS
    height += 2 * ROW_H; // valor total
    height += STRIP_H + 0.5 + 6.0; // inf. complementares (título + mínimo)
    if (this.opts.displayCanhoto) height += 6.9;
    return height + 1.0;
  }

  private drawMunicipalTaxes() {
    const taxes = this.data.municipalTaxes;
    if (taxes.suppressed) return this.strip(TXT_NO_ISSQN);
    let y = this.pdf.y;
    this.blockTitle(y, 'TRIBUTAÇÃO MUNICIPAL (ISSQN)');
    this.field(1, 1, y, 'Tipo de Tributação do ISSQN', taxes.issqnTax);
    this.field(2, 2, y, 'Município / Sigla UF / País da Incidência do ISSQN', taxes.city);
    y += ROW_H;
    this.field(0, 1, y, 'Regime Especial de Tributação do ISSQN', taxes.specialTaxRegim);
    this.field(1, 1, y, 'Tipo de Imunidade do ISSQN', taxes.immunityType);
    this.field(2, 1, y, 'Suspensão da Exigibilidade do ISSQN', taxes.suspensionIssqn);
    this.field(3, 1, y, 'Número Processo Suspensão', taxes.suspensionNumber);
    y += ROW_H;
    this.field(0, 1, y, 'Benefício Municipal', taxes.municipalBenefit);
    this.field(1, 1, y, 'Cálculo do BM', taxes.municipalBenefitMath);
    this.field(2, 1, y, 'Total Deduções/Reduções', taxes.deductReducAmount);
    this.field(3, 1, y, 'Desconto Incondicionado', taxes.discountUnconditioned);
    y += ROW_H;
    this.field(0, 1, y, 'BC ISSQN', taxes.calculationBasis);
    this.field(1, 1, y, 'Alíquota Aplicada', taxes.aliqApplied);
    this.field(2, 1, y, 'Retenção do ISSQN', taxes.issqnRetention);
    this.field(3, 1, y, 'ISSQN Apurado', taxes.issqnCleared);
    y += ROW_H;
    this.pdf.setY(y);
    this.hline(y);
  }

  private drawFederalTaxes() {
    const taxes = this.data.federalTaxes;
    let y = this.pdf.y;
    this.blockTitle(y, 'TRIBUTAÇÃO FEDERAL (EXCETO CBS)');
    this.field(1, 1, y, 'IRRF', taxes.irrf);
    this.field(2, 1, y, 'Contribuição Previdenciária - Retida', taxes.previdenciaryContribution);
    this.field(3, 1, y, 'Contribuições Sociais - Retidas', taxes.socialContribution);
    y += ROW_H;
    if (taxes.showPisCofins) {
      this.field(0, 1, y, 'PIS - Débito Apuração Própria', taxes.pisDebit);
      this.field(1, 1, y, 'COFINS - Débito Apuração Própria', taxes.cofinsDebit);
      this.field(2, 2, y, 'Descrição Contrib. Sociais - Retidas', taxes.socialDescription);
      y += ROW_H;
    }
    this.pdf.setY(y);
    this.hline(y);
  }

  private drawIbscbsTaxes() {
    const t = this.data.ibscbs;
    let y = this.pdf.y;
    this.blockTitle(y, 'TRIBUTAÇÃO IBS / CBS');
    this.field(1, 1, y, 'CST / CCLASSTRIB', t.cstCclasstrib);
    this.field(2, 2, y, 'Indicador de Operação / Código IBGE Incidência / Município Incidência / Sigla UF', t.indOp);
    y += ROW_H;
    this.field(0, 1, y, 'Exclusões e Reduções da Base de Cálculo', t.exclusions);
    this.field(1, 1, y, 'Base de Cálculo Após Exclusões e Reduções', t.bcAfter);
    this.field(2, 1, y, 'Red. Alíquota IBS / Red. Alíquota CBS', t.redAliq);
    this.field(3, 1, y, 'Alíquota - IBS UF / IBS Mun', t.aliqIbs);
    y += ROW_H;
    this.field(0, 1, y, 'Alíq. Efetiva Municipal - IBS', t.aliqEfetMun);
    this.field(1, 1, y, 'Valor Apurado Municipal - IBS', t.vIbsMun);
    this.field(2, 1, y, 'Alíq. Efetiva Estadual - IBS', t.aliqEfetUf);
    this.field(3, 1, y, 'Valor Apurado Estadual - IBS', t.vIbsUf);
    y += ROW_H;
    this.field(0, 1, y, 'Valor Total Apurado - IBS', t.vIbsTot);
    this.field(1, 1, y, 'Alíquota - CBS', t.aliqCbs);
    this.field(2, 1, y, 'Alíquota Efetiva - CBS', t.aliqEfetCbs);
    this.field(3, 1, y, 'Valor Total Apurado - CBS', t.vCbs);
    y += ROW_H;
    this.pdf.setY(y);
    this.hline(y);
  }

  private drawTotals() {
    const t = this.data.totalValue;
    let y = this.pdf.y;
    this.blockTitle(y, 'VALOR TOTAL DA NFS-E');
    this.field(1, 1, y, 'Valor da Operação / Serviço', t.serviceAmount);
    this.field(2, 1, y, 'Desconto Incondicionado', t.discountUnconditioned);
    this.field(3, 1, y, 'Desconto Condicionado', t.discountConditioned);
    y += ROW_H;
    this.field(0, 1, y, 'Total das Retenções (ISSQN / Federais)', t.totalRetentions);
    this.field(1, 1, y, 'Valor Líquido da NFS-e', t.netValue);
    this.field(2, 1, y, 'Total do IBS/CBS', t.totalIbscbs);
    this.field(3, 1, y, 'Valor Líquido da NFS-e + IBS/CBS', t.netValueIbscbs, true);
    y += ROW_H;
    this.pdf.setY(y);
    this.hline(y);
  }

  private drawComplementaryInfo() {
    const pdf = this.pdf;
    const info = this.data.complementaryInfo;
    let bottom = pdf.tMargin + pdf.eph;
    if (this.opts.displayCanhoto) bottom -= 6.9;
    this.titleStrip('INFORMAÇÕES COMPLEMENTARES');
    const y = pdf.y;

    // O bloco absorve a altura restante da página (§2.3 da NT 008/2026); o
    // conteúdo variável é truncado com reticências para preservar a linha
    // fixa dos Totais Aproximados e a página única.
    pdf.setFont(this.font, '', 7);
    const available = bottom - y - 1.0;
    const maxLines = Math.max(Math.floor(available / 2.6), 1);
    let varLimit = 1997;
    let text: string;
    for (;;) {
      const variable = ellipsize(info.segments.join(' | '), varLimit);
      text = variable ? `${variable} | ${info.approxTaxes}` : info.approxTaxes;
      const lines = pdf.wrap(this.bw - 1.6, text);
      if (lines.length <= maxLines || varLimit <= 100) break;
      varLimit = Math.max(varLimit - 200, 100);
    }

    pdf.setXY(this.bx + 0.8, y + 0.5);
    pdf.multiCell(this.bw - 1.6, 2.6, text, 'L');
    pdf.setY(bottom);
    if (this.opts.displayCanhoto) this.hline(bottom);
  }

  private drawCanhoto() {
    if (!this.opts.displayCanhoto) return;
    const pdf = this.pdf;
    const data = this.data;
    const y = pdf.y;
    pdf.setFont(this.font, 'B', 6);
    pdf.setXY(this.col(0) + 0.8, y + 0.6);
    pdf.cell(this.colw - 1.6, 2.2, 'DATA CIENTIFICAÇÃO', 'L');
    pdf.setXY(this.col(1) + 0.8, y + 0.6);
    pdf.cell(this.colw - 1.6, 2.2, 'IDENTIFICAÇÃO E ASSINATURA', 'L');
    pdf.setXY(this.col(2) + 0.8, y + 0.6);
    pdf.cell(this.colw * 2 - 1.6, 2.2, 'Nº NFS-E / CHAVE NFS-E', 'L');
    pdf.setFont(this.font, '', 7);
    pdf.setXY(this.col(2) + 0.8, y + 3.4);
    pdf.cell(this.colw * 2 - 1.6, 2.8, `${data.nfseNumber} / ${data.keyNfse}`, 'L');
  }
}

export const DEFAULT_LOGO = path.join(ASSETS_DIR, 'nfse_logo.png');

export function renderDanfse(data: DanfseData, opts: RenderOptions): Promise<Buffer> {
  return new DanfseRenderer(data, opts).render();
}
