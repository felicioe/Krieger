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
- [Auditoria técnica Impeccable — 20/10/2026](docs/auditorias/IMPECCABLE-2026-10-20.md)
- [Especificação funcional v2](docs/ESPECIFICACAO-V2.md)

`main` é a branch padrão desde 20/10/2026. Novos trabalhos partem dela.
Os fontes React chegaram em `frontend/` pelos PRs #21/#23. A #16 acompanha build
reproduzível e integração das regras. O pacote da raiz usa assets versionados;
não recompila frontend/.

## Arquivos que vão para o servidor
`index.html`, `assets/`, `branding/`, `favicon.svg`, `icons.svg`, `.htaccess`, `api.php`, `auth.php`, `lib_auth.php`,
`login.html`, `usuarios.html`, `auth-guard.js`, `acesso.css` e o `config.php` (criado no servidor, fora do Git).

## Publicação
Fluxo operacional definido: **Claude/Codex → GitHub (`main`) → Hostinger pelo
conector/API**. As mudanças devem chegar a `main` por PR; a publicação deve usar
o commit aprovado dessa branch e registrar seu SHA. O pacote abaixo é uma entrada
para a integração de publicação, não uma instrução de upload manual como rotina.

Confirmado na #19: site existente e conector compatível com Git/PHP. A Hostinger
tem auto-deploy ativo para a branch antiga; falta alinhar com main, preservando
configuração/dados. Este workflow gera artefato, sem fazer deploy.

Para preparar os arquivos já compilados, com Node 22+:

```sh
npm ci
npm test
npm run typecheck
npm run docs:check
npm run package:hostinger
```

O conector/API deve publicar o **conteúdo** de `dist/hostinger/` em `public_html`, incluindo `.htaccess`.
O pacote inclui também `branding/`. Não envie o repositório inteiro.
`config.php` e `schema.sql` não entram no pacote: mantenha a configuração existente
no servidor e use o schema apenas na administração do banco.

Este comando empacota os assets versionados; não recompila React. Os fontes estão
em frontend/, mas o build integrado e reproduzível ainda é acompanhado na
[issue #16](https://github.com/felicioe/Krieger/issues/16).
O GitHub Actions valida testes, TypeScript e sintaxe PHP e disponibiliza o artefato
`krieger-hostinger`, sem credenciais e sem publicar automaticamente.

1. Publique pelo conector/API os arquivos acima na **raiz** do `public_html` do domínio, a partir do commit aprovado em `main`.
2. Copie `config.example.php` para `config.php` e preencha as credenciais do MySQL (hPanel > Bancos de dados).
3. Na primeira instalação, aplique `schema.sql` no banco. Ele usa CREATE TABLE IF NOT EXISTS e não migra tabelas existentes; alterações futuras exigem plano de migração.
4. Crie o primeiro administrador (veja abaixo) e entre em `login.html`.

## Controle de acesso
- Só entram usuários cadastrados em **Usuários** (menu lateral, visível apenas para administradores).
- **Administrador**: tudo, inclusive gerenciar usuários e restaurar backup. **Usuário**: usa o sistema.
- Senhas provisórias obrigam a troca no primeiro acesso; 5 falhas de login bloqueiam por 15 minutos; sessão expira após 8 h sem uso.
- Primeiro administrador (rode no phpMyAdmin, aba SQL, trocando o hash por um gerado com `password_hash`):
  `INSERT INTO kr_usuarios (id, login, nome, senha_hash, perfil, ativo, trocar_senha, criado_em) VALUES ('adm00001','admin','Administrador','<HASH>','admin',1,1,NOW());`

`config.php` real não vai para o Git (`.gitignore`).

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
