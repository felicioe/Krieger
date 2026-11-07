# Fontes dos documentos (PDF)

Família **Source Sans 3**, a mesma usada na interface (`--font-sans` em `src/styles.css`),
para o documento gerado não trocar de tipografia em relação à tela.

| Arquivo | Uso no PDF | Glifos |
| --- | --- | --- |
| `SourceSans3-Regular.ttf` | texto normal | 400 |
| `SourceSans3-SemiBold.ttf` | negrito e títulos | 600 |
| `SourceSans3-Italic.ttf` | trechos em itálico | 400 itálico |

## Origem

- Projeto: [Source Sans 3](https://github.com/adobe-fonts/source-sans), da Adobe.
- Licença: SIL Open Font License 1.1, texto integral em `OFL-SourceSans3.txt`.
- Download: arquivos estáticos do Google Fonts (`https://fonts.gstatic.com/s/sourcesans3/`),
  versão 20 da família, em novembro de 2026.

## Subsetação

Os arquivos aqui são subsets: contêm o latino completo (U+0020–U+017F) e os sinais que os
relatórios usam (R$, %, −, ×, ·, ÷, travessões, aspas, …, ±). Sem o subset cada face passa de
230 KB; com ele fica perto de 48 KB. O comando, com `fonttools` instalado:

```sh
python -m fontTools.subset --unicodes="U+0020-007E,U+00A0-017F,U+2010-2027,U+2030-205E,U+20A0-20BF,U+2113,U+2116-2117,U+2120-2122,U+2190-2193,U+2212,U+2215,U+2219-221A,U+221E,U+2248,U+2260,U+2264-2265,U+25A0,U+25CF,U+2713-2714,U+00B5,U+00D7,U+00F7,U+2126,U+0394,U+03A9" --layout-features="*" --glyph-names --symbol-cmap --legacy-cmap --notdef-glyph --notdef-outline --recommended-glyphs --name-IDs="*" --name-legacy --name-languages="*" --output-file="src/assets/fontes/SourceSans3-Regular.ttf" origem-400.ttf
```

Ao trocar qualquer face, repita para as três e confira com
`src/test/documentosLargura.test.ts`, que mede o texto real das tabelas nestes arquivos.
