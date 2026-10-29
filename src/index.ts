/**
 * danfse-nacional-ts — DANFSe v2.0 (NT 008/2026) da NFS-e Nacional a partir
 * do XML autorizado. Port em TypeScript do módulo DANFSe do BrazilFiscalReport
 * (Engenere, LGPL-3.0).
 */
import { parseDanfse, type DanfseData } from './parse';
import { DEFAULT_LOGO, renderDanfse } from './render';
import type { FontFiles } from './pdf';

export type { DanfseData, DanfsePerson } from './parse';
export type { FontFiles } from './pdf';

export interface DanfseOptions {
  /**
   * Situação da nota. O XML não muda quando a nota é cancelada ou
   * substituída (isso chega como evento), então quem chama informa:
   * `cancelada` e `substituida` imprimem a marca d'água (NT 008/2026, §2.5).
   */
  situacao?: 'normal' | 'cancelada' | 'substituida';
  /** Imprime o canhoto na base da página (item 2.1.13, opcional). Padrão: false. */
  canhoto?: boolean;
  /** Margens em mm. Padrão: 2 mm em cada lado (item 2.2.2). */
  margens?: { superior?: number; direita?: number; inferior?: number; esquerda?: number };
  /** Fonte padrão do PDF. Padrão: Helvetica (equivalente métrico da Arial). */
  fonte?: 'Helvetica' | 'Times' | 'Courier';
  /** TTFs próprios (caminho ou conteúdo), no lugar das fontes padrão. */
  fontes?: { normal: string | Buffer; negrito: string | Buffer };
  /** Logomarca do cabeçalho: caminho ou imagem; `false` não imprime. Padrão: logomarca oficial da NFS-e. */
  logo?: string | Buffer | false;
  /** Data de criação gravada no PDF (útil para saídas reprodutíveis). */
  dataCriacao?: Date;
}

/** Lê o XML da NFS-e e devolve os textos do DANFSe, já formatados. */
export function lerDanfse(xml: string | Uint8Array): DanfseData {
  return parseDanfse(xml);
}

/** Gera o PDF do DANFSe a partir do XML da NFS-e. */
export function gerarDanfse(xml: string | Uint8Array, options: DanfseOptions = {}): Promise<Buffer> {
  const m = options.margens ?? {};
  const fonts: FontFiles | undefined = options.fontes
    ? { normal: options.fontes.normal, bold: options.fontes.negrito }
    : undefined;
  return renderDanfse(parseDanfse(xml), {
    margins: { top: m.superior ?? 2, right: m.direita ?? 2, bottom: m.inferior ?? 2, left: m.esquerda ?? 2 },
    fontType: options.fonte ?? 'Helvetica',
    fonts,
    watermarkCancelled: options.situacao === 'cancelada',
    watermarkReplaced: options.situacao === 'substituida',
    displayCanhoto: options.canhoto ?? false,
    logo: options.logo === undefined ? DEFAULT_LOGO : options.logo,
    creationDate: options.dataCriacao,
  });
}
