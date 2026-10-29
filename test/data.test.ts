/** Dados extraídos do XML — inclui as asserções de `test_danfse_rtc_valid_xsd` do original. */
import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { lerDanfse } from '../src';

const fixture = (name: string) => readFileSync(path.join(__dirname, 'fixtures', name));

describe('lerDanfse', () => {
  it('lê o bloco IBS/CBS de uma NFS-e válida contra o XSD oficial', () => {
    const data = lerDanfse(fixture('nfse_rtc_valid.xml'));
    expect(data.ibscbs).toEqual({
      cstCclasstrib: '000 / 000001',
      indOp: '010101 / 3550308 / São Paulo / SP',
      exclusions: 'R$ 460,00',
      bcAfter: 'R$ 9.040,00',
      redAliq: '10,00% / 10,00% / 10,00%',
      aliqIbs: '5,00% / 2,00%',
      aliqEfetMun: '1,80%',
      vIbsMun: 'R$ 162,72',
      aliqEfetUf: '4,50%',
      vIbsUf: 'R$ 406,80',
      vIbsTot: 'R$ 569,52',
      aliqCbs: '8,80%',
      aliqEfetCbs: '7,92%',
      vCbs: 'R$ 715,97',
    });
    expect(data.totalValue.totalIbscbs).toBe('R$ 1.285,49');
    expect(data.totalValue.netValueIbscbs).toBe('R$ 10.201,49');
  });

  it('sem tomador, destinatário e intermediário, e sem ISSQN', () => {
    const data = lerDanfse(fixture('nfse_test_minimal.xml'));
    expect(data.taker).toBeNull();
    expect(data.dest).toBeNull();
    expect(data.intermed).toBeNull();
    expect(data.municipalTaxes.suppressed).toBe(true);
  });

  it('aceita o XML como string ou Buffer, com BOM', () => {
    const xml = fixture('nfse_test_prod.xml').toString('utf8');
    expect(lerDanfse(`﻿${xml}`).keyNfse).toBe(lerDanfse(Buffer.from(xml)).keyNfse);
  });

  it('recusa XML que não é de NFS-e', () => {
    expect(() => lerDanfse('<foo/>')).toThrow(/infNFSe/);
  });
});
