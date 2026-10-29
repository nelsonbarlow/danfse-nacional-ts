/** Textos de um PDF com a posição (mm, origem no topo esquerdo), via pdf.js. */
import path from 'path';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const MM = 25.4 / 72;
const FONTS = `${path.dirname(require.resolve('pdfjs-dist/package.json'))}/standard_fonts/`;

export interface TextItem {
  str: string;
  x: number;
  y: number;
}

export async function pdfText(pdf: Uint8Array): Promise<{ pages: number; items: TextItem[] }> {
  const doc = await getDocument({ data: new Uint8Array(pdf), useSystemFonts: false, isEvalSupported: false, standardFontDataUrl: FONTS }).promise;
  const page = await doc.getPage(1);
  const height = page.view[3];
  const content = await page.getTextContent();
  const items: TextItem[] = [];
  for (const it of content.items as any[]) {
    if (!it.str || !it.str.trim()) continue;
    items.push({ str: it.str, x: it.transform[4] * MM, y: (height - it.transform[5]) * MM });
  }
  const pages = doc.numPages;
  await doc.destroy();
  return { pages, items };
}

/** Ordem de leitura: de cima para baixo, da esquerda para a direita. */
export function byPosition(items: TextItem[]): TextItem[] {
  return [...items].sort((a, b) => Math.round(a.y * 2) - Math.round(b.y * 2) || a.x - b.x);
}
