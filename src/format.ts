/**
 * Formatação de valores, portada de `brazilfiscalreport/utils.py` e dos
 * helpers do módulo DANFSe, com o mesmo resultado (inclusive o arredondamento
 * do `format()` do Python).
 */

/** Quantidade de caracteres como o `len()` do Python (pontos de código). */
const chars = (s: string) => Array.from(s);

/** `float()` do Python, tolerante: valor ausente ou inválido vira 0. */
export function toFloat(value: unknown): number {
  if (value == null) return 0;
  const s = String(value).trim();
  if (!s) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/** Python `str(float)`: o suficiente para reler o mesmo número. */
export const floatStr = (n: number) => String(n);

/**
 * Arredonda como o `format(x, '.Nf')` do Python: pelo valor exato do double,
 * empate (só quando exato) para o par.
 */
export function toFixedPy(n: number, precision: number): string {
  const neg = n < 0 || Object.is(n, -0);
  const abs = Math.abs(n);
  if (abs >= 1e21) return n.toFixed(precision);
  // Expansão decimal exata (todo double finito < 1e21 cabe em 100 casas
  // o suficiente para decidir o arredondamento).
  const exact = abs.toFixed(100);
  const [intPart, frac] = exact.split('.');
  const keep = frac.slice(0, precision);
  const rest = frac.slice(precision);
  let digits = intPart + keep;
  const first = rest.charCodeAt(0) - 48;
  const tail = /[1-9]/.test(rest.slice(1));
  const last = digits.charCodeAt(digits.length - 1) - 48;
  const roundUp = first > 5 || (first === 5 && (tail || last % 2 === 1));
  if (roundUp) {
    const arr = digits.split('');
    let i = arr.length - 1;
    while (i >= 0) {
      if (arr[i] === '9') {
        arr[i] = '0';
        i--;
      } else {
        arr[i] = String.fromCharCode(arr[i].charCodeAt(0) + 1);
        break;
      }
    }
    digits = (i < 0 ? '1' : '') + arr.join('');
  }
  const intLen = digits.length - precision;
  const out = precision ? `${digits.slice(0, intLen) || '0'}.${digits.slice(intLen)}` : digits;
  // Python mantém o sinal mesmo quando o resultado arredonda para zero.
  return neg ? `-${out}` : out;
}

/** `format_number`: milhar com ponto, decimal com vírgula; '' se inválido. */
export function formatNumber(value: unknown, precision = 0): string {
  let s = value == null ? '' : String(value);
  if (!s) s = '0';
  const n = Number(s.trim());
  if (!s.trim() || !Number.isFinite(n)) return '';
  const fixed = toFixedPy(n, precision);
  const neg = fixed.startsWith('-');
  const [i, d] = (neg ? fixed.slice(1) : fixed).split('.');
  const grouped = i.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${neg ? '-' : ''}${grouped}${d !== undefined ? `,${d}` : ''}`;
}

/** Python `f"{doc:0>N.N}"`: corta em N e completa com zeros à esquerda. */
const padTrunc = (s: string, n: number) => chars(s).slice(0, n).join('').padStart(n, '0');

/** CNPJ (inclusive alfanumérico) ou CPF com máscara; '' para vazio. */
export function formatCpfCnpj(doc: string): string {
  let d = (doc ?? '').replace(/[^0-9A-Za-z]/g, '').toUpperCase();
  if (!d) return d;
  if (d.length > 11) {
    d = padTrunc(d, 14);
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(-2)}`;
  }
  d = padTrunc(d.replace(/\D/g, ''), 11);
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/**
 * Telefone no formato nacional, como o `phonenumbers` faz para números do
 * Brasil: `(DD) NNNN-NNNN` ou `(DD) NNNNN-NNNN`. Outros formatos saem como
 * vieram (o original os formata no padrão internacional).
 */
export function formatPhone(phone: string): string {
  if (!phone) return '';
  let d = phone.replace(/\D/g, '');
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2);
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  return phone;
}

/** `get_date_utc`: "2026-10-28T13:48:38-03:00" → ["28/10/2026", "13:48:38"]. */
export function getDateUtc(value: string): [string, string] {
  const v = value ?? '';
  return [v.slice(0, 10).split('-').reverse().join('/'), v.slice(11, 19)];
}

/** Reticências quando o texto passa do limite de caracteres (NT 008/2026). */
export function ellipsize(text: string, limit: number): string {
  if (text && chars(text).length > limit) return `${chars(text).slice(0, limit).join('')}...`;
  return text;
}

export function joinParts(...parts: string[]): string {
  return parts.filter(Boolean).join(' / ') || '-';
}

/** Máscara de CEP da NT 008/2026 (nn.nnn-nnn). */
export function formatCepNt(cep: string): string {
  const d = (cep ?? '').replace(/\D/g, '');
  if (d.length === 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}-${d.slice(5)}`;
  return cep ?? '';
}
