# Krieger – Sistema de Condomínios (build para Hostinger)

Sistema de condomínios com frontend React compilado e API PHP/MySQL.
Desenvolvimento na Claude/Codex → PR no GitHub → `main` → Hostinger via conector/API.

## Comece aqui

- [Estado atual e próximas tarefas](docs/ESTADO-ATUAL.md)
- [Conexões verificadas entre as ferramentas](docs/CONEXOES.md)
- [Instruções compartilhadas para agentes](AGENTS.md) e [entrada do Claude](CLAUDE.md)
- [Arquitetura e mapa dos arquivos](docs/ARQUITETURA.md)
- [Ambiente, comandos e contribuição](docs/DESENVOLVIMENTO.md)
- [Publicação, validação e rollback](docs/PUBLICACAO.md)
- [Decisões duráveis](docs/DECISOES.md)
- [Validação de PDF](docs/VALIDACAO-PDF.md)
- [Auditoria Impeccable e revisão das pendências](docs/auditorias/IMPECCABLE-PRODUCAO-2026-10-21.md)
- [Especificação funcional v2](docs/ESPECIFICACAO-V2.md)

`main` é a branch padrão desde 20/10/2026. Novos trabalhos partem dela.
Os fontes React estão em `frontend/` (PRs #21/#23), sem lógica duplicada — os
20 arquivos de `frontend/src/domain/` e os 2 de `frontend/src/lib/` (format.ts,
id.ts) são re-exports de uma linha pra `domain/`/`lib/` da raiz (PR #41).
O pacote (`npm run package:hostinger`) empacota o build desse frontend (já
compilado antes, `cd frontend && npm run build`) junto com o backend PHP — ver
`## Publicação` abaixo.

## Arquivos que vão para o servidor
`index.html`, `assets/` e `favicon.png` (build de `frontend/`), `branding/`, `.htaccess`,
`api.php`, `auth.php`, `lib_auth.php` e o `config.php` (criado no servidor, fora do Git).
`login.html`, `usuarios.html`, `auth-guard.js`, `acesso.css`, `favicon.svg` e `icons.svg`
eram do frontend legado (HTML/JS estático) e não fazem mais parte do pacote — o SPA novo
cobre login e gestão de usuários como rotas próprias (`#/login`, `#/usuarios`).

## Publicação
Fluxo operacional definido: **Claude/Codex → GitHub (`main`) → Hostinger pelo
conector/API**. As mudanças devem chegar a `main` por PR; a publicação deve usar
o commit aprovado dessa branch e registrar seu SHA. O pacote abaixo é uma entrada
para a integração de publicação, não uma instrução de upload manual como rotina.

Confirmado na #19: site existente e conector compatível com Git/PHP. A Hostinger
tem auto-deploy para `deploy-hostinger`, cuja raiz recebe o pacote gerado de um
SHA de `main`. Não publicar a árvore crua de main. O workflow gera artefato sem
fazer deploy. Configuração real fora da pasta publicada; ver PUBLICACAO.md.

Para preparar os arquivos já compilados, com Node 22+:

```sh
npm ci
npm test
npm run typecheck
npm run docs:check
cd frontend && npm ci && npm run build && cd ..
npm run package:hostinger
```

`npm run package:hostinger` exige que `frontend/.output/public/index.html` já exista
(passo `cd frontend && npm run build` acima) — ele recusa gerar o pacote sem isso, pra
não publicar um pacote velho escondendo uma falha de build.

O conector/API deve publicar o **conteúdo** de `dist/hostinger/` em `public_html`, incluindo `.htaccess`.
O pacote inclui também `branding/`. Não envie o repositório inteiro.
`config.php`/`krieger-config.php` e `schema.sql` não entram no pacote: mantenha a
configuração existente no servidor e use o schema apenas na administração do banco.

O GitHub Actions valida testes, TypeScript e sintaxe PHP, compila `frontend/` e
empacota, disponibilizando o artefato `krieger-hostinger` — sem credenciais e
sem publicar automaticamente.

1. Publique pelo conector/API os arquivos acima na **raiz** do `public_html` do domínio, a partir do commit aprovado em `main`.
2. **Uma única vez**, copie `config.example.php` para `krieger-config.php` e preencha as
   credenciais do MySQL (hPanel > Bancos de dados) — mas **fora** da pasta publicada do
   site: dois níveis acima dela (ex.: se o site fica em
   `.../public_html/krieger`, o arquivo vai em `.../krieger-config.php`, ao lado de
   `public_html`). O auto-deploy do Hostinger apaga tudo que não está no Git dentro da
   pasta publicada a cada push; um arquivo fora dela sobrevive a qualquer deploy futuro,
   então essa cópia nunca mais precisa ser refeita. Ver `lib_auth.php` (`caminho_config()`)
   para os caminhos aceitos.
3. Na primeira instalação, aplique `schema.sql` no banco. Ele usa CREATE TABLE IF NOT EXISTS e não migra tabelas existentes; alterações futuras exigem plano de migração.
4. Crie o primeiro administrador (veja abaixo) e entre pela tela de login do próprio sistema (`/#/login`).

## Controle de acesso
- Só entram usuários cadastrados em **Usuários** (menu lateral, visível apenas para administradores).
- **Administrador**: tudo, inclusive gerenciar usuários e restaurar backup. **Usuário**: usa o sistema.
- Senhas provisórias obrigam a troca no primeiro acesso; 5 falhas de login bloqueiam por 15 minutos; sessão expira após 8 h sem uso.
- Primeiro administrador (rode no phpMyAdmin, aba SQL, trocando o hash por um gerado com `password_hash`):
  `INSERT INTO kr_usuarios (id, login, nome, senha_hash, perfil, ativo, trocar_senha, criado_em) VALUES ('adm00001','admin','Administrador','<HASH>','admin',1,1,NOW());`

`krieger-config.php`/`config.local.php` reais não vão para o Git (`.gitignore`).

Depois da publicação, confira login/logout, permissões de usuário, carregamento
dos assets e worker PDF, gravação de dados e importação. Faça backup do banco e
dos arquivos antes de substituir a versão; preserve `config.php` e restaure o
pacote anterior se a validação falhar. Testes unitários não substituem essa
validação com PHP/MySQL e navegador.

## Continuidade entre ferramentas

Use uma branch por issue e abra PR para `main`. O PR #18 já foi redirecionado para ela.
Registre no PR o problema, a solução, os testes executados e as limitações; vincule
as issues com `Refs #N` ou `Closes #N` somente quando todos os critérios forem atendidos.
Sincronize a branch antes de alternar entre Claude e Codex. Mantenha
regras de negócio em `domain/` e registre a origem dos assets ao atualizar o frontend.

O roteiro de validação de PDF está em [docs/VALIDACAO-PDF.md](docs/VALIDACAO-PDF.md).
