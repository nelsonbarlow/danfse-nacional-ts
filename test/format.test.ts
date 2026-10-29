import { describe, expect, it } from 'vitest';
import { ellipsize, formatCepNt, formatCpfCnpj, formatNumber, formatPhone, getDateUtc, toFixedPy } from '../src/format';

describe('toFixedPy (arredondamento do format() do Python)', () => {
  it('usa o valor exato do double', () => {
    expect(toFixedPy(2.675, 2)).toBe('2.67'); // 2.67499999...
    expect(toFixedPy(1.005, 2)).toBe('1.00'); // 1.00499999...
  });
  it('empate exato vai para o par', () => {
    expect(toFixedPy(0.125, 2)).toBe('0.12');
    expect(toFixedPy(0.375, 2)).toBe('0.38');
    expect(toFixedPy(2.5, 0)).toBe('2');
    expect(toFixedPy(3.5, 0)).toBe('4');
  });
  it('vai-um e sinal', () => {
    expect(toFixedPy(9.999, 2)).toBe('10.00');
    expect(toFixedPy(-1234.5, 2)).toBe('-1234.50');
    expect(toFixedPy(-0.001, 2)).toBe('-0.00');
  });
});

describe('formatNumber', () => {
  it('milhar com ponto, decimal com vírgula', () => {
    expect(formatNumber('10201.49', 2)).toBe('10.201,49');
    expect(formatNumber('1115.0', 2)).toBe('1.115,00');
    expect(formatNumber('', 2)).toBe('0,00');
    expect(formatNumber('abc', 2)).toBe('');
  });
});

describe('documentos e contatos', () => {
  it('CNPJ, CNPJ alfanumérico e CPF', () => {
    expect(formatCpfCnpj('11222333000144')).toBe('11.222.333/0001-44');
    expect(formatCpfCnpj('12abc34501de35')).toBe('12.ABC.345/01DE-35');
    expect(formatCpfCnpj('12345678909')).toBe('123.456.789-09');
    expect(formatCpfCnpj('')).toBe('');
  });
  it('telefone nacional', () => {
    expect(formatPhone('1328023254')).toBe('(13) 2802-3254');
    expect(formatPhone('15982295603')).toBe('(15) 98229-5603');
    expect(formatPhone('5581999998888')).toBe('(81) 99999-8888');
    expect(formatPhone('+1 212 555')).toBe('+1 212 555');
  });
  it('CEP, data e reticências', () => {
    expect(formatCepNt('51110160')).toBe('51.110-160');
    expect(getDateUtc('2026-10-28T13:48:38-03:00')).toEqual(['28/10/2026', '13:48:38']);
    expect(ellipsize('abcdef', 3)).toBe('abc...');
    expect(ellipsize('abc', 3)).toBe('abc');
  });
});
