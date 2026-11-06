# Conexões verificadas

Auditoria de 20/10/2026; evidências na [issue #24](https://github.com/felicioe/Krieger/issues/24).

| Conexão | Resultado observado | Limite |
| --- | --- | --- |
| Codex → GitHub | Conector leu main; git fetch/pull funcionaram | Esta sessão, não todo aplicativo ChatGPT |
| Codex → Hostinger | Consultas de sites, arquivos, PHP, bancos e estado de deploy funcionaram | Nenhum deploy executado |
| Hostinger → GitHub | Auto-deploy ativo para felicioe/Krieger | Branch antiga claude/youthful-pascal-lkmbs7 |
| Claude Code local | Instalado; auth status: loggedIn=true | Não valida a interface web Claude |
| Claude Code → Hostinger MCP | claude mcp list: plugin:hostinger:hostinger Connected | Transporte MCP; sem chamada à conta pelo Claude nesta auditoria |
| ChatGPT fora desta sessão | Não verificado | Cada ambiente precisa expor seus conectores/autorização |

Claude/Codex compartilham código pelo GitHub e instruções AGENTS.md/CLAUDE.md.
Não copiar tokens entre aplicações nem supor que uma conexão comprova outra.

## Hospedagem

Domínio: `krieger.therafinancial.com.br`. PHP 8.3.35 com PDO/MySQL habilitados.
Banco atribuído ao domínio e presença de config.php confirmados por listagem;
não foram lidos dados do banco nem conteúdo da configuração.

Verificações sem sessão: raiz/login.html HTTP 200 com conteúdo Krieger;
auth.php?a=eu e api.php?a=listar&s=condominios HTTP 401 (esperado).
Não houve login no sistema, CRUD autenticado ou teste de recuperação de backup.

## Divergência de produção

hosting_get-deployment retornou Git auto-deploy ativo para a branch antiga.
A lista tradicional de repositórios Git retornou vazia: ela não inclui essa
integração automática, portanto não indica ausência de conexão GitHub.

Operação suportada para alinhar com main:

```json
{
  "domain": "krieger.therafinancial.com.br",
  "git": { "repository": "felicioe/Krieger", "branch": "main" },
  "type": "static"
}
```

Parâmetros de hosting_deploy; static também cobre PHP. A operação publica agora
e a cada push posterior. O schema adverte sobrescrita de conteúdo: não é somente
trocar uma preferência. Antes de executar: confirmar domínio/conta e backup
recuperável. Desde 21/10/2026 a configuração real (`krieger-config.php`) fica
fora da pasta publicada, então não é mais apagada pelo deploy — ver
`docs/PUBLICACAO.md` (`## Incidente de config.php`). Seguir confirmações da
skill/conector da sessão. Não contornar hosting_deploy com operações de baixo nível.

Depois, conferir main/is_enabled em hosting_get-deployment e executar as
validações de [PUBLICACAO.md](PUBLICACAO.md). #19 continua aberta até isso ocorrer.

## Retomada

1. Ler AGENTS.md, CLAUDE.md e ESTADO-ATUAL.md; consultar issues/PRs atuais.
2. Sincronizar origin/main e usar branch própria para cada trabalho.
3. Repetir consultas de leitura antes de qualquer alteração da hospedagem.
4. Conferir a branch realmente configurada antes de presumir que merge publicará.

HTTP 500 anterior não reapareceu. Causa não determinada; não atribuir recuperação
a login/token/permissão sem evidência. Se retornar, registrar operação e
correlation_id na #19 sem segredos; não repetir writes de resultado desconhecido.
