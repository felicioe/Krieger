# Arquitetura atual

Documento operacional baseado nos arquivos versionados. A especificação v2
descreve objetivos de produto e deve ser lida junto com este mapa.

| Área | Arquivos | Responsabilidade |
| --- | --- | --- |
| Entrada web | `index.html`, `assets/` | SPA React já compilada, usada pelo pacote da raiz |
| Fontes frontend | `frontend/` | Fontes incorporados pelos PRs #21/#23; configuração e dependências próprias |
| Regras | `domain/*.ts` | Cálculos, validações, transformação e montagem de conteúdo |
| Utilitários | `lib/format.ts`, `lib/id.ts` | Formatação e identificadores |
| API de dados | `api.php` | CRUD por store e importação/exportação de backup |
| Autenticação | `auth.php`, `lib_auth.php` | Sessão, usuários e conexão PDO |
| Páginas de acesso | `login.html`, `usuarios.html`, `auth-guard.js`, `acesso.css` | Acesso e administração de usuários |
| Banco | `schema.sql`, `config.example.php` | Schema MySQL e modelo de configuração |
| PDF | `domain/pdfParser.ts`, `domain/importacao.ts` | Interpretar texto extraído e converter para registros/staging |
| Importador legado | `importador/` | Parser anterior e utilitário CLI com `pdftotext` |
| Identidade visual | `branding/`, SVGs da raiz | Logo e ícones |
| Operação | `scripts/`, `.github/workflows/` | Empacotamento, verificações e artefatos |

## Dados e autenticação

As stores são `condominios`, `exercicios`, `mensais`, `assembleias`, `modelos`,
`config`, `importacoes` e `atas`. Os registros usam `id` e JSON em tabelas
`kr_<store>`. `domain/types.ts` descreve o contrato TypeScript.
As tabelas de usuários e tentativas de login têm estrutura própria em `schema.sql`.

`api.php` recebe `a` (ação) e `s` (store), com parâmetros de query/body conforme
o código. Ações incluem listar, obter, salvar, excluir, exportar e importar.
O backend verifica origem e sessão; operações administrativas verificam perfil.
Consultar o código antes de adicionar consumidores ou alterar contratos.

`lib_auth.php` carrega a configuração (`config.local.php` localmente, ou
`krieger-config.php` fora da pasta publicada em produção — `caminho_config()`
decide), conecta via PDO/MySQL e usa sessão `KRSESS`. Credenciais ficam no
servidor, fora da pasta publicada do site. `.htaccess` bloqueia arquivos internos,
desativa listagem e define MIME do worker `.mjs`. O servidor precisa executar PHP:
servir o pacote como site puramente estático não basta.

## Domínio

| Módulos | Uso |
| --- | --- |
| `previsao`, `previstoRealizado`, `demonstrativo` | Valores, projeções e comparação |
| `mensal`, `exercicio`, `relatorioFinal` | Competências e conteúdo da prestação de contas |
| `edital`, `modelo`, `modeloTexto`, `ata` | Editais, condições/variáveis e atas |
| `listaPresenca`, `procuracao`, `layoutTexto` | Conteúdo auxiliar para documentos |
| `condominio`, `usuario`, `painel`, `backup` | Cadastro, validação e apoio à UI |
| `pdfParser`, `importacao` | Leitura de relatórios Systemar e staging |

A montagem de dados/textos no domínio não comprova geração de PDF/Word na UI.
Os testes exercitam TypeScript em Node, sem navegador, extração PDF, PHP ou MySQL.
O bundle pode ter sido produzido em outra revisão; sua correspondência com os
fontes recuperados precisa ser demonstrada (#16). Há regras em frontend/src/domain
e domain/ na raiz, com instruções locais próprias: centralizar a fonte de verdade
antes de afirmar que editar domain/ atualiza a UI.
