# Importação da prestação de contas — diagnóstico em 12/11/2026

Documento de passagem de contexto: o trabalho foi interrompido no diagnóstico, **nenhuma
linha de código de produção foi alterada** (só testes temporários, já removidos; `git status`
limpo em `main` @ `e3293f6`).

## Pedidos do usuário

1. **Corrigir** o erro na importação da prestação de contas (reimportação acusando 77
   contas diferentes do PDF).
2. **Adicionar um botão de confirmar todos** no diálogo de divergências — decidir 77 itens um
   a um é inviável ("podemos esquecer algo").

## O que foi verificado com o PDF real

Arquivo do usuário: `OneDrive/Desktop/Arquivos/krieger/Condomínios/Lago Negro/Prestação de contas/balanço 2025.pdf`
(7 páginas, layout `dre_simples` do Systemar, "Demonstrativo Geral Encerrado em 30/11/2025").

Pipeline testado fora do navegador, reproduzindo exatamente o que o app faz
(`pdfjs-dist` → `textoComLayout` → `lerRelatorio` → `demonstrativoDoRelatorio`):

- **O parser lê o arquivo corretamente.** Conferência automática: os quatro totais fecham
  (`saldoAnterior` 122.778,61 · `receitas` 942.450,57 · `despesas` 851.955,11 ·
  `saldoAtual` 213.274,07), 2 contas de saldo anterior, 19 receitas, 53 despesas em 10 grupos,
  saldo atual com 3 contas.
- `lerPrevisaoSugerida` e `lerConsideracoesFinais` também saem certos (dedução −189.700,00,
  rateio mensal 57.687,00, seguro Tokio 3.000.000,00, índices 2021–2024).
- Dois defeitos menores confirmados nesse layout:
  - **nome do condomínio**: o PDF não tem a linha `Condomínio: (243) - ... - CNPJ:`; o
    fallback pega a capa e devolve `"Lago        Negro"` (espaços múltiplos) em
    `rel.condominio.nome` e em `cadastroBasico().nome`. `codigo` e `cnpj` ficam `null` — o
    CNPJ existe no sistema (19.741.383/0001-87) e no comparativo, mas não neste arquivo.
  - por isso `encontrarCondominio` cai na comparação por nome; depende de `chaveNome`
    colapsar espaços (não confirmei).

## Origem dos valores "gravados" do diálogo (importante)

As três contas do print (6.723,04 · 87.373,51 · 113.398,82) **não existem em nenhum balanço**.
Elas são a **coluna 11/2025 (primeiro mês) do comparativo**
`Lago Negro/243_112026 - comparativo.pdf`, seção `( * ) SALDO ANTERIOR`:

```
Sicoob S/A - Conta corrente      6.723,04   6.295,97  ...
Sicoob S/A - Conta aplicação    87.373,51  92.629,31  ...
Aplicação (fundo de reserva)   113.398,82 114.348,79  ...
```

E a coluna 12/2025 do comparativo (6.295,97 · 92.629,31 · 114.348,79) é exatamente o
`( = ) SALDO ATUAL` do balanço 2025 — os dois relatórios são coerentes entre si.

Ou seja: o demonstrativo gravado do exercício 2025 **veio do comparativo** (que em
`domain/importacao.ts` usa `saldoAnterior` = primeiro mês e `saldoAtual` = último mês, por
desenho), não do balanço. As 77 divergências incluem ainda despesas em que o lado gravado é
`null` ("Não incluir este item"), o que indica que o gravado **não tem a seção de despesas
completa** daquele exercício.

## Hipóteses de causa raiz (não confirmadas — é aqui que o trabalho para)

1. **`demonstrativoDoPeriodo` sobrescreve o demonstrativo na tela e no Salvar**
   (`frontend/src/domain/demonstrativoDinamico.ts`, chamado em
   `frontend/src/routes/_authenticated.prestacao-contas.$id.tsx:101-107`). Quando existem
   relatórios mensais dentro do período, a função **descarta** `receitas`/`despesas` do
   demonstrativo salvo e monta a soma dos mensais, e reescreve `saldoAnterior`/`saldoAtual` com
   o primeiro/último mensal. Se o exercício foi salvo com essa versão consolidada, o PDF
   original se perde. Os mensais importados do comparativo (11/2025–10/2026) caem no período do
   exercício 2025? **Verificar** — `mesesNoPeriodo`/`ordemCompetencia` filtram por competência.
2. **O conflito compara contra o demonstrativo SALVO, mas a tela edita o CONSOLIDADO.**
   `ImportarPdf` recebe `demonstrativoAtual={e.demonstrativo}` (salvo) em
   `_authenticated.prestacao-contas.$id.tsx:228`, enquanto `EditorDemonstrativo` mostra
   `demonstrativo` (consolidado, linha 374). Duas referências diferentes para a mesma tela.
3. **Depois de aplicar o PDF, o memo reconsolida.** `aoAplicar` faz
   `mudar({ demonstrativo: r.demonstrativo })` (linha 232), mas o `useMemo` das linhas 101-107
   roda de novo sobre o demonstrativo recém-importado e, havendo mensais, substitui receitas e
   despesas pela soma dos meses — a importação parece não ter efeito. A trava de conferência
   (`useTravaImportacao.marcarImportado`) guarda o PDF, então o Salvar compara PDF × consolidado
   e pode acusar divergência por conta disso também.

Nada disso foi provado com dados do servidor: **falta olhar o `demonstrativo` gravado do
exercício** (`api.php` store `exercicios`, id da URL `#/prestacao-contas/nwdleg2agutcb4gw`) e os
`mensais` do condomínio Lago Negro para saber qual das três é a causa.

## Segundo pedido — botão "confirmar todos"

Ponto de atuação único: `frontend/src/components/importacao/ConflitoImportacao.tsx`.

- estado: `escolhas: Record<string, "manter" | "atualizar">` (linha 160), chave por
  `chaveItem(i)` = `secao::grupo::nome::ocorrencia` (linha 36);
- `todasFeitas` (linha 166) desabilita "Confirmar e aplicar" até haver escolha em todos;
- rodapé nas linhas 233-245.

Sugestão de implementação:
- dois botões/ações no topo da lista — **"Manter todos os gravados"** e **"Usar todos do PDF"**
  (preenchem `escolhas` para todos os itens, ainda permitindo ajuste individual por cima);
- opcional: resumo "12 manter · 65 do PDF" e, no texto do rodapé, o que ainda falta decidir;
- manter a regra atual de não pré-marcar nada ao abrir (decisão registrada no PR #124);
- cobertura de teste em `frontend/src/test/importacao-ui.test.tsx` (já importa
  `persistirDecisaoConflito` de `ConflitoImportacao`); o diálogo em si não tem teste hoje.

## Arquivos-chave

| Arquivo | Papel |
| --- | --- |
| `domain/pdfParser.ts` | leitura do texto do PDF (ok para este arquivo) |
| `domain/layoutTexto.ts` | reconstrução do layout a partir dos itens do pdf.js |
| `frontend/src/lib/pdfTexto.ts` | extração no navegador |
| `domain/importacao.ts` | `demonstrativoDoRelatorio`, `compararDemonstrativos:469`, `comparaItens:434`, `aplicarDecisoesImportacao:495` |
| `domain/demonstrativoDinamico.ts` | consolidação pelos mensais — **suspeita principal** |
| `frontend/src/routes/_authenticated.prestacao-contas.$id.tsx` | tela do exercício (linhas 101-107, 223-246, 373-374) |
| `frontend/src/components/importacao/ConflitoImportacao.tsx` | diálogo das divergências (botão novo) |
| `frontend/src/components/importacao/useTravaImportacao.ts` | trava dos totais no Salvar |
