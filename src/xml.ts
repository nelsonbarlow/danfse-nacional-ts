/**
 * Leitura do XML da NFS-e com a mesma semântica do ElementTree usado pelo
 * BrazilFiscalReport: `find` busca o primeiro descendente (ordem do
 * documento) no namespace da NFS-e, `findChild` só os filhos diretos, e
 * `text` devolve o texto do elemento como o `.text` do ElementTree.
 */
import { DOMParser, type Element, type Node } from '@xmldom/xmldom';

export const NS = 'http://www.sped.fazenda.gov.br/nfse';

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
const CDATA_SECTION_NODE = 4;

export type El = Element | null | undefined;

export function parseXml(xml: string | Uint8Array): Element {
  let source = typeof xml === 'string' ? xml : new TextDecoder('utf-8').decode(xml);
  if (source.charCodeAt(0) === 0xfeff) source = source.slice(1);
  const doc = new DOMParser().parseFromString(source, 'text/xml');
  const root = doc.documentElement;
  if (!root) throw new Error('XML inválido: documento vazio.');
  return root;
}

/** Primeiro descendente `tag` (namespace da NFS-e), sem contar o próprio nó. */
export function find(node: El, tag: string): Element | null {
  if (!node) return null;
  const list = node.getElementsByTagNameNS(NS, tag);
  return list.length ? (list.item(0) as Element) : null;
}

/** Todos os descendentes `tag`, na ordem do documento. */
export function findAll(node: El, tag: string): Element[] {
  if (!node) return [];
  const list = node.getElementsByTagNameNS(NS, tag);
  const out: Element[] = [];
  for (let i = 0; i < list.length; i++) out.push(list.item(i) as Element);
  return out;
}

/** Primeiro filho direto `tag`. */
export function findChild(node: El, tag: string): Element | null {
  if (!node) return null;
  for (let c: Node | null = node.firstChild; c; c = c.nextSibling) {
    if (c.nodeType === ELEMENT_NODE) {
      const e = c as Element;
      if (e.localName === tag && e.namespaceURI === NS) return e;
    }
  }
  return null;
}

/** O `.text` do ElementTree: o texto antes do primeiro filho elemento. */
export function ownText(node: El): string {
  if (!node) return '';
  let out = '';
  for (let c: Node | null = node.firstChild; c; c = c.nextSibling) {
    if (c.nodeType === ELEMENT_NODE) break;
    if (c.nodeType === TEXT_NODE || c.nodeType === CDATA_SECTION_NODE) out += c.nodeValue ?? '';
  }
  return out;
}

/** Texto do primeiro descendente `tag`, ou '' (o `extract_text` do original). */
export function text(node: El, tag: string): string {
  return ownText(find(node, tag));
}
