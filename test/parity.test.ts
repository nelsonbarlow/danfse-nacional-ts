/**
 * Paridade com o original: cada caso dos testes do BrazilFiscalReport gera o
 * PDF a partir do mesmo XML e com a mesma configuração, e o resultado tem de
 * trazer exatamente os mesmos textos, nas mesmas posições (tolerância de
 * fração de milímetro), que o PDF de referência gerado pelo original.
 */
import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { gerarDanfse, type DanfseOptions } from '../src';
import { byPosition, pdfText } from './pdfText';

const FIX = path.join(__dirname, 'fixtures');
const REF = path.join(__dirname, 'reference');

/** Os casos de `tests/test_danfse.py` (todos com margens de 2 mm). */
const CASES: Array<[string, string, DanfseOptions]> = [
  ['danfse_default_prod', 'nfse_test_prod.xml', {}],
  ['danfse_default_hom', 'nfse_test_hom.xml', {}],
  ['danfse_intermediary', 'nfse_test_interm.xml', {}],
  ['danfse_minimal', 'nfse_test_minimal.xml', {}],
  ['danfse_rtc', 'nfse_test_rtc.xml', { canhoto: true }],
  ['danfse_replaced', 'nfse_test_rtc.xml', { situacao: 'substituida' }],
  ['danfse_cancelled_prod', 'nfse_test_prod.xml', { situacao: 'cancelada' }],
  ['danfse_cancelled_hom', 'nfse_test_hom.xml', { situacao: 'cancelada' }],
  ['danfse_cnpj_alfanumerico', 'nfse_test_cnpj_alfanumerico.xml', {}],
  ['danfse_rtc_valid', 'nfse_rtc_valid.xml', {}],
];

/** Tolerância de posição, em mm. */
const TOL = 0.05;

describe('paridade com o BrazilFiscalReport', () => {
  for (const [ref, fixture, opts] of CASES) {
    it(ref, async () => {
      const ours = await pdfText(await gerarDanfse(readFileSync(path.join(FIX, fixture)), opts));
      const theirs = await pdfText(readFileSync(path.join(REF, `${ref}.pdf`)));

      expect(ours.pages).toBe(1);
      const a = byPosition(ours.items);
      const b = byPosition(theirs.items);
      expect(a.map((i) => i.str)).toEqual(b.map((i) => i.str));
      const off = a
        .map((it, i) => ({ str: it.str, dx: it.x - b[i].x, dy: it.y - b[i].y }))
        .filter((d) => Math.abs(d.dx) > TOL || Math.abs(d.dy) > TOL);
      expect(off).toEqual([]);
    });
  }
});
