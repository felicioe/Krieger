# Revisão e correção dos achados pendentes — 22/10/2026

Pedido: corrigir os erros encontrados e publicar. Base main b497cbe, produção
main 3dbeaad/deploy bfde51c. Frontend exclusivamente Lovable; Codex valida,
sincroniza, documenta e publica via conector Hostinger. Não alterar cálculos,
permissões ou funcionalidades concorrentes por hipótese de auditoria.

## Triagem antes das novas correções

| Issue | Situação observada | Encaminhamento |
|---|---|---|
| #82 | Overflow 320 px/texto 200% relatado pelo Lovable; viewport normal 320 sem overflow | Reproduzir e corrigir no Lovable, sem ocultar conteúdo globalmente |
| #65 | npm audit real: Vite 8.1.5, uma dependência vulnerável, cinco avisos, máximo alto | Atualização compatível pelo Lovable, lock e validações completas |
| #59 | Input publicado usa control OKLCH(.62 .03 252), 3,63:1 no branco; estados/tokens em frontend/docs/CONTRASTE.md | Correção já existente; confirmar regressões e registrar encerramento |
| #60 | Avisos de unidades/variação e resultado parcial já integrados; fixtures em auditoria-ux.test.tsx | Validar suíte e integração, sem alterar regra de cálculo |
| #61 | Novo condomínio publicado: essencial aberto, avançadas recolhíveis, ajuda de rubricas e de-para | Enter/Espaço e ajuda conferidos; nenhuma gravação |
| #62 | Navegação agrupada e textos naturais presentes; contagem/tempo cobertos por teste | Registrar validação do que já foi entregue |
| #31 | Dicas/obrigatoriedade corrigidas; senha publicada tem três aria-required e dica “Mínimo de 8 caracteres” ligada ao campo | Leitor de tela real/perfil administrativo ainda são validações não executadas nesta sessão |
| #32 | Em 320 px: Salvar e Remover linha 44 px; switch tem pseudoárea 44×44; cadastro sem overflow global | Verificar texto ampliado e declarar ausência de toque físico |
| #47 | Retorno de foco já observado em produção; regressão com loader pendente já existe na suíte | Reexecutar a suíte, manter comportamento do novo histórico móvel |
| #48 | Variantes distintas e cabeçalho móvel já publicados e conferidos em sessões anteriores | Confirmar integridade do pacote e renderização atual |
| #49 | Pipeline/main/artefato/deploy/hash e backend autenticado comprovados no PR #80 | Falha original resolvida; orçamento de JS acrescentado ao CI |
| #33 | 13 arquivos únicos declarados no HTML: 159.470 bytes de corpos HTTP reais; 159.605 gzip local | Orçamento 250 KiB e medição reproduzível; LCP/INP são medições separadas |
| #67 | Filhas #68–#71 fechadas com PR #74 e evidências; errata do PDF sem totais preservada | Consolidar o encerramento do conjunto, sem inventar gravação em produção |
| #75 | Responsável confirmou tabela de anexos aplicada; integração funcional pertence ao trabalho específico Claude/Lovable | Não tratar recurso ainda incompleto como regressão da auditoria nem importar escopo concorrente |
| #19/#24 | Publicação/configuração corrigidas; histórico de backups real carregou e mostrou backup de hoje | Corrigir snapshot antigo; restauração real não foi provocada |
| PR #34 | Relatório de 20/10 ainda fora de main | Recuperado sem alterações do commit 7262957; SHA do blob c8a3e06230d64de6fd0ceaff45ae04f94a222057 preservado |

## Método e limites

Inspeção do site publicado autenticado, fontes, issues/PRs e testes. Nenhum
cadastro salvo, autenticação com credenciais reais, troca de senha, exclusão,
download ou restauração de backup. Foi criada apenas uma linha fictícia no
formulário ainda não salvo, descartada pela navegação. Nenhum dado financeiro
real ou screenshot sensível vai para o GitHub.

Em 320 × 740, cadastro com seções abertas: documento 305 px (barra de rolagem
reservada), sem overflow global; Salvar 96×44 e Remover linha 44×44. Switch
visual 44×24, pseudoárea de toque 44×44. Isso é medição DOM/viewport e uso de
ponteiro/teclado, não teste em telefone físico. O atalho de zoom do IAB não
alterou a escala; não declarar zoom 200% independente a partir dessa tentativa.
Reprodução de texto ampliado pelo fornecedor será identificada como tal.

O histórico de backups da produção carregou registros, incluindo um de hoje;
isso demonstra que a afirmação antiga “tabela kr_backups não aplicada” ficou
desatualizada. Não demonstra restauração integral testada. Não foi necessário
aplicar SQL nem ler credenciais.

Orçamento e escopo exato da medição estão em [PERFORMANCE.md](../PERFORMANCE.md).
Leitor de tela real, toque físico e métricas de campo não podem ser declarados
aprovados por inspeção de DOM, build ou testes simulados.

## Entrega

Correções de interface/dependências solicitadas ao Lovable na mensagem
`umsg_01m5je8yqbfdb8tawmck2qq1w7`, base observada
`6c29269c895746464768f302721230cf90a09499`. Aguardar resultado e CI antes
de registrar publicação. A versão pública continua 1.0 para refinamentos.
