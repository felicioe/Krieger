# Krieger – Sistema de Condomínios (build para Hostinger)

Build do React + API PHP, pronto para `public_html`.

## Arquivos que vão para o servidor
`index.html`, `assets/`, `favicon.svg`, `icons.svg`, `.htaccess`, `api.php`, `auth.php`, `lib_auth.php`,
`login.html`, `usuarios.html`, `auth-guard.js`, `acesso.css` e o `config.php` (criado no servidor, fora do Git).

## Publicação
Para preparar os arquivos já compilados, com Node 22+:

```sh
npm ci
npm test
npm run typecheck
npm run package:hostinger
```

Envie o **conteúdo** de `dist/hostinger/` para `public_html`, incluindo `.htaccess`.
O pacote inclui também `branding/`. Não envie o repositório inteiro.
`config.php` e `schema.sql` não entram no pacote: mantenha a configuração existente
no servidor e use o schema apenas na administração do banco.

Este comando empacota os assets versionados; não recompila React. Os fontes React
não estão nesta branch. A recuperação do build reproduzível é acompanhada na
[issue #16](https://github.com/felicioe/Krieger/issues/16).
O GitHub Actions valida testes, TypeScript e sintaxe PHP e disponibiliza o artefato
`krieger-hostinger`, sem credenciais e sem publicar automaticamente.

1. Envie os arquivos acima para a **raiz** do `public_html` do domínio.
2. Copie `config.example.php` para `config.php` e preencha as credenciais do MySQL (hPanel > Bancos de dados).
3. Importe `schema.sql` no phpMyAdmin (é seguro reimportar: só cria o que não existe).
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

Use uma branch por issue e abra PR para a branch padrão atual do repositório.
Registre no PR o problema, a solução, os testes executados e as limitações; vincule
as issues com `Refs #N` ou `Closes #N` somente quando todos os critérios forem atendidos.
Sincronize a branch antes de alternar entre Claude, Lovable e Codex. Mantenha
regras de negócio em `domain/` e registre a origem dos assets ao atualizar o frontend.

O roteiro de validação de PDF está em [docs/VALIDACAO-PDF.md](docs/VALIDACAO-PDF.md).
