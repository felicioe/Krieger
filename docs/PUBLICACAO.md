# Publicação — GitHub main para Hostinger

## Contrato operacional

Claude/Codex desenvolvem → commits e PRs no GitHub → `main` → conector/API Hostinger.
O workflow `Validar e empacotar` gera artefatos; não publica. Um push ou merge
neste repositório não é evidência de deploy. A origem da publicação deve ser um
SHA de `main`, com CI aprovado nesse SHA e evidência registrada no GitHub.

O projeto combina frontend compilado e PHP/MySQL. A existência de package.json
para testes não o torna uma aplicação Node de produção. Antes de escolher uma
operação do conector, confirmar execução PHP e semântica de upload/substituição.

## Estado da integração

`main` foi criada a partir do antigo HEAD e definida como padrão em 20/10/2026.
Nenhum webhook ou ruleset foi retornado na inspeção autenticada do GitHub.
Isso não exclui integrações instaladas fora de webhooks. A auditoria posterior
confirmou o auto-deploy da Hostinger; ver [CONEXOES.md](CONEXOES.md).

Atualização de 21/10/2026: domínio krieger.therafinancial.com.br, PHP/MySQL e
auto-deploy ativo para a branch curada `deploy-hostinger`. O React foi confirmado
no ar, com entrada index-D_dJBo1m.js. Pacote 4d3bfd1 declara origem main 5709184;
a main auditada já está em 960d6fc. Ver [reauditoria](auditorias/IMPECCABLE-PRODUCAO-2026-10-21.md).
Esta auditoria não executou deploy. #19 acompanha preservação/backup e rollback;
#49 acompanha CI e vínculo reproduzível entre fonte, pacote e publicação.

Não há token Hostinger nem workflow de deploy neste repo; a automação existente
é mantida pela Hostinger e aponta para deploy-hostinger, não main diretamente.
Não trocar branch/repositório como atalho: essa operação já apagou config.php
fora do Git. Seguir o incidente registrado em DECISOES.md.
Seguir as regras e confirmações do conector disponível na sessão de publicação.

## Preparar uma versão

1. Buscar `origin/main` e selecionar o SHA aprovado; conferir árvore limpa.
2. Executar instalação, testes, typecheck, docs:check e lint PHP. Construir frontend
   antes do empacotamento. A instalação/lock e etapa CI dessa árvore estão pendentes
   na #49; o empacotador não constrói o frontend sozinho.
3. Usar o artefato do CI desse mesmo SHA ou pacote produzido a partir dele.
4. Confirmar que `index.html` está na raiz do pacote e `.htaccess` está incluído.

`npm run package:hostinger` escreve `dist/hostinger/` e inclui:
`index.html`, `assets/`, `favicon.png`, `robots.txt` do build frontend e
`branding/`, `.htaccess`, `api.php`, `auth.php`, `lib_auth.php` da raiz.

Ficam fora: config.php, schema.sql, fontes, testes, dependências e documentação.
O comando não recompila React. Registrar o SHA da fonte e do artefato; o artefato
de PR é para revisão. Publicar exige versão aprovada em main e atualização curada
de deploy-hostinger, com o SHA dessa atualização registrado junto à validação.

## Executar via conector/API

1. Listar o estado atual da Hostinger e resolver conta/domínio pelos dados retornados.
2. Registrar SHA, ambiente, destino e plano de rollback em issue de publicação.
3. Conferir backup recuperável dos arquivos e banco. Preservar `config.php` e dados.
4. Se a operação substituir todo o diretório ou remover arquivos fora do pacote,
   não prosseguir sem estratégia segura para a configuração existente.
5. Publicar a versão selecionada pelo mecanismo suportado e acompanhar até concluir.
6. Validar comportamento e registrar identificação/log não sensível do deploy.

Em primeira instalação, criar config.php no servidor a partir do exemplo, aplicar
schema.sql por administração do banco e criar administrador conforme README.
Não incluir configuração real no artefato para contornar limites do conector.
Atualizações de schema exigem plano próprio; o empacotador nunca as executa.

## Validação e rollback

- Página correta e assets carregam; worker PDF tem MIME JavaScript.
- Login/logout, troca de senha e permissões admin/user funcionam.
- API sem sessão nega acesso; config.php e lib_auth.php não são servidos diretamente.
- Cadastro de teste pode ser salvo e recarregado sem erro.
- Importação segue `VALIDACAO-PDF.md` no ambiente apropriado.

Falha exige registrar sintoma e interromper a liberação. Republicar pelo conector
o pacote do último SHA aprovado, mantendo configuração/dados. Se houve mudança de
banco, usar o plano específico de migração/rollback; restaurar banco sem avaliar
gravações posteriores pode perder dados. Não presumir rollback automático.

## Registro de publicação na issue

```text
Commit de main:
Execução CI / artefato:
Ambiente e domínio:
Operação do conector e identificação do deploy:
Backup / versão anterior (referência sem segredos):
Validações e resultados:
Pendências / decisão de rollback:
```
