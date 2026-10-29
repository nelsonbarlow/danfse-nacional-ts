/**
 * As primitivas do fpdf2 que o leiaute do BrazilFiscalReport usa, sobre o
 * pdfkit, em milímetros. Reproduzem as mesmas regras de posicionamento
 * (margem interna da célula, linha de base, quebra de linha), para o
 * leiaute poder ser portado sem reinterpretar coordenadas.
 */
import PDFDocument from 'pdfkit';

/** Pontos por milímetro. */
export const K = 72 / 25.4;

/** Margem interna das células: no fpdf2, 1/10 da margem padrão de 1 cm. */
const C_MARGIN = 28.35 / K / 10;

export type Align = 'L' | 'C' | 'R';
export type Style = '' | 'B';
export type Rgb = [number, number, number];

export interface FontFiles {
  normal: string | Buffer;
  bold: string | Buffer;
}

const STANDARD_FONTS: Record<string, { '': string; B: string }> = {
  Helvetica: { '': 'Helvetica', B: 'Helvetica-Bold' },
  Times: { '': 'Times-Roman', B: 'Times-Bold' },
  Courier: { '': 'Courier', B: 'Courier-Bold' },
};

export class Pdf {
  readonly doc: PDFKit.PDFDocument;
  readonly w = 210;
  readonly h = 297;
  x = 0;
  y = 0;
  lMargin = 10;
  tMargin = 10;
  rMargin = 10;
  bMargin = 10;
  private family = 'Helvetica';
  private style: Style = '';
  private sizePt = 12;
  private textColor: Rgb = [0, 0, 0];
  private fillColor: Rgb = [0, 0, 0];
  private lineWidthMm = 0.567 / K;
  private readonly custom: boolean;

  constructor(opts: { title: string; creationDate?: Date; fonts?: FontFiles }) {
    this.doc = new PDFDocument({
      size: 'A4',
      margin: 0,
      autoFirstPage: true,
      info: { Title: opts.title, Producer: 'danfse-nacional-ts', Creator: 'danfse-nacional-ts', ...(opts.creationDate ? { CreationDate: opts.creationDate } : {}) },
    });
    this.custom = !!opts.fonts;
    if (opts.fonts) {
      this.doc.registerFont('custom', opts.fonts.normal as any);
      this.doc.registerFont('custom-bold', opts.fonts.bold as any);
      this.family = 'custom';
    }
  }

  setMargins(left: number, top: number, right: number, bottom: number) {
    this.lMargin = left;
    this.tMargin = top;
    this.rMargin = right;
    this.bMargin = bottom;
    this.x = left;
    this.y = top;
  }

  /** Largura útil da página. */
  get epw() {
    return this.w - this.lMargin - this.rMargin;
  }

  /** Altura útil da página. */
  get eph() {
    return this.h - this.tMargin - this.bMargin;
  }

  get fontFamily() {
    return this.family;
  }

  /** Tamanho da fonte em mm (o `font_size` do fpdf2). */
  get fontSize() {
    return this.sizePt / K;
  }

  setFont(family: string, style: Style, sizePt: number) {
    if (!this.custom) this.family = family;
    this.style = style;
    this.sizePt = sizePt;
  }

  private fontName(): string {
    if (this.custom) return this.style === 'B' ? 'custom-bold' : 'custom';
    return (STANDARD_FONTS[this.family] ?? STANDARD_FONTS.Helvetica)[this.style];
  }

  private applyFont() {
    this.doc.font(this.fontName()).fontSize(this.sizePt);
    // O fpdf2 não aplica kerning; o pdfkit aplica os pares do AFM das fontes
    // padrão sempre, na medida e no desenho. Zerar os pares (o objeto da
    // fonte é de cada documento) deixa larguras e posições iguais às do
    // original. Para TTF próprio, o kerning sai via `features`.
    const afm = (this.doc as any)._font?.font;
    if (afm && afm.kernPairs && Object.keys(afm.kernPairs).length) afm.kernPairs = {};
  }

  private get textFeatures(): any {
    return this.custom ? { kern: false } : undefined;
  }

  stringWidth(s: string): number {
    this.applyFont();
    return this.doc.widthOfString(s, { features: this.textFeatures }) / K;
  }

  setXY(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  /** Como no fpdf2, `set_y` também volta o x para a margem esquerda. */
  setY(y: number) {
    this.x = this.lMargin;
    this.y = y;
  }

  setTextColor(r: number, g: number, b: number) {
    this.textColor = [r, g, b];
  }

  setFillColor(r: number, g: number, b: number) {
    this.fillColor = [r, g, b];
  }

  setLineWidth(mm: number) {
    this.lineWidthMm = mm;
  }

  /** Texto com a linha de base em (x, y). */
  text(x: number, y: number, s: string) {
    this.applyFont();
    this.doc
      .fillColor(this.textColor)
      .text(s, x * K, y * K, { lineBreak: false, baseline: 'alphabetic', features: this.textFeatures });
  }

  /** Uma linha de texto numa célula w×h; o cursor avança para a direita. */
  cell(w: number, h: number, s: string, align: Align = 'L') {
    if (s) {
      const sw = this.stringWidth(s);
      const dx = align === 'C' ? (w - sw) / 2 : align === 'R' ? w - C_MARGIN - sw : C_MARGIN;
      this.text(this.x + dx, this.y + 0.5 * h + 0.3 * this.fontSize, s);
    }
    this.x += w;
  }

  /** Quebra o texto nas linhas que cabem na célula de largura w (o dry run do `multi_cell`). */
  wrap(w: number, s: string): string[] {
    const maxW = w - 2 * C_MARGIN;
    const out: string[] = [];
    for (const paragraph of s.split('\n')) {
      const words = paragraph.split(' ');
      let line = '';
      for (const word of words) {
        const candidate = line ? `${line} ${word}` : word;
        if (this.stringWidth(candidate) <= maxW) {
          line = candidate;
          continue;
        }
        if (line) out.push(line);
        line = '';
        // Palavra que sozinha não cabe: parte por caractere.
        let rest = word;
        while (rest && this.stringWidth(rest) > maxW) {
          let cut = rest.length - 1;
          while (cut > 1 && this.stringWidth(rest.slice(0, cut)) > maxW) cut--;
          out.push(rest.slice(0, cut));
          rest = rest.slice(cut);
        }
        line = rest;
      }
      out.push(line);
    }
    return out;
  }

  /** Texto com quebra de linha; o cursor desce para depois da última linha. */
  multiCell(w: number, h: number, s: string, align: Align = 'L') {
    const x0 = this.x;
    for (const line of this.wrap(w, s)) {
      this.x = x0;
      this.cell(w, h, line, align);
      this.y += h;
    }
    this.x = x0 + w;
  }

  /** Corta o texto (com reticências) para caber em `limit` mm, como o `long_field`. */
  longField(s: string, limit: number): string {
    if (!s || limit <= 0) return '';
    const safe = limit - 2;
    if (this.stringWidth(s) <= safe) return s;
    const words = s.split(/\s+/).filter(Boolean);
    while (words.length && this.stringWidth(`${words.join(' ')}...`) > safe) words.pop();
    if (words.length) return `${words.join(' ')}...`;
    let t = s;
    while (t && this.stringWidth(`${t}...`) > safe) t = t.slice(0, -1);
    return t ? `${t}...` : '';
  }

  rect(x: number, y: number, w: number, h: number, style: 'D' | 'F' = 'D') {
    this.doc.rect(x * K, y * K, w * K, h * K);
    if (style === 'F') this.doc.fillColor(this.fillColor).fill();
    else this.doc.lineWidth(this.lineWidthMm * K).strokeColor('black').undash().stroke();
  }

  line(x1: number, y1: number, x2: number, y2: number) {
    this.doc.moveTo(x1 * K, y1 * K).lineTo(x2 * K, y2 * K).lineWidth(this.lineWidthMm * K).strokeColor('black').undash().stroke();
  }

  image(src: string | Buffer, x: number, y: number, h: number) {
    this.doc.image(src as any, x * K, y * K, { height: h * K });
  }

  /** Quadrados pretos de uma matriz de módulos (QR Code vetorial). */
  modules(size: number, dark: (row: number, col: number) => boolean, x: number, y: number, side: number) {
    const m = (side / size) * K;
    this.doc.fillColor('black');
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) if (dark(r, c)) this.doc.rect(x * K + c * m, y * K + r * m, m, m);
    }
    this.doc.fill();
  }

  /** Texto girado `angle` graus (anti-horário) em torno de (cx, cy), com opacidade. */
  rotatedText(angle: number, cx: number, cy: number, x: number, y: number, s: string, opacity: number) {
    this.doc.save();
    this.doc.fillOpacity(opacity);
    this.doc.rotate(-angle, { origin: [cx * K, cy * K] });
    this.text(x, y, s);
    this.doc.restore();
  }

  output(): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      this.doc.on('data', (c: Buffer) => chunks.push(c));
      this.doc.on('end', () => resolve(Buffer.concat(chunks)));
      this.doc.on('error', reject);
      this.doc.end();
    });
  }
}
