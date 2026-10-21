# Frontend: Lovable, revisão e publicação

## Responsabilidades

Frontend é exclusivo do Lovable por determinação permanente do responsável
(PR #55). Codex/ChatGPT não implementa nem adapta componentes, estilos, assets
ou comportamento da interface. Audita, revisa, testa, documenta e coordena a
integração. Mudanças necessárias após revisão voltam ao Lovable.

A sincronização Lovable ↔ Claude ↔ GitHub é permitida e necessária, inclusive
dos arquivos de hoje. O sandbox pode divergir de main; comparar versões antes
de sincronizar para não apagar entregas recentes. Integrar fielmente o frontend
produzido pelo Lovable, com origem e diff registrados. Levar ao Lovable os
arquivos canônicos de domain/lib produzidos pela Claude sem reescrever a lógica. Se houver conflito de comportamento ou edição manual necessária,
devolver o contexto ao Lovable; não reescrever frontend no Codex.

## Correções em execução — 21/10/2026

Issue principal: [#46](https://github.com/felicioe/Krieger/issues/46).
Projeto Lovable: `aa3c8b14-19f5-402a-87df-2d6d01f6de4c`.
Solicitação: `umsg_01m5g7c1fyfb3r3gf8xr43rtaq`, thread `main`.
Base GitHub ao iniciar integração: `04ebbd4` (inclui PRs #54/#55/#50).

| Issue | Correção e evidência esperada |
| --- | --- |
| #30 | Ação semântica em todos os consumidores navegáveis de DataTable; Tab/Enter, foco visível, nome de registro e ausência de navegação dupla. |
| #31 | Dica/erro com id, aria-describedby e requisito/estados propagados inclusive a Selecao; teclado e leitor de tela com limites explícitos. |
| #32 | Alvos móveis 44×44, editores com conteúdo longo em 320/390/768/desktop; registrar viewport efetivo, zoom e limites de toque. |
| #47 | Menu abre por teclado, fecha por Escape/Fechar em pt-BR, devolve foco e trata destino de navegação. |
| #48 | Marca oficial legível no contexto escuro/compacto; arquivos reais ou reutilização/recorte justificado, sem inventar identidade. |

O status de implementação só muda quando o Lovable devolver commit/diff e
validações. A mensagem aceita ou em execução não comprova correção. #33 continua
separada: medir rede e Core Web Vitals antes de alegar melhoria de performance.

## Integração e entrega

1. Revisar diff e SHA do Lovable, comparando os arquivos afetados com main atual.
2. Registrar origem em branch/commit/PR, preservando domain/lib canônicos e os
   novos fluxos de previsão/backup. Correções de UI após revisão voltam ao Lovable.
3. Executar testes da raiz e frontend, tipagem, docs, build, pacote e lint PHP
   local ou CI; conferir execução do SHA final, sem contornar checks.
4. Verificar renderização e comportamento por teclado no preview/build; não
   encerrar critérios ainda não testados. Usar somente dados fictícios.
5. Integrar PR em main. Publicar apenas pacote desse SHA aprovado; registrar
   CI/artefato, hash do pacote, commit de deploy e resultado observado.

## Publicação e retorno

Destino: `krieger.therafinancial.com.br`, conta `u630316951`, conforme listagem
real da Hostinger em 21/10/2026. Auto-deploy observado em `deploy-hostinger`.
O responsável autorizou publicar após as correções e validações nesta sessão.
Não alterar branch configurada nem apontar árvore crua de main ao document root.

Último pacote publicado observado antes desta etapa: branch deploy-hostinger
`205d3e0a97c9bd930ffdb705b3d2a95ccbe213ee`, origem declarada main `59ba487`.
Manter esse commit recuperável. Se a nova publicação falhar, preparar a mesma
árvore do pacote anterior em um novo commit da branch de deploy (sem reescrever
história), republicar pelo mecanismo suportado e revalidar. Banco não é revertido
por rollback de arquivos; nenhuma migração é parte desta entrega.

Configuração real é buscada fora da pasta publicada (PUBLICACAO.md). Não incluir
credenciais no Git/pacote nem recriar configuração dentro da pasta sobrescrita.
Validar página, assets, sessão/API e fluxos corrigidos depois de publicar.
Não declarar backup/banco ou telas novas validados somente por teste unitário.

## Esclarecimento do responsável — sincronização permitida

A exclusividade do Lovable se refere à autoria das alterações de frontend,
não à sua sincronização com Claude/GitHub. A orientação anterior do Codex foi
restritiva demais e foi corrigida no Lovable e neste documento. Sincronizar os
arquivos atuais, preservando mudanças de ambos os ambientes e revisando conflitos.
