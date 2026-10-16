# Krieger – Sistema de Condomínios (build para Hostinger)

Build do React + API PHP, pronto para `public_html`.

## Arquivos que vão para o servidor
`index.html`, `assets/`, `favicon.svg`, `icons.svg`, `.htaccess`, `api.php`, `auth.php`, `lib_auth.php`,
`login.html`, `usuarios.html`, `auth-guard.js`, `acesso.css` e o `config.php` (criado no servidor, fora do Git).

## Publicação
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
