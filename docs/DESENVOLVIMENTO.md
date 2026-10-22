# Desenvolvimento e contribuição

## Ambiente

- Node 22+ e npm; CI usa Node 22.
- PHP 8.1+ (o código usa retorno `never`) com PDO/MySQL para integração.
- MySQL e servidor compatível com `.htaccess` para testar comportamento de produção.
- `pdftotext` é opcional para o CLI legado em `importador/testar.mjs`.

```sh
git clone https://github.com/felicioe/Krieger.git
cd Krieger
git switch main
git pull --ff-only
git switch -c issue-N-descricao
npm ci
npm test
npm run typecheck
npm run docs:check
npm run package:hostinger
```

Não há build/dev React no package.json da raiz. Os fontes estão em frontend/,
com package.json próprio e scripts dev/build/test/lint. O npm usa o
package-lock.json versionado; bun.lock é um arquivo de origem do Lovable.
Ler o AGENTS.md local antes de editar. O CI valida o domínio, documentação e
sintaxe PHP, instala o frontend com npm ci, compila e gera o pacote integrado.
O workflow também executa os testes e o typecheck do frontend antes do build,
evitando publicar uma versão que apenas compila, mas falha nessas verificações.

Para desenvolvimento PHP, criar banco local de teste, aplicar `schema.sql` e
criar `config.local.php` (na raiz do repo, ao lado de `config.example.php`) a
partir do exemplo, com credenciais locais. Nunca usar o banco de produção em
testes. `php -S localhost:8080` pode ajudar a testar PHP, mas não
processa `.htaccess`; a validação final exige Apache/Hostinger compatível.

## Fluxo de trabalho

1. Consultar issues/PRs para não duplicar trabalho. Criar ou atualizar issue com critérios de aceite.
2. Criar branch a partir de `main` e relacionar o número da issue.
3. Implementar mudança e atualizar docs correspondentes; explicar decisões relevantes em `DECISOES.md`.
4. Executar validações apropriadas e documentar limitações.
5. Fazer commit e push; abrir PR contra `main` com vínculos às issues.
6. Conferir o CI do SHA final, revisar diff e evidências antes de integrar.
7. Após integração, atualizar as pendências; publicar somente por conector/API conforme `PUBLICACAO.md`.

Use `Closes #N` somente para critérios totalmente atendidos. Nos demais casos,
use `Refs #N`. Não fechar #6 por aprovação dos testes unitários.
Não inserir PDFs reais ou dados do ambiente em issue, PR ou fixtures.

## Validações

| Comando | O que comprova |
| --- | --- |
| `npm test` | Regras do domínio e utilitários cobertos pelos testes |
| `npm run typecheck` | Tipagem de domain/lib/configuração Vitest |
| `npm run docs:check` | Presença dos documentos essenciais e destinos de links locais Markdown |
| `npm run changelog:check` | Versão atual e CHANGELOG.md consistentes com a fonte única pública |
| `npm run package:hostinger` | Arquivos obrigatórios e referências diretas do index disponíveis |
| `php -l ARQUIVO.php` | Sintaxe de cada PHP; não acessa MySQL |
| `npm audit` | Alertas conhecidos das dependências npm instaladas; não audita assets compilados |

No PowerShell, se `npm` não estiver no PATH, localize `npm.cmd` da instalação
Node e invoque-o pelo caminho completo; não altere credenciais para resolver isso.

O CI executa as verificações, usa MySQL efêmero para testes transacionais e
publica um artefato. Não acessa o banco de produção nem comprova navegação real.
Para importação PDF, seguir `VALIDACAO-PDF.md`.
