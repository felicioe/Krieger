# Fontes dos documentos (PDF)

Duas famílias, escolhidas por documento no campo `Documento.fonte`:

| Família                                                      | Uso                                                        | Arquivos               |
| ------------------------------------------------------------ | ---------------------------------------------------------- | ---------------------- |
| **Source Sans 3** (padrão, `fonte` ausente ou `"interface"`) | edital, relatórios, previsto × realizado, presença, mensal | `SourceSans3-*.ttf`    |
| **Liberation Sans** (`fonte: "documento"`)                   | modelos de ata de cartório, corpo 12 pt                    | `LiberationSans-*.ttf` |

A Source Sans 3 é a mesma da interface (`--font-sans` em `src/styles.css`), para o
documento não trocar de tipografia em relação à tela. A Liberation Sans é
metricamente compatível com a **Arial**, que é o que o cartório usa: o mesmo texto
ocupa a mesma largura, então a ata gerada aqui abre igual no Word/PDF de quem não
tem a fonte instalada.

## Origem — Source Sans 3

- Projeto: [Source Sans 3](https://github.com/adobe-fonts/source-sans), da Adobe.
- Licença: SIL Open Font License 1.1, texto integral em `OFL-SourceSans3.txt`.
- Download: arquivos estáticos do Google Fonts (`https://fonts.gstatic.com/s/sourcesans3/`),
  versão 20 da família, em novembro de 2026.
- Faces: `SourceSans3-Regular.ttf` (400), `SourceSans3-SemiBold.ttf` (600, negrito e
  títulos), `SourceSans3-Italic.ttf` (400 itálico).

## Origem — Liberation Sans

- Projeto: [Liberation Fonts](https://github.com/liberationfonts/liberation-fonts), de
  Red Hat, Inc. `LIBERATION` é marca registrada da Red Hat.
- Licença: **GPL v2 com a exceção de fonte da Red Hat** (não é SIL OFL). Embutir a
  fonte sem modificação em um documento — inclusive um PDF gerado — não submete esse
  documento à GPL. Texto e links em `LICENSE-LiberationSans.txt`.
- Origem dos arquivos: `node_modules/pdfjs-dist/standard_fonts/` (pacote do Mozilla
  pdf.js, em Apache-2.0; a fonte mantém a próprias licença). Copiados verbatim.
- Faces: `LiberationSans-Regular.ttf`, `-Bold.ttf`, `-Italic.ttf`, `-BoldItalic.ttf`.
  Diferente da Source Sans 3, a Liberation tem a face de negrito em itálico de verdade;
  o `bolditalics` do PDF aponta para ela.

## Subsetação

Os arquivos aqui são subsets: contêm o latino completo (U+0020–U+017F) e os sinais que os
relatórios usam (R$, %, −, ×, ·, ÷, travessões, aspas, …, ±). Sem o subset cada face passa de
230 KB; com ele fica perto de 48 KB. O comando, com `fonttools` instalado:

```sh
python -m fontTools.subset --unicodes="U+0020-007E,U+00A0-017F,U+2010-2027,U+2030-205E,U+20A0-20BF,U+2113,U+2116-2117,U+2120-2122,U+2190-2193,U+2212,U+2215,U+2219-221A,U+221E,U+2248,U+2260,U+2264-2265,U+25A0,U+25CF,U+2713-2714,U+00B5,U+00D7,U+00F7,U+2126,U+0394,U+03A9" --layout-features="*" --glyph-names --symbol-cmap --legacy-cmap --notdef-glyph --notdef-outline --recommended-glyphs --name-IDs="*" --name-legacy --name-languages="*" --output-file="src/assets/fontes/SourceSans3-Regular.ttf" origem-400.ttf
```

Repita para cada face (as da Liberation são mais gordas: ficam entre 65 e 95 KB
subsetadas). Ao trocar qualquer face, confira com `src/test/documentosLargura.test.ts`,
que mede o texto real das tabelas nestes arquivos.

## Como entram no PDF

`frontend/src/lib/documento/fontes.ts` embute as faces como base64 (`import ?inline`):
sem requisição de rede e sem o VFS do Roboto do pdfmake (~454 KB gzip). A família
Source Sans 3 é registrada sempre; as quatro faces da Liberation entram por
`import()` dinâmico, então edital e relatórios não baixam esses bytes — só a ata de
cartório, que pede `fonte: "documento"`.

No `.docx` não há fonte embutida: o Word procura a família **pelo nome**. Por isso o
Word usa `Arial` para a ata (equivalente métrica da Liberation, presente em qualquer
Windows/Office) e `Calibri` para o resto — ver `tipografia.ts`.
