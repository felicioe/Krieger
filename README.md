# Krieger – Sistema de Condomínios (build para Hostinger)

Build do React + API PHP, pronto para `public_html`.

## Publicação
1. Envie o conteúdo do repositório para `public_html` do domínio.
2. Copie `config.example.php` para `config.php` e preencha as credenciais do MySQL (hPanel > Bancos de dados).
3. Importe `schema.sql` no phpMyAdmin.
4. Crie o `.htpasswd` (hPanel > Pastas protegidas por senha) e ajuste `AuthUserFile` no `.htaccess` com o seu usuário da Hostinger.

`config.php` e `.htpasswd` reais não vão para o Git (`.gitignore`).
