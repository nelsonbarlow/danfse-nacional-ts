/**
 * Extração dos campos do DANFSe a partir do XML da NFS-e — port de
 * `Danfse._parse_xml` (BrazilFiscalReport). Todos os textos saem prontos
 * para impressão: máscaras, descrições dos códigos, somas e reticências da
 * NT 008/2026.
 */
import {
  ellipsize,
  floatStr,
  formatCepNt,
  formatCpfCnpj,
  formatNumber,
  formatPhone,
  getDateUtc,
  joinParts,
  toFloat,
} from './format';
import { municipioIbge, ufFromIbgeCode } from './municipios';
import {
  AMB_GER,
  C_STAT,
  FIN_NFSE,
  REG_AP_TRIB_SN,
  REG_ESP_TRIB,
  SIMPLES_OP,
  TP_AMB,
  TP_EMIT,
  TP_IMUNIDADE,
  TP_RET_ISSQN,
  TP_RET_PIS_COFINS,
  TP_SUSP,
  TRIB_ISSQN,
} from './tables';
import { find, findAll, findChild, ownText, parseXml, text, type El } from './xml';

/** Casas decimais de valores e alíquotas no leiaute v2.0. */
const PRICE_PRECISION = 2;

export interface DanfsePerson {
  id: string;
  phone: string;
  name: string;
  email: string;
  address: string;
  city: string;
  ibgeCep: string;
  municipalRegistration?: string;
}

export interface DanfseData {
  environment: string;
  keyNfse: string;
  nfseNumber: string;
  compet: string;
  competFmt: string;
  dtNfse: string;
  hrNfse: string;
  dtDps: string;
  hrDps: string;
  dpsNumber: string;
  dpsSerie: string;
  header: { city: string; ambGer: string; tpAmb: string };
  emitterType: string;
  status: string;
  purpose: string;
  issuer: DanfsePerson & { municipalRegistration: string; simples: string; taxRegim: string };
  taker: DanfsePerson | null;
  dest: DanfsePerson | null;
  intermed: DanfsePerson | null;
  service: {
    taxCode: string;
    nbs: string;
    placeOfProvision: string;
    taxCodeDescription: string;
    description: string;
  };
  municipalTaxes: {
    suppressed: boolean;
    issqnTax: string;
    city: string;
    specialTaxRegim: string;
    immunityType: string;
    suspensionIssqn: string;
    suspensionNumber: string;
    municipalBenefit: string;
    municipalBenefitMath: string;
    deductReducAmount: string;
    discountUnconditioned: string;
    calculationBasis: string;
    aliqApplied: string;
    issqnRetention: string;
    issqnCleared: string;
  };
  federalTaxes: {
    irrf: string;
    previdenciaryContribution: string;
    socialContribution: string;
    socialDescription: string;
    pisDebit: string;
    cofinsDebit: string;
    showPisCofins: boolean;
  };
  ibscbs: {
    cstCclasstrib: string;
    indOp: string;
    exclusions: string;
    bcAfter: string;
    redAliq: string;
    aliqIbs: string;
    aliqEfetMun: string;
    vIbsMun: string;
    aliqEfetUf: string;
    vIbsUf: string;
    vIbsTot: string;
    aliqCbs: string;
    aliqEfetCbs: string;
    vCbs: string;
  };
  totalValue: {
    serviceAmount: string;
    discountConditioned: string;
    discountUnconditioned: string;
    totalRetentions: string;
    netValue: string;
    totalIbscbs: string;
    netValueIbscbs: string;
  };
  complementaryInfo: { segments: string[]; approxTaxes: string };
}

const money = (value: string) => (value ? `R$ ${formatNumber(value, PRICE_PRECISION)}` : '-');
const pct = (value: string) => (value ? `${formatNumber(value, PRICE_PRECISION)}%` : '-');

function formatAddress(node: El): string {
  return [text(node, 'xLgr'), text(node, 'nro'), text(node, 'xCpl'), text(node, 'xBairro')]
    .filter((c) => c && c.trim())
    .join(', ');
}

/** Campos cadastrais de tomador / destinatário / intermediário. */
function parsePerson(node: El, inscricao = true): DanfsePerson | null {
  if (!node) return null;
  const cMun = text(node, 'cMun');
  let [munName, munUf] = municipioIbge(cMun);
  munName = munName || text(node, 'xMun') || text(node, 'xCidade');
  munUf = munUf || ufFromIbgeCode(cMun) || text(node, 'UF') || text(node, 'xEstProvReg');
  const cEndPost = text(node, 'cEndPost');
  const ibgeCep = cEndPost ? `${cEndPost} (ext)` : joinParts(cMun, formatCepNt(text(node, 'CEP')));
  const person: DanfsePerson = {
    id: formatCpfCnpj(text(node, 'CNPJ')) || formatCpfCnpj(text(node, 'CPF')) || text(node, 'NIF') || '-',
    phone: formatPhone(text(node, 'fone')) || '-',
    name: ellipsize(text(node, 'xNome'), 77) || '-',
    email: text(node, 'email') || '-',
    address: ellipsize(formatAddress(node), 77) || '-',
    city: joinParts(munName, munUf),
    ibgeCep,
  };
  if (inscricao) person.municipalRegistration = text(node, 'IM') || '-';
  return person;
}

/** Lê o XML da NFS-e e devolve os textos do DANFSe. */
export function parseDanfse(xml: string | Uint8Array): DanfseData {
  const root = parseXml(xml);
  const infNfse = find(root, 'infNFSe');
  const dps = find(root, 'DPS');
  if (!infNfse || !dps) {
    throw new Error('XML inválido para o DANFSe: os grupos NFSe/infNFSe e NFSe/infNFSe/DPS são obrigatórios.');
  }
  const infDps = find(dps, 'infDPS');
  const emit = find(root, 'emit');
  const enderNac = find(emit, 'enderNac');
  const prest = find(dps, 'prest');
  const prestEnd = find(prest, 'end');
  const regTrib = find(prest, 'regTrib');
  const serv = find(dps, 'serv');
  const tribMun = find(dps, 'tribMun');
  // "valores" e "IBSCBS" existem em mais de um nível do XML: ancorar a
  // leitura nos filhos diretos para não capturar o grupo errado.
  const valores = findChild(infNfse, 'valores');
  const dpsIbscbs = findChild(infDps, 'IBSCBS');
  const nfseIbscbs = findChild(infNfse, 'IBSCBS');

  const compet = text(dps, 'dCompet');
  const [competFmt] = getDateUtc(compet);
  const [dtNfse, hrNfse] = getDateUtc(text(infNfse, 'dhProc'));
  const [dtDps, hrDps] = getDateUtc(text(dps, 'dhEmi'));

  const simples = ellipsize(SIMPLES_OP[text(regTrib, 'opSimpNac')] ?? '-', 37);
  const taxRegim = ellipsize(REG_AP_TRIB_SN[text(regTrib, 'regApTribSN')] ?? '', 77);
  const specialTaxRegim = REG_ESP_TRIB[text(regTrib, 'regEspTrib')] ?? '-';

  const description = text(serv, 'xDescServ');

  let nationalTax = text(serv, 'cTribNac');
  if (nationalTax.length >= 6) nationalTax = `${nationalTax.slice(0, 2)}.${nationalTax.slice(2, 4)}.${nationalTax.slice(4)}`;
  const municipalTax = text(serv, 'cTribMun');
  let nbs = text(serv, 'cNBS');
  if (nbs.length === 9) nbs = `${nbs.slice(0, 1)}.${nbs.slice(1, 5)}.${nbs.slice(5, 7)}.${nbs.slice(7)}`;

  // Descrição do código de tributação: municipal quando houver, senão
  // nacional (tabela 2.4.5 da NT 008/2026).
  const taxCodeDescription = ellipsize(text(infNfse, 'xTribMun') || text(infNfse, 'xTribNac'), 167);

  const issqn = TRIB_ISSQN[text(dps, 'tribISSQN')] ?? '-';
  const issqnRetention = TP_RET_ISSQN[text(dps, 'tpRetISSQN')] ?? '-';
  const issqnValue = text(valores, 'vISSQN');

  const aliqVal = text(valores, 'pAliqAplic');
  const vServ = text(dps, 'vServ');
  const fedTax = text(dps, 'vTotTribFed');
  const estTax = text(dps, 'vTotTribEst');
  const munTax = text(dps, 'vTotTribMun');
  const fedTaxPct = text(dps, 'pTotTribFed');
  const estTaxPct = text(dps, 'pTotTribEst');
  const munTaxPct = text(dps, 'pTotTribMun');
  const vDescInc = text(dps, 'vDescIncond');
  const vDescCond = text(dps, 'vDescCond');

  // Benefício Municipal: descrição de tpBM (NFSe/infNFSe/valores), textos do
  // leiaute ADN da NFS-e nacional.
  const bm = find(dps, 'BM');
  const pRedBcbm = bm ? text(bm, 'pRedBCBM') : '';
  const vRedBcbm = bm ? text(bm, 'vRedBCBM') : '';
  const municipalBenefitType: Record<string, string> = {
    '1': 'Isenção',
    '2': pRedBcbm ? `Redução da BC em ${formatNumber(pRedBcbm, PRICE_PRECISION)}%` : 'Redução da Base de Cálculo',
    '3': vRedBcbm ? `Redução da BC em R$ ${formatNumber(vRedBcbm, PRICE_PRECISION)}` : 'Redução da Base de Cálculo',
    '4': 'Alíquota Diferenciada',
  };
  const municipalBenefit = ellipsize(municipalBenefitType[text(valores, 'tpBM')] ?? '-', 37);
  const vCalcBm = text(valores, 'vCalcBM') || vRedBcbm;

  // Total Deduções/Reduções: vDR (DPS/infDPS/valores/vDedRed) ou vCalcDR
  // (infNFSe/valores), somado a vCalcReeRepRes (infNFSe/IBSCBS/valores).
  const vDedRed = find(dps, 'vDedRed');
  let dedRedValue = vDedRed ? text(vDedRed, 'vDR') : '';
  if (!dedRedValue) dedRedValue = text(valores, 'vCalcDR');
  const vCalcRee = nfseIbscbs ? text(nfseIbscbs, 'vCalcReeRepRes') : '';
  const deductReducAmount =
    dedRedValue || vCalcRee ? money(floatStr(toFloat(dedRedValue) + toFloat(vCalcRee))) : '-';

  // Dados cadastrais do prestador: DPS/infDPS/prest, com fallback para
  // infNFSe/emit quando a tag não consta de prest e o emitente é o próprio
  // prestador (tpEmit=1 ou ausente).
  const tpEmit = text(dps, 'tpEmit');
  const emitFb = tpEmit === '' || tpEmit === '1' ? emit : null;
  let issuerAddress: string;
  let issuerIbgeCep: string;
  let munName: string;
  let munUf: string;
  if (prestEnd) {
    const prestCmun = text(prestEnd, 'cMun');
    issuerAddress = formatAddress(prestEnd);
    const issuerCep = text(prestEnd, 'CEP');
    [munName, munUf] = municipioIbge(prestCmun);
    munName = munName || text(prestEnd, 'xMun') || text(prestEnd, 'xCidade') || text(infNfse, 'xLocEmi');
    munUf = munUf || ufFromIbgeCode(prestCmun) || text(prestEnd, 'UF');
    const cEndPost = text(prestEnd, 'cEndPost');
    issuerIbgeCep = cEndPost ? `${cEndPost} (ext)` : joinParts(prestCmun, formatCepNt(issuerCep));
  } else {
    const prestCmun = emitFb ? text(enderNac, 'cMun') : '';
    issuerAddress = emitFb ? formatAddress(enderNac) : '';
    const issuerCep = emitFb ? text(enderNac, 'CEP') : '';
    [munName, munUf] = municipioIbge(prestCmun);
    munName = munName || text(infNfse, 'xLocEmi');
    munUf = munUf || ufFromIbgeCode(prestCmun) || (emitFb ? text(emitFb, 'UF') : '');
    issuerIbgeCep = joinParts(prestCmun, formatCepNt(issuerCep));
  }

  const emitUf = emit ? text(emit, 'UF') : '';
  const cStat = text(infNfse, 'cStat');
  const finNfse = dpsIbscbs ? text(dpsIbscbs, 'finNFSe') : '';
  const ambGer = text(infNfse, 'ambGer');
  const tpAmb = text(dps, 'tpAmb');

  const data: DanfseData = {
    environment: tpAmb,
    keyNfse: (infNfse.getAttribute('Id') ?? '').slice(3),
    nfseNumber: text(infNfse, 'nNFSe'),
    compet,
    competFmt,
    dtNfse,
    hrNfse,
    dtDps,
    hrDps,
    dpsNumber: text(dps, 'nDPS'),
    dpsSerie: text(dps, 'serie'),
    header: {
      // Não exibir o município quando o item do código de tributação
      // nacional for 99 (tabela 2.4.5 da NT 008/2026).
      city: text(serv, 'cTribNac').slice(0, 2) === '99' ? '' : joinParts(text(infNfse, 'xLocEmi'), emitUf),
      ambGer: (AMB_GER[ambGer] ?? ambGer) || '-',
      tpAmb: (TP_AMB[tpAmb] ?? tpAmb) || '-',
    },
    emitterType: TP_EMIT[tpEmit] ?? '-',
    status: ellipsize(C_STAT[cStat] ?? cStat, 37) || '-',
    purpose: ellipsize(FIN_NFSE[finNfse] ?? finNfse, 37) || '-',
    issuer: {
      id:
        formatCpfCnpj(text(prest, 'CNPJ')) ||
        formatCpfCnpj(text(prest, 'CPF')) ||
        text(prest, 'NIF') ||
        formatCpfCnpj(text(emitFb, 'CNPJ')) ||
        formatCpfCnpj(text(emitFb, 'CPF')) ||
        '-',
      municipalRegistration: text(prest, 'IM') || text(emitFb, 'IM') || '-',
      phone: formatPhone(text(prest, 'fone') || text(emitFb, 'fone')) || '-',
      name: ellipsize(text(prest, 'xNome') || text(emitFb, 'xNome'), 77) || '-',
      email: text(prest, 'email') || text(emitFb, 'email') || '-',
      address: ellipsize(issuerAddress, 77) || '-',
      city: joinParts(munName, munUf),
      ibgeCep: issuerIbgeCep,
      simples,
      taxRegim: taxRegim || '-',
    },
    taker: null,
    dest: null,
    intermed: null,
    service: {
      taxCode: joinParts(nationalTax, municipalTax),
      nbs: nbs || '-',
      placeOfProvision: joinParts(
        text(infNfse, 'xLocPrestacao'),
        ufFromIbgeCode(text(serv, 'cLocPrestacao')),
        text(serv, 'cPaisPrestacao') || 'BR'
      ),
      taxCodeDescription,
      description: ellipsize(description, 1297) || '-',
    },
    municipalTaxes: {
      suppressed: tribMun === null,
      issqnTax: issqn,
      city: joinParts(text(infNfse, 'xLocIncid'), ufFromIbgeCode(text(infNfse, 'cLocIncid')), text(dps, 'cPaisResult') || 'BR'),
      specialTaxRegim,
      immunityType: ellipsize(TP_IMUNIDADE[text(dps, 'tpImunidade')] ?? text(dps, 'tpImunidade'), 37) || '-',
      suspensionIssqn: '-',
      suspensionNumber: '-',
      municipalBenefit,
      municipalBenefitMath: money(vCalcBm),
      deductReducAmount,
      discountUnconditioned: '-',
      calculationBasis: money(text(valores, 'vBC')),
      aliqApplied: pct(aliqVal),
      issqnRetention,
      issqnCleared: money(issqnValue),
    },
    federalTaxes: {
      irrf: '-',
      previdenciaryContribution: '-',
      socialContribution: '-',
      socialDescription: '-',
      pisDebit: '-',
      cofinsDebit: '-',
      // A linha PIS/COFINS/Descrição é impressa somente até o ano-calendário
      // de 2026 (Nota 6).
      showPisCofins: (compet.slice(0, 4) || '0000') <= '2026',
    },
    ibscbs: {} as DanfseData['ibscbs'],
    totalValue: {
      serviceAmount: money(vServ),
      discountConditioned: '-',
      discountUnconditioned: '-',
      totalRetentions: money(text(valores, 'vTotalRet')),
      netValue: money(text(valores, 'vLiq')),
      totalIbscbs: '-',
      netValueIbscbs: '-',
    },
    complementaryInfo: { segments: [], approxTaxes: '' },
  };

  data.taker = parsePerson(find(dps, 'toma'));
  data.intermed = parsePerson(find(dps, 'interm'));
  data.dest = parsePerson(dpsIbscbs ? find(dpsIbscbs, 'dest') : null, false);

  const exigSusp = find(dps, 'exigSusp');
  if (exigSusp) {
    const suspension = TP_SUSP[text(exigSusp, 'tpSusp')];
    if (suspension) data.municipalTaxes.suspensionIssqn = ellipsize(suspension, 37);
    const nProcesso = text(exigSusp, 'nProcesso');
    if (nProcesso) data.municipalTaxes.suspensionNumber = nProcesso;
  }

  if (find(dps, 'vDescCondIncond')) {
    data.municipalTaxes.discountUnconditioned = money(vDescInc);
    data.totalValue.discountUnconditioned = money(vDescInc);
    data.totalValue.discountConditioned = money(vDescCond);
  }

  // Tributação federal (exceto CBS).
  let pis = '';
  let cofins = '';
  const tribFed = find(dps, 'tribFed');
  if (tribFed) {
    const fed = data.federalTaxes;
    fed.irrf = money(text(tribFed, 'vRetIRRF'));
    fed.previdenciaryContribution = money(text(tribFed, 'vRetCP'));
    const tpRetPisCofins = text(tribFed, 'tpRetPisCofins');
    if (tpRetPisCofins in TP_RET_PIS_COFINS) fed.socialDescription = ellipsize(TP_RET_PIS_COFINS[tpRetPisCofins], 35);
    pis = text(tribFed, 'vPis');
    cofins = text(tribFed, 'vCofins');
    const csll = text(tribFed, 'vRetCSLL');
    if (tpRetPisCofins === '1') {
      fed.socialContribution = money(floatStr(toFloat(csll) + toFloat(pis) + toFloat(cofins)));
      fed.pisDebit = money('0');
      fed.cofinsDebit = money('0');
    } else {
      fed.socialContribution = money(csll);
      fed.pisDebit = money(pis);
      fed.cofinsDebit = money(cofins);
    }
  }

  // Tributação IBS/CBS: grupos da DPS (CST/cClassTrib/cIndOp) e da NFS-e
  // (valores e totais calculados).
  const cst = text(dpsIbscbs, 'CST');
  const cClassTrib = text(dpsIbscbs, 'cClassTrib');
  const cIndOp = text(dpsIbscbs, 'cIndOp');
  const ibsValores = findChild(nfseIbscbs, 'valores');
  const ibsUf = find(ibsValores, 'uf');
  const ibsMun = find(ibsValores, 'mun');
  const ibsFed = find(ibsValores, 'fed');
  const totCibs = find(nfseIbscbs, 'totCIBS');
  const cLocIncid = text(nfseIbscbs, 'cLocalidadeIncid');
  const xLocIncid = text(nfseIbscbs, 'xLocalidadeIncid');

  const exclusionParts = [vDescInc, vCalcRee, issqnValue, pis, cofins];
  const exclusions = exclusionParts.some(Boolean)
    ? money(floatStr(exclusionParts.reduce((s, p) => s + toFloat(p), 0)))
    : '-';

  const pRedUf = text(ibsUf, 'pRedAliqUF');
  const pRedMun = text(ibsMun, 'pRedAliqMun');
  const pRedCbs = text(ibsFed, 'pRedAliqCBS');
  const pIbsUf = text(ibsUf, 'pIBSUF');
  const pIbsMun = text(ibsMun, 'pIBSMun');
  const vIbsTot = text(totCibs, 'vIBSTot');
  const vCbs = text(totCibs, 'vCBS');

  if (vIbsTot || vCbs) data.totalValue.totalIbscbs = money(floatStr(toFloat(vIbsTot) + toFloat(vCbs)));
  data.totalValue.netValueIbscbs = money(text(totCibs, 'vTotNF'));

  data.ibscbs = {
    cstCclasstrib: joinParts(cst, cClassTrib),
    indOp: joinParts(cIndOp, cLocIncid, xLocIncid, ufFromIbgeCode(cLocIncid)),
    exclusions,
    bcAfter: money(text(ibsValores, 'vBC')),
    redAliq: pRedUf || pRedMun || pRedCbs ? joinParts(pct(pRedUf), pct(pRedMun), pct(pRedCbs)) : '-',
    aliqIbs: pIbsUf || pIbsMun ? joinParts(pct(pIbsUf), pct(pIbsMun)) : '-',
    aliqEfetMun: pct(text(ibsMun, 'pAliqEfetMun')),
    vIbsMun: money(text(totCibs, 'vIBSMun')),
    aliqEfetUf: pct(text(ibsUf, 'pAliqEfetUF')),
    vIbsUf: money(text(totCibs, 'vIBSUF')),
    vIbsTot: money(vIbsTot),
    aliqCbs: pct(text(ibsFed, 'pCBS')),
    aliqEfetCbs: pct(text(ibsFed, 'pAliqEfetCBS')),
    vCbs: money(vCbs),
  };

  // Informações complementares: união dos campos na ordem da tabela 2.4.5,
  // separados por pipes, encerrada pela linha fixa dos Totais Aproximados
  // dos Tributos (Nota 10).
  const infoCompl = find(serv, 'infoCompl');
  const segments: string[] = [];
  const add = (label: string, value: string) => {
    if (value) segments.push(`${label} ${value}`);
  };
  add('Inf. Cont.:', text(infoCompl, 'xInfComp'));
  add('NFS-e Subst.:', text(dps, 'chSubstda'));
  add('Doc. Ref.:', text(infoCompl, 'docRef'));
  add('Cod. Obra:', text(serv, 'cObra'));
  add('Insc. Imob.:', text(dpsIbscbs, 'inscImobFisc'));
  add('Cod. Evt.:', text(serv, 'idAtvEvt'));
  add('Doc. Tec.:', text(infoCompl, 'idDocTec'));
  add('Núm. Ped.:', text(infoCompl, 'xPed'));
  if (infoCompl) add('Item Ped.:', findAll(infoCompl, 'xItemPed').map(ownText).filter(Boolean).join('; '));
  add('Inf. A. T. Mun.:', text(infNfse, 'xOutInf'));

  const taxTotal = (value: string, percent: string) =>
    value ? `R$ ${formatNumber(value, PRICE_PRECISION)}` : percent ? `${formatNumber(percent, PRICE_PRECISION)}%` : '-';
  data.complementaryInfo = {
    segments,
    approxTaxes:
      'Totais Aproximados dos Tributos cfe. Lei nº 12.741/2012: ' +
      `Federais: ${taxTotal(fedTax, fedTaxPct)} ; ` +
      `Estaduais: ${taxTotal(estTax, estTaxPct)} ; ` +
      `Municipais: ${taxTotal(munTax, munTaxPct)}`,
  };
  return data;
}
