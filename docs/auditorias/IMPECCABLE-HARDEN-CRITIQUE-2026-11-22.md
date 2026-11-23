# Auditoria Impeccable (`harden` + `critique`) — Krieger — 22/11/2026

## Escopo e validações

Revisão técnica estática aprofundada de **robustez/resiliência (`harden`)** e **design/experiência de uso (`critique`)** sobre `main` (`23bebf2`) e pacote publicado em produção (`deploy-hostinger` `91bec34`). Exclui as pendências já abertas no GitHub (`#351`–`#356` e `#364`). Não constitui certificação WCAG nem substitui testes visuais/leitor de tela no navegador.

- **Nota de usabilidade (`critique`)**: `26 / 40` (10 heurísticas).
- **Testes de domínio**: `458 / 458` (52 arquivos).
- **Verificação de tipos (`frontend`)**: `0` erros.
- **Orçamento de pacote publicado**: `167.745 / 256.000 bytes` (`65,5%`, folga de `88.255 bytes`).

## Achados abertos por prioridade e correções aplicadas em 22/11/2026

Todas as 15 pendências (`#369`–`#383`) foram abertas por prioridade e corrigidas na mesma entrega:

| Pendência | Prioridade | Tema | Correção aplicada |
| :---: | :---: | :--- | :--- |
| `#369` | P1 | Exclusão sem confirmação no Drive e Modelos de Ata | `ConfirmDialog` destrutivo exibindo nome do arquivo/modelo em `_authenticated.drive-documentos.tsx` e `_authenticated.modelos-ata.$id.tsx`. |
| `#370` | P1 | `return notFound()` inválido e erro de rede em Modelos de Ata | `throw notFound()` no `loader`, `notFoundComponent` amigável e alerta de erro com botão "Tentar novamente". |
| `#371` | P1 | Permissões granulares ignoradas em escrita e envio via Enter | `permissao` aplicada em Importações, Backup, Modelos de Ata e Escritório; guarda de `onSubmit` em Condomínio e Escritório; `podeConsultar` no visualizador do Drive. |
| `#372` | P1 | Limpeza de Dados: confirmação, backup e total | Confirmação por digitação (`APAGAR TUDO`), link direto para `/backup` com data do último backup e inclusão de `modelos_ata` em `totalCadastrosOperacionais`. |
| `#373` | P2 | Erro de carregamento mascarado como lista vazia no Drive e Consulta IA | Alerta destrutivo com botão "Tentar novamente" ao falhar `docsQuery`, `docsDoCondominioQuery` ou `historico`. |
| `#374` | P2 | Perda de alterações não salvas | `useBlocker` + `enableBeforeUnload` adicionados em Condomínio, Escritório e Modelo de Ata. |
| `#375` | P2 | Modais extensos cortados em telas menores | `max-h-[90vh] max-w-[calc(100vw-2rem)] overflow-y-auto` em `DialogContent` (`dialog.tsx`). |
| `#376` | P2 | Corrida no visualizador PDF, vazamento de URL e pop-up silencioso | Sequenciador de requisição ativa no visualizador do Drive; `opener = null`, `URL.revokeObjectURL` e retorno `boolean` com aviso de pop-up bloqueado em `imprimirPdfBase64`. |
| `#377` | P2 | Sobrecarga de ações na primeira dobra do Drive | Agrupamento de configurações em menu `Configurar` e remoção de botões duplicados na área de soltar arquivos. |
| `#378` | P2 | Filtros sem busca e `Mês 1..12` em relatórios | `<SelecaoBusca>` com recentes em `Previsto × Realizado` e `Orçado × Realizado Mensal`, além de rótulos reais de competência. |
| `#379` | P2 | Consolidado sem navegação direta e motivo só em `title` | Link direto para o condomínio na coluna e exibição visível de `l.motivo` abaixo da situação. |
| `#380` | P2 | Jargões técnicos, `(s)` mecânico e emojis fora do padrão | Linguagem contábil clara, `contagem()` e ícones Lucide em Consulta IA, Drive, Limpeza, Usuários, Backup e Condomínio. |
| `#381` | P3 | Menu de contexto do Drive e trava de clique duplo | Contenção segura nas bordas da tela, fechamento por `Escape` e trava `baixandoDocId` em downloads/impressão. |
| `#382` | P3 | Central de Ajuda dessincronizada | Índice e Visão geral alinhados aos grupos atuais de `AppSidebar.tsx`, com seções de Relatório final, Previsto × Realizado por mês e Consulta Inteligente. |
| `#383` | P3 | Inconsistências pontuais em Relatórios e Usuários | `size-6` removido e `disabled={e.fechado}` em `secao-pizza`; `<PageHeader>` em estados vazios; `<Alert>` para exercício fechado; bloqueio de autoexclusão e agrupamento/filtro por módulo em `DialogPermissoes`. |
