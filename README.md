# danfse-nacional-ts

Gera o **DANFSe v2.0** (PDF) da **NFS-e Nacional** a partir do XML autorizado, em Node.js/TypeScript,
conforme a [Nota Técnica SE/CGNFS-e nº 008/2026](https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica).

É um **port** do módulo DANFSe do [BrazilFiscalReport](https://github.com/Engenere/BrazilFiscalReport)
(Python, Engenere), o gerador de documentos fiscais brasileiros com mais tempo de estrada e mais testes.
A geração é **verificada contra os PDFs de referência do projeto original**: para cada caso de teste dele,
este pacote produz exatamente os mesmos textos, nas mesmas posições (tolerância de 0,05 mm).

Por que existe: a API pública que devolvia o DANFSe pronto (`adn.nfse.gov.br/danfse/{chave}`) deixou de
responder para sistemas emissores, e quem emite direto na Sefin Nacional precisa gerar o documento auxiliar
por conta própria. O XML é o documento fiscal; o DANFSe é só a representação impressa dele.

- **XML entra, PDF sai.** Sem certificado, sem rede, sem navegador headless.
- **Leiaute da NT 008/2026:** A4 retrato, página única, grade do Anexo I, QR Code de consulta pública,
  blocos resumidos quando não há tomador, destinatário, intermediário ou ISSQN, aviso de homologação,
  marca d'água de **CANCELADA** / **SUBSTITUÍDA** e canhoto opcional.
- **Reforma tributária:** bloco IBS/CBS com as somas da NT.
- **CNPJ alfanumérico** e tabela de municípios do IBGE (nome e UF do tomador a partir do código).
- Dependências: `pdfkit`, `qrcode` e `@xmldom/xmldom`.

## Instalação

```bash
npm install github:nelsonbarlow/danfse-nacional-ts
```

Node.js 20 ou mais novo.

## Uso

```ts
import { readFileSync, writeFileSync } from 'fs';
import { gerarDanfse } from 'danfse-nacional-ts';

const xml = readFileSync('nota.xml');
const pdf = await gerarDanfse(xml); // Buffer
writeFileSync('nota.pdf', pdf);
```

### Opções

```ts
await gerarDanfse(xml, {
  situacao: 'cancelada', // 'normal' (padrão) | 'cancelada' | 'substituida' → marca d'água
  canhoto: true,         // padrão false
  margens: { superior: 2, direita: 2, inferior: 2, esquerda: 2 }, // mm (padrão 2)
  fonte: 'Helvetica',    // 'Helvetica' (padrão, métrica da Arial) | 'Times' | 'Courier'
  fontes: { normal: 'arial.ttf', negrito: 'arialbd.ttf' }, // TTF próprios (opcional)
  logo: false,           // padrão: logomarca oficial da NFS-e; caminho/Buffer troca; false tira
  dataCriacao: new Date(0), // grava uma data fixa no PDF (saída reprodutível)
});
```

**Por que a situação é uma opção?** O XML da NFS-e não muda quando a nota é cancelada ou substituída:
isso chega como um evento separado. Quem chama sabe a situação e a informa aqui.

### Só os dados

```ts
import { lerDanfse } from 'danfse-nacional-ts';

const nota = lerDanfse(xml);
nota.keyNfse;            // '2611606226598927800018900000000000152610...'
nota.totalValue.netValue; // 'R$ 699,00'
nota.taker?.city;         // 'João Pessoa / PB'
```

Os textos já saem formatados (máscaras, descrições dos códigos, somas e reticências da NT), para quem
quiser montar o próprio leiaute (HTML, e-mail, tela).

## Diferenças em relação ao DANFSe do portal

O pacote segue o original, que segue o texto da NT. O DANFSe que o portal nacional gera tem algumas
convenções próprias que não estão na NT:

| Campo | Portal | Este pacote |
|---|---|---|
| Código IBGE | `26.11606` | `2611606` |
| Município no cabeçalho | `Recife - PE` | `Recife / PE` |
| Ambiente gerador / tipo de ambiente | código (`2`, `1`) | descrição (`Sefin Nacional NFS-e`, `Produção`) |
| Destinatário quando é o próprio tomador | "não identificado" | "é o próprio tomador/adquirente" (Notas 2 e 3) |
| QR Code | — | mesma URL; o desenho dos módulos pode variar (máscara do QR) |

Os dados de todos os campos são os mesmos.

## Desenvolvimento

```bash
npm install
npm test        # paridade com os PDFs de referência + unidades
npm run build
```

Os XMLs em `test/fixtures/` e os PDFs em `test/reference/` vêm do projeto original e são **notas
fictícias**. Não adicione XML de nota real.

Correções de leiaute devem, idealmente, ir primeiro para o
[BrazilFiscalReport](https://github.com/Engenere/BrazilFiscalReport) e depois ser trazidas para cá,
com os PDFs de referência atualizados.

## Licença

[LGPL-3.0](LICENSE), a mesma do projeto original, do qual este é obra derivada. Veja [NOTICE.md](NOTICE.md)
para a atribuição e os componentes de terceiros (logomarca oficial da NFS-e, tabela de municípios do IBGE).

Não é um produto oficial da Receita Federal nem do Comitê Gestor da NFS-e.
