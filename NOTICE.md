# Atribuição

Este pacote é uma obra derivada do módulo DANFSe do **BrazilFiscalReport**:

- Projeto: https://github.com/Engenere/BrazilFiscalReport
- Autores: Engenere e contribuidores do BrazilFiscalReport
- Licença: GNU Lesser General Public License v3.0
- Base do port: commit `5c33d0d153ee7c9a129b1295bb93ffa30e0a0eb8` (15/10/2026),
  arquivos `brazilfiscalreport/danfse/*`, `brazilfiscalreport/xfpdf.py`, `brazilfiscalreport/utils.py`
  e `brazilfiscalreport/generate_qrcode.py`.

A lógica de extração dos campos e o leiaute (coordenadas, alturas, textos fixos, regras de reticências e
de supressão de blocos) foram traduzidos de Python/fpdf2 para TypeScript/pdfkit. As primitivas do fpdf2
usadas pelo leiaute foram reproduzidas em `src/pdf.ts`.

Também vêm do projeto original, sem alteração:

- `test/fixtures/*.xml` — notas fictícias de teste;
- `test/reference/*.pdf` — PDFs gerados pelo original, usados como referência de paridade;
- `assets/municipios_ibge.csv` — tabela de municípios, a partir de dados públicos do IBGE;
- `assets/nfse_logo.png` — logomarca oficial da NFS-e, publicada pelo Comitê Gestor da NFS-e. A marca é do
  governo; a licença deste pacote vale para o código, não para ela.

Este pacote é distribuído sob a mesma licença (LGPL-3.0, ver `LICENSE`).
