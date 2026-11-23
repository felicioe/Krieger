# Auditoria Impeccable (`audit` + `adapt` + `optimize` + `clarify` + `distill`) — Krieger — 22/11/2026

## Escopo

Revisão técnica nas 5 dimensões complementares sobre `main` (`a201c71`) e pacote publicado (`deploy-hostinger` `e6edbd2`), sem repetir itens já entregues (`#351`–`#356`, `#366`, `#369`–`#385`).

## 18 pendências abertas por prioridade e corrigidas em 22/11/2026

| Pendência | Prioridade | Dimensão | Correção aplicada |
| :---: | :---: | :---: | :--- |
| `#386` | P1 | `optimize` | `garantirSessaoRecente(60_000)` em `lib/auth.ts` e `_authenticated.tsx` elimina a chamada HTTP bloqueante de sessão a cada navegação. |
| `#387` | P1 | `optimize` | `Promise.all` nos loaders de Condomínios e Atas; busca de `mensais` sob demanda em Prestação de contas (`atualizarPeloPeriodo`). |
| `#388` | P1 | `optimize` | `ParecerMarkdown` carregado com `React.lazy` na Consulta Inteligente e imports nomeados de `recharts` em `chart.tsx`. |
| `#389` | P1 | `audit` | Área de envio do Drive acionável por teclado (`role="button"`, `tabIndex`, `Enter`/`Space`) e `aria-label` em todos os campos e botões de ícone. |
| `#390` | P1 | `audit` | `<textarea>` da ata como filho direto de `<Field>`; removido botão `<X>` duplicado mudo em `PainelVariaveis`, rotulados filtro/cópia, ajustado contraste e `<h4>` → `<h3>`. |
| `#391` | P1 | `adapt` | `<RolagemTabela>` aplicada nas tabelas dos modais do Drive e na carga de previstos em Backup. |
| `#392` | P1 | `clarify` | Nomenclatura alinhada (`Previsão do rateio` em `ResumoImportacao` e `prestacao-contas.$id`; cartão interno renomeado para `Base prevista para relatórios`). |
| `#393` | P1 | `distill` | Cabeçalho de Prestação de contas enxugado agrupando ações secundárias em menu `Mais ações`. |
| `#394` | P2 | `audit` | `role="menu"` no menu de contexto do Drive; removido `<h1>` duplicado na capa de `PreviaRelatorio` e normalizados `<h4>` para `<h3>`. |
| `#395` | P2 | `adapt` | `flex-col sm:flex-row` nos modais do Drive, `w-full sm:w-56` em `Cargo na Assinatura` na Consulta IA e selo `Ctrl+/` restrito a `md:block`. |
| `#396` | P2 | `adapt` | `alvo-toque` e `max-md:min-h-11` aplicados nos botões nativos do Drive, Ajuda, `EditorConsideracoes` e `PainelPrevisaoSugerida`. |
| `#397` | P2 | `optimize` | `compararPrevistoRealizadoMensal` memoizado e sem execução duplicada em `orcado-realizado-mensal.tsx`; exportação calculada sob demanda. |
| `#398` | P2 | `optimize` | Removida serialização morta em `prestacao-contas.$id.tsx` e memoizadas validações de rateio em `condominios.$id.tsx`. |
| `#399` | P2 | `clarify` | Substituídos termos técnicos (`PDF inline`, `pop-ups`, `Layouts`) por linguagem contábil PT-BR e adicionada dica clara em `Expressão de busca`. |
| `#400` | P2 | `distill` | Unificado envio do Drive em botão `Enviar` com menu suspenso e compactada a área de soltar arquivos. |
| `#401` | P2 | `distill` | Cartão `Listagem de Condomínios` no Importador abre diretamente em diálogo e subtítulo inclui apólices de seguro. |
| `#402` | P3 | `optimize` | `staleTime` por perfil em `queries.ts` (5 min catálogos, 1 min listas) e invalidações restritas ao escopo alterado em Limpeza de Dados e Drive. |
| `#403` | P3 | `clarify` | Pluralização natural via `contagem()` em `ImportarApolice`, `ImportarListagemCondominios`, `ResumoImportacao` e `DialogoConferencia`. |
