/** Domínios de códigos e textos fixos do DANFSe (NT 008/2026). */

export const UF_CODE_TO_INITIALS: Record<string, string> = {
  '11': 'RO', '12': 'AC', '13': 'AM', '14': 'RR', '15': 'PA', '16': 'AP', '17': 'TO',
  '21': 'MA', '22': 'PI', '23': 'CE', '24': 'RN', '25': 'PB', '26': 'PE', '27': 'AL', '28': 'SE', '29': 'BA',
  '31': 'MG', '32': 'ES', '33': 'RJ', '35': 'SP',
  '41': 'PR', '42': 'SC', '43': 'RS',
  '50': 'MS', '51': 'MT', '52': 'GO', '53': 'DF',
};

export const TP_EMIT: Record<string, string> = {
  '1': 'Prestador',
  '2': 'Tomador',
  '3': 'Intermediário',
};

export const AMB_GER: Record<string, string> = {
  '1': 'Sistema Próprio do Município',
  '2': 'Sefin Nacional NFS-e',
};

export const TP_AMB: Record<string, string> = {
  '1': 'Produção',
  '2': 'Homologação',
};

export const C_STAT: Record<string, string> = {
  '100': 'NFS-e Gerada',
  '101': 'NFS-e de Substituição Gerada',
  '102': 'NFS-e de Decisão Judicial ou Administrativa',
  '103': 'NFS-e Avulsa',
  '107': 'NFS-e MEI',
};

export const FIN_NFSE: Record<string, string> = {
  '0': 'NFS-e regular',
  '1': 'NFS-e de crédito',
  '2': 'NFS-e de débito',
};

export const TRIB_ISSQN: Record<string, string> = {
  '1': 'Operação Tributável',
  '2': 'Imunidade',
  '3': 'Exportação de serviço',
  '4': 'Não Incidência',
};

export const TP_IMUNIDADE: Record<string, string> = {
  '0': 'Imunidade (tipo não informado na nota de origem)',
  '1': 'Patrimônio, renda ou serviços, uns dos outros (CF88, Art 150, VI, a)',
  '2': 'Templos de qualquer culto (CF88, Art 150, VI, b)',
  '3':
    'Patrimônio, renda ou serviços dos partidos políticos, inclusive ' +
    'suas fundações, das entidades sindicais dos trabalhadores, das ' +
    'instituições de educação e de assistência social, sem fins ' +
    'lucrativos, atendidos os requisitos da lei (CF88, Art 150, VI, c)',
  '4': 'Livros, jornais, periódicos e o papel destinado a sua impressão (CF88, Art 150, VI, d)',
  '5':
    'Fonogramas e videofonogramas musicais produzidos no Brasil ' +
    'contendo obras musicais ou literomusicais de autores brasileiros ' +
    'e/ou obras em geral interpretadas por artistas brasileiros bem ' +
    'como os suportes materiais ou arquivos digitais que os contenham ' +
    '(CF88, Art 150, VI, e)',
};

export const TP_SUSP: Record<string, string> = {
  '1': 'Exigibilidade Suspensa por Decisão Judicial',
  '2': 'Exigibilidade Suspensa por Processo Administrativo',
};

export const TP_RET_ISSQN: Record<string, string> = {
  '1': 'Não Retido',
  '2': 'Retido pelo Tomador',
  '3': 'Retido pelo Intermediário',
};

/** Domínio de tpRetPisCofins conforme NT 007/2026 (códigos 0 a 9). */
export const TP_RET_PIS_COFINS: Record<string, string> = {
  '0': 'PIS/COFINS/CSLL Não Retidos',
  '1': 'PIS/COFINS Retido',
  '2': 'PIS/COFINS Não Retido',
  '3': 'PIS/COFINS/CSLL Retidos',
  '4': 'PIS/COFINS Retidos, CSLL Não Retido',
  '5': 'PIS Retido, COFINS/CSLL Não Retido',
  '6': 'COFINS Retido, PIS/CSLL Não Retido',
  '7': 'PIS Não Retido, COFINS/CSLL Retidos',
  '8': 'PIS/COFINS Não Retidos, CSLL Retido',
  '9': 'COFINS Não Retido, PIS/CSLL Retidos',
};

export const SIMPLES_OP: Record<string, string> = {
  '1': 'Não Optante',
  '2': 'Optante - Microempreendedor Individual (MEI)',
  '3': 'Optante - Microempresa ou Empresa de Pequeno Porte (ME/EPP)',
};

export const REG_AP_TRIB_SN: Record<string, string> = {
  '1': 'Regime de apuração dos tributos federais e municipal pelo Simples Nacional',
  '2':
    'Regime de apuração dos tributos federais pelo SN e o ISSQN ' +
    'pela NFS-e conforme respectiva legislação municipal do tributo',
  '3':
    'Regime de apuração dos tributos federais e municipal pela ' +
    'NFS-e conforme respectivas legislações federal e municipal ' +
    'de cada tributo',
};

export const REG_ESP_TRIB: Record<string, string> = {
  '0': 'Nenhum',
  '1': 'Ato Cooperado (Cooperativa)',
  '2': 'Estimativa',
  '3': 'Microempresa Municipal',
  '4': 'Notário ou Registrador',
  '5': 'Profissional Autônomo',
  '6': 'Sociedade de Profissionais',
  '9': 'Outros',
};

export const TXT_TAKER_NOT_IDENTIFIED = 'TOMADOR/ADQUIRENTE DA OPERAÇÃO NÃO IDENTIFICADO NA NFS-e';
export const TXT_DEST_NOT_IDENTIFIED = 'DESTINATÁRIO DA OPERAÇÃO NÃO IDENTIFICADO NA NFS-e';
export const TXT_DEST_IS_TAKER = 'O DESTINATÁRIO É O PRÓPRIO TOMADOR/ADQUIRENTE DA OPERAÇÃO';
export const TXT_INTERM_NOT_IDENTIFIED = 'INTERMEDIÁRIO DA OPERAÇÃO NÃO IDENTIFICADO NA NFS-e';
export const TXT_NO_ISSQN = 'TRIBUTAÇÃO MUNICIPAL (ISSQN) - OPERAÇÃO NÃO SUJEITA AO ISSQN';
export const TXT_NO_LEGAL_VALIDITY = 'NFS-e SEM VALIDADE JURÍDICA';
export const TXT_QR_CODE =
  'A autenticidade desta NFS-e pode ser verificada pela leitura ' +
  'deste código QR ou pela consulta da chave de acesso no portal ' +
  'nacional da NFS-e';
