# Previsão orçamentária do relatório final no padrão do print — handoff de 12/11/2026

Documento de passagem de contexto: **nenhuma linha de código de produção foi alterada.**
`main` @ `e3293f6`, `git status` limpo (fora o `docs/auditorias/IMPORTACAO-PRESTACAO-2026-11-12.md`,
que é de outro trabalho). Só removi arquivos de teste temporários que eu mesmo havia criado
(`domain/__tmp_debug*.test.ts`).

## O que o usuário pediu (na ordem em que veio)

1. **Tirar o demonstrativo do Systemar do relatório final.** Ao ver o PDF gerado, reclamou do bloco
   "Referência histórica importada do Systemar" (tabela de categorias de despesa com anual e
   média mês): *"não pedi para fazer esse demonstrativo no relatório final. é apenas para deixar
   salvo os dados, não quero esse relatório, pois acaba gerando uma redundância."*
2. **Mas os dados precisam continuar salvos** — o que sai é a impressão, não o campo
   `Exercicio.previsaoSugerida` nem o fluxo de importação/painel.
3. **Depois mandou o print da folha 7 do Systemar** ("PREVISÃO ORÇAMENTÁRIA ORDINÁRIA SUGERIDA
   PARA O EXERCÍCIO DE 2025/2026", condomínio Urban Classic) e pediu: *"preciso que o relatório
   final fique muito parecido com o atual. observe que ele traz o valor do ultimo rateio, ai faz o
   calculo do novo valor, e apresenta a variação percentual no relatório... não precisa inventar
   nada diferente do que está neste print... as informações que estão neste print só precisam ser
   essas, o relatório ainda tem a primeira folha... que em principio segue o padrão... mas esses
   dados precisamos manter o padrão."*
4. Por fim, sobre essa seção: **"deixa essa parte do relatório final igual ao print"**.

Leitura consolidada: a seção de previsão orçamentária do relatório final deve ser **uma só**, no
layout do print — começando pelo rateio atual (último valor cobrado), seguindo pela tabela de
despesas históricas, dedução, total ordinário, variação, rateio anual sugerido, rateio mensal
sugerido e índice sugerido. Não deve haver dois demonstrativos concorrentes.

## ⚠️ Ambiguidade que precisa ser decidida antes de codar

O usuário nunca disse explicitamente se o **cálculo do Krieger** (`rel.previsao`, a tabela
"Realizado × Média prevista dos grupos" com critérios/índices) **sai** ou **fica**.

- "as informações que estão neste print só precisam ser essas" + "acaba gerando uma redundância"
  sugere **sair**: sobra só a página no padrão do print.
- Mas `docs/DECISOES.md` (2026-11-08) registra o oposto como decisão durável: *"A previsão sugerida
  importada do Systemar continua como referência histórica e nunca substitui o cálculo do
  Krieger"*, e essa decisão foi tomada porque o relatório **divergia** dos menus de manutenção.

**Perguntar ao usuário antes de mexer.** Se a resposta for "sai", `docs/DECISOES.md` e
`docs/ESTADO-ATUAL.md` precisam de uma decisão nova que substitua a de 2026-11-08.

## Layout exato do print (a referência)

Ordem e rótulos, como aparecem na imagem:

```
                 PREVISÃO ORÇAMENTÁRIA ORDINÁRIA
                SUGERIDA PARA O EXERCÍCIO DE 2025/2026.

Valor total do rateio ordinário mensal utilizado atualmente
para obter os valores cobrados de condomínio ............ R$  45.206,00

Dados históricos das despesas ocorridas em 2024/2025 que
poderão servir como base para a previsão das despesas or-
dinárias do exercício de 2025/2026:

efetivamente realizado              no ano          média mês
Departamento pessoal .......... R$ 340.642,18     R$ 28.386,85
Administrativas e afins ....... R$  49.325,05     R$  4.110,42
Serviços essenciais ........... R$ 240.289,23     R$ 20.024,10
Seguro e extintores ........... R$   7.064,61     R$    588,72
Judiciais, cartório e taxas ... R$   7.450,06     R$    620,84
Manutenções ................... R$ 108.069,96     R$  9.005,83
Aquisições .................... R$  16.038,06     R$  1.336,50
Despesas com área de lazer .... R$   6.671,25     R$    555,94
Despesas diversas ............. R$     980,96     R$     81,75
Total das despesas do período . R$ 776.531,36     R$ 64.710,95

Despesas a deduzir (parte água e gás) ....... R$-215.592,88
Total de despesas consideradas ordinárias ... R$ 560.938,48
Variação de despesas sugeridas p/ 2025/26 ... R$  30.000,00
Sugestão de rateio anual ordinário .......... R$ 590.938,48
Sugestão de rateio mensal ordinário ......... R$  49.244,00
Índice sugerido para correção do condomínio .         8,93%

Itajaí, 31 de outubro de 2025.
```

Características visuais: fonte **monoespaçada** (tipo Courier), **pontilhado condutor** entre o
rótulo e o valor, valores alinhados à direita, título em duas linhas centralizado, local/data no
fim.

## O que já existe no código

### Dados — já lidos e calculados, nada a criar

- `domain/pdfParser.ts` — `lerPrevisaoSugerida()` (linha 638) devolve `PrevisaoSugeridaLida`
  (interface na 623) com **todos** os campos do print: `rateioMensalAtual`, `categorias[]`
  (`{nome, anual, media}`), `totalDespesasAno`, `totalDespesasMedia`, `deducao`,
  `totalOrdinario`, `variacaoSugerida`, `rateioAnualSugerido`, `rateioMensalSugerido`,
  `indiceSugerido`.
- `domain/previsaoSugerida.ts` — `calcularPrevisaoSugerida()` (linha 81) recalcula a mesma cadeia
  do print. `calcularPrevisaoSugeridaPorUnidade()` (fim do arquivo) é o quadro por unidade, que
  **não existe no print**.
- `domain/types.ts:281` — `PrevisaoSugeridaExercicio` (editável, salvo em
  `Exercicio.previsaoSugerida`).
- `domain/relatorioFinal.ts:299` — `montarRelatorioFinal` já entrega
  `previsaoSugerida` + `previsaoSugeridaPorUnidade` no `RelatorioFinal` (campos nas linhas 240–242).

**Conclusão: o print é 100% reproduzível com dados que já estão no exercício.** Não precisa de
migration, nem de campo novo, nem de leitura nova do PDF.

### Renderização — os dois lugares que mostram a seção

Ambos têm de mudar juntos (o projeto mantém prévia e documento espelhados):

| Arquivo | Seção previsão | Bloco "Referência histórica" | Função do quadro |
|---|---|---|---|
| `frontend/src/documentos/relatorioFinal.ts` | 147–257 | 258–282 | `blocosPrevisaoSugerida` 674–732 |
| `frontend/src/components/relatorio/PreviaRelatorio.tsx` | 169–319 | 320–335 | `PrevisaoSugeridaPrevia` 804–~890 |

Hoje o documento imprime, nesta ordem: título "Previsão orçamentária — Exercício {ano}", período,
origem da base, aviso de rateio aprovado, bloco `pares` com os critérios (`criteriosDaPrevisao`),
título "Despesas previstas por grupo", tabela Realizado × Média prevista, parágrafo, ajustes,
resumo (base/dedução/variação/anual/mensal/cota/reserva/rateio atual/índice/aprovado) e, por
último, o bloco "Referência histórica importada do Systemar" com a tabela de categorias, o resumo
e o quadro por unidade. **É isso que precisa virar o print.**

### Motor de documentos — o que falta para ficar "igual"

`frontend/src/lib/documento/tipos.ts` tem só estes blocos: `titulo`, `paragrafo`, `lista`,
`tabela`, `pares`, `imagem`, `espaco`, `quebraPagina`, `assinaturas`.

- **Pontilhado condutor não existe.** `pares` (tipos.ts:62–66) é uma tabela de 2 colunas sem
  borda, com a coluna do rótulo fixa em 150 pt (`pdf.ts:212`, `word.ts:302`). Para o pontilhado do
  print é preciso **bloco novo** (ex.: `tipo: "linhaGuiada"`) ou opção nova em `tabela`
  (padrão de preenchimento), implementada no PDF **e** no Word.
- **Fonte monoespaçada não existe.** O padrão é Source Sans 3 (`interface`) e o alternativo é
  Liberation Sans (`documento`, para cartório) — ver `frontend/src/lib/documento/fontes.ts`. Se
  "igual ao print" incluir o Courier, é preciso embutir mais uma família (subset + licença em
  `src/assets/fontes/README.md`), o que mexe no orçamento de bundle (`docs/PERFORMANCE.md`).
- O cabeçalho timbrado + número de página já existem (`pdf.ts:105` e `:143`) e batem com o print.

## Defeitos/divergências já encontrados (não corrigidos)

1. **Rateio mensal sugerido difere do print.** `calcularPrevisaoSugerida` faz
   `rateioMensalSugerido = centavos(totalFinal / 12)` → **49.244,87**; o print mostra
   **49.244,00** (truncado). O resto do sistema respeita `Exercicio.arredondamento` (padrão
   `"truncar"`, ver `domain/condominio.ts:57`) via `arredondarValor`, mas essa conta não aplica.
   Verifiquei a aritmética do print: 776.531,36 − 215.592,88 = 560.938,48; + 30.000 = 590.938,48;
   ÷ 12 = 49.244,87 → print 49.244,00. Índice 49.244,87/45.206,00 − 1 = 8,932% → print 8,93%
   (com o truncado dá 8,9324%, também 8,93% — o índice não muda, só o rateio exibido).
2. **O rótulo do rateio atual varia entre PDFs.** O print traz "Valor total do rateio ordinário
   mensal utilizado atualmente" (= total mensal do condomínio), mas um PDF real do Lago Negro traz
   "Valor cobrado atualmente por unidade (156 lotes) ... R$ 321,00" (= valor por unidade). O regex
   em `pdfParser.ts:670` só entende a primeira forma — no segundo caso `rateioMensalAtual` fica
   `null` e **não há índice**. Decidir: ler as duas variantes (e não comparar maçã com laranja) ou
   deixar explícito que só a primeira popula o índice.
3. **A notação de exercício "2025/2026" / "2024/2025" não existe no código.** O print usa ano
   fiscal cruzado; hoje o relatório só tem `Exercicio.ano` e o período
   `demonstrativo.periodo.ini/fim`. Precisa de um formatador (derivar de `periodo`, não do campo
   `ano`).
4. **O quadro "Previsão orçamentária por unidade" não está no print.** Vem de
   `calcularPrevisaoSugeridaPorUnidade` + checkbox `Exercicio.mostrarPrevisaoPorUnidade`
   (`domain/types.ts:430`). Se a seção ficar igual ao print, esse quadro sai da previsão sugerida
   (o checkbox continua valendo para o cálculo do Krieger, se ele ficar).
5. **CNPJ/nome:** no PDF do Lago Negro a linha `Condomínio: (243) - ... - CNPJ:` não existe e o
   fallback devolve `"Lago        Negro"` com espaços múltiplos. Registrado no handoff irmão
   `docs/auditorias/IMPORTACAO-PRESTACAO-2026-11-12.md`, não afeta este layout.

## Testes e docs que vão quebrar / precisam de ajuste

- `frontend/src/test/relatorioFinalPrevisaoCriterios.test.ts` — exige o bloco `pares` com
  "Modo da previsão"/"Método da variação"/"Arredondamento do valor por unidade" e a tabela com
  coluna "Média prevista dos grupos". Se a seção virar o print, **este teste é reescrito**, não
  deletado (ele guarda a decisão de 2026-11-08).
- `domain/previsaoSugerida.test.ts` e `frontend/src/test/previsaoSugerida.test.ts` — cobrem o
  cálculo; mudam se o arredondamento do rateio mensal for corrigido (item 1).
- `domain/pdfParser.consideracoes.test.ts` — cobre a leitura da folha (`rateioMensalAtual`,
  `deducao`, etc.); muda se o item 2 for tratado.
- `docs/DECISOES.md:112` — decisão de 2026-11-08 sobre a previsão sugerida; precisa de nova
  entrada se a seção for substituída.
- `docs/ESTADO-ATUAL.md` (~linha 2058 e a seção do checkbox de 30/10/2026) — descreve o bloco
  como parte do relatório final.
- `CHANGELOG.md` + versão, conforme `docs/VERSIONAMENTO.md`.

## Como reproduzir o PDF de referência

O texto do PDF real já foi extraído para
`C:/Users/Evandro/AppData/Local/Temp/krieger-pdf/layout.txt` (Lago Negro, 7 páginas, folha 7 ≈
linhas 148–182). O `itens.json` da mesma pasta alimenta `textoComLayout` + `lerRelatorio` em teste
(vitest), fora do navegador. Caminho do PDF original:
`OneDrive/Desktop/Arquivos/krieger/Condomínios/Lago Negro/Prestação de contas/balanço 2025.pdf`.

## Ordem de execução sugerida

1. **Confirmar com o usuário** a ambiguidade do topo (o cálculo do Krieger sai ou fica?).
2. Decidir o motor: pontilhado/fonte mono como bloco novo, ou aceitar `pares` sem pontilhado.
3. Reescrever a seção nos **dois** renderizadores (PDF/Word e prévia), com testes de documento.
4. Corrigir o arredondamento do rateio mensal sugerido (item 1).
5. Atualizar `docs/DECISOES.md`, `docs/ESTADO-ATUAL.md` e `CHANGELOG.md`.
