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
