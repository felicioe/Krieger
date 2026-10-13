# Importador de relatórios (Systemar) – especificação

Módulo `parser.mjs`: recebe o texto do PDF (layout preservado) e o nome do arquivo e devolve JSON padronizado.
Teste: `node testar.mjs arquivo.pdf ...` (usa `pdftotext -layout`).

## Layouts reconhecidos
| Layout | Exemplo | Identificação | Particularidades |
|---|---|---|---|
| `dre_simples` | 032, 073, 167 | Nome do condomínio no topo + "Demonstrativo de Receitas e Despesas" | Grupos em MAIÚSCULAS; um valor por linha |
| `demonstrativo_hierarquico` | 314 | "Demonstrativo" sem nome + "ORIGEM DOS RECURSOS" | Grupos com subtotal; **sem nome nem CNPJ** (só o código no arquivo) |
| `comparativo` | 302 | "Comparativo Financeiro de MM/AAAA a MM/AAAA" | Uma coluna por mês + Total + Média; traz código, nome e CNPJ |

## Identificação do condomínio
1. Código: `(NNN)` do cabeçalho ou os dígitos iniciais do nome do arquivo (`073_092026 - ...`).
2. Nome: cabeçalho do relatório (ausente no layout hierárquico).
3. CNPJ: só no comparativo.
O sufixo `092026` do nome do arquivo é a data de emissão, não o período; o período vem do texto do PDF.

## Cadastro automático
`cadastroBasico(rel)` devolve `{codigo, nome, cnpj, contas, revisar}`. `revisar=true` quando falta nome ou CNPJ, para o usuário completar antes de confirmar.

## Conferência
Nos layouts de período único, a soma dos itens é comparada com o total impresso no PDF (`conferencia`). Divergência indica linha não lida.

## Tabela transitória (staging) – `kr_importacoes`
Fluxo ao importar um PDF de condomínio **não cadastrado**:
1. O PDF é lido (`lerRelatorio`) e o resultado é salvo em `kr_importacoes` com `status: "pendente"` (store `importacoes`, pela API: `salvar`).
   Formato do registro: `{ id, status, arquivo, importadoEm, relatorio: <JSON do parser>, cadastro: cadastroBasico(), condominioId: null }`.
2. A tela mostra a confirmação com os dados do cadastro básico (editáveis; campos faltando em destaque).
3. Ao confirmar: cria o condomínio em `kr_condominios`, grava o relatório em `kr_mensais`/`kr_exercicios` e muda o staging para `confirmado` (com `condominioId`).
4. Ao cancelar: `descartado`. Pendentes ficam listados para retomar depois (`listar` + filtro por status).
Se o condomínio **já existe** (mesmo código ou CNPJ), o relatório segue direto, sem passar pelo staging.
