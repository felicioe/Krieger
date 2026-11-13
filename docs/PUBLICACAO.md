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

Produção React confirmada no navegador em 21/10/2026. A branch de publicação é
`deploy-hostinger`, contendo somente o pacote curado de um SHA de main. Última
publicação: `deploy-hostinger` `846bd02`, com o pacote do CI no commit `6221467`
(main, versão 1.13 — previsão orçamentária no padrão da folha do Systemar); o
runtime `index-B5URdVya.js` no ar coincide com o `index.html` publicado. A
publicação anterior, `fc45795` (`c09bcdd`, versão 1.12), servia
`index-CnJmmVcJ.js`; antes dela, `c2eb968` (`92f853b`, versão 1.11), servia
`index-DFi-oqfk.js`; antes dela, `3fec48f` (main
`bbdd720`), teve os arquivos da branch conferidos contra o artefato. As
publicações `a603045` e `3fec48f` saíram nos minutos seguintes uma da outra
porque outro trabalho foi mesclado em main no intervalo: vale sempre conferir o
SHA de main antes e depois de publicar. Isso não é atestado criptográfico do
artefato nem comprova todos os fluxos da aplicação.

Publicar não aplica migração: em 11/11/2026 o pacote com os modelos de edital por
cidade entrou no ar com `migrations/20261111_modelos_edital_por_cidade.sql` ainda
pendente no banco. Conferir migrations novas a cada publicação e registrar o que
ficou de fora.

O CI instala/compila frontend antes do pacote desde o PR #51. Não há workflow
de deploy neste repositório. Preservar configuração fora da pasta publicada e
seguir as regras do conector na sessão de publicação. Refs #19/#49.

## Preparar uma versão

1. Buscar `origin/main` e selecionar o SHA aprovado; conferir árvore limpa.
2. Executar instalação, testes, typecheck, docs:check, lint PHP e empacotamento.
3. Usar o artefato do CI desse mesmo SHA ou pacote produzido a partir dele.
4. Confirmar que `index.html` está na raiz do pacote e `.htaccess` está incluído.

Antes do pacote, executar `npm ci && npm run build` em `frontend/` (npm e
package-lock.json versionado). `npm run package:hostinger` escreve
`dist/hostinger/` com index.html, assets/, favicon.png e robots.txt do build,
branding/, .htaccess, api.php, auth.php, lib_auth.php, lib_importacao.php e
lib_backup.php da raiz.
Ficam fora configuração real, schema, fontes, testes, dependências e docs.
O empacotador não compila o React nem aplica migrações.
O artefato de um PR é para revisão; publicar exige versão correspondente em `main`.

## Executar via conector/API

1. Listar o estado atual da Hostinger e resolver conta/domínio pelos dados retornados.
2. Registrar SHA, ambiente, destino e plano de rollback em issue de publicação.
3. Conferir backup recuperável dos arquivos e banco. A configuração real
   (`krieger-config.php`) fica fora da pasta publicada do site desde 21/10/2026
   (ver `## Incidente de config.php` abaixo) — não é mais apagada pelo deploy,
   mas confira mesmo assim depois de qualquer publicação.
4. Se a operação substituir todo o diretório ou remover arquivos fora do pacote,
   não prosseguir sem estratégia segura para a configuração existente.
5. Publicar a versão selecionada pelo mecanismo suportado e acompanhar até concluir.
6. Validar comportamento e registrar identificação/log não sensível do deploy.

Em primeira instalação, criar `krieger-config.php` no servidor a partir do exemplo
(fora da pasta publicada — ver README e `## Incidente de config.php` abaixo),
aplicar schema.sql por administração do banco e criar administrador conforme README.
Não incluir configuração real no artefato para contornar limites do conector.
Atualizações de schema exigem plano próprio; o empacotador nunca as executa.

## Incidente de config.php (resolvido em 21/10/2026)

O auto-deploy do Hostinger apaga, a cada push na branch configurada, qualquer
arquivo dentro da pasta publicada que não esteja no Git — isso derrubou o site
duas vezes (config.php sumiu), exigindo recriação manual (ver `docs/DECISOES.md`).
Correção: `lib_auth.php` (`caminho_config()`) agora busca a configuração real em
`krieger-config.php`, **fora** da pasta publicada do site (dois níveis acima), que
nenhum deploy desta aplicação toca — só precisa ser criado uma vez. `config.php`
dentro da pasta publicada não é mais lido por nada; pode ficar ou ser removido,
tanto faz.

## Validação e rollback

- Página correta e assets carregam; worker PDF tem MIME JavaScript.
- Login/logout, troca de senha e permissões admin/user funcionam.
- API sem sessão nega acesso; config.php, krieger-config.php (fica fora da pasta
  publicada) e lib_auth.php não são servidos diretamente.
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
