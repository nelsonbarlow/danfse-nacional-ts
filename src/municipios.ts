/** Tabela de municípios do IBGE (código de 7 dígitos → nome e UF). */
import { readFileSync } from 'fs';
import path from 'path';
import { UF_CODE_TO_INITIALS } from './tables';

export const ASSETS_DIR = path.join(__dirname, '..', 'assets');

let table: Map<string, [string, string]> | null = null;

function load(): Map<string, [string, string]> {
  if (table) return table;
  table = new Map();
  const csv = readFileSync(path.join(ASSETS_DIR, 'municipios_ibge.csv'), 'utf8');
  for (const line of csv.split(/\r?\n/)) {
    if (!line) continue;
    const [code, name, uf] = line.split(';');
    table.set(code, [name, uf]);
  }
  return table;
}

/** Nome e UF do município pela tabela do IBGE; ['', ''] se não constar. */
export function municipioIbge(code: string): [string, string] {
  return load().get((code ?? '').trim()) ?? ['', ''];
}

/** UF derivada dos 2 primeiros dígitos do código IBGE do município. */
export function ufFromIbgeCode(code: string): string {
  return UF_CODE_TO_INITIALS[(code ?? '').slice(0, 2)] ?? '';
}
