# Krieger - projeto atual

Crie o frontend do "Sistema Krieger", um sistema web em português do Brasil (pt-BR) para a Krieger Assessoria Contábil e Condominial: prestação de contas, relatórios mensais, editais de convocação e atas de assembleia de condomínios.

REGRAS DE ARQUITETURA (obrigatórias)
- Vite + React + TypeScript + Tailwind + shadcn/ui. SPA 100% estática. NÃO usar Supabase, Lovable Cloud nem qualquer backend próprio. Use HashRouter (rotas com #) para funcionar em hospedagem comum sem regras de rewrite. Caminhos de assets relativos (base: './' no vite.config).
- Todo acesso a dados passa por UM módulo, src/lib/api.ts, que fala com uma API PHP já existente no mesmo domínio:
  * Dados: GET `api.php?a=listar&s=<store>`, GET `api.php?a=obter&s=<store>&id=<id>`, POST `api.php?a=salvar&s=<store>` com corpo JSON `{"o": <objeto com id opcional>}` (devolve o objeto salvo com id), POST `api.php?a=excluir&s=<store>&id=<id>`, GET `api.php?a=exportar`, POST `api.php?a=importar` com `{"dados": <backup>, "substituir": boolean}`.
  * Stores: condominios, exercicios, mensais, assembleias, modelos, config, importacoes, atas. Cada objeto tem `id` (string até 64 caracteres; gere com Date.now().toString(36)+random quando novo).
  * Autenticação (cookie de sessão, fetch com credentials 'same-origin'): GET `auth.php?a=eu` devolve `{usuario:{id,login,nome,perfil:'admin'|'user',trocarSenha:boolean}}` ou 401; POST `auth.php` com `{a:'entrar',login,senha}`; `{a:'sair'}`; `{a:'minha_senha',atual,nova}`; só admin: GET `auth.php?a=usuarios` (lista com id,login,nome,perfil,ativo,trocarSenha,criadoEm,ultimoAcesso), POST `{a:'usuario_salvar',id?,login,nome,perfil,ativo,senha?}` (sem id = cria; senha informada = redefinição provisória), POST `{a:'usuario_excluir',id}`.
  * Erros vêm como JSON `{erro: "mensagem"}` com status HTTP; mostre a mensagem num toast. Em 401 redirecione para /login.
- No preview do Lovable não existe o PHP: implemente um adaptador MOCK em src/lib/mockApi.ts (dados em localStorage, usuário semente admin/admin123 com perfil admin, alguns condomínios de exemplo) e use-o automaticamente quando o hostname terminar em `.lovable.app`, `.lovableproject.com` ou for localhost. Em produção usa a API real. A interface de api.ts deve ser a mesma nos dois casos.
- Separe a lógica de negócio em src/domain/ (funções puras, sem React), pois ela será testada e substituída depois. Crie arquivos vazios/esqueleto com tipos agora: src/domain/types.ts, pdfParser.ts, previsao.ts, previstoRealizado.ts, ata.ts, relatorioFinal.ts.

VISUAL
- Menu lateral fixo azul-marinho (#0b3a5e), texto claro, item ativo com fundo #12496f e borda esquerda #8fa3c0; fundo da página #f4f6f9; cartões brancos com borda #d9e0e8; tipografia sóbria. Título "Krieger" com subtítulo "Contabilidade Condominial". Layout responsivo (menu vira gaveta no celular). Valores em R$ no formato brasileiro (1.234,56) e datas dd/mm/aaaa; campos de dinheiro com máscara e aceitando vírgula.
- Itens do menu: Painel, Condomínios, Prestação de contas, Previsto × Realizado, Relatório mensal, Editais, Atas, Modelos de edital, Escritório, Backup; e, no rodapé do menu, o nome do usuário logado, "Usuários" (apenas perfil admin), "Minha senha" e "Sair". Rotas das telas ainda não construídas devem mostrar uma página "Em construção" com o título correto.

TELAS DESTA PRIMEIRA ENTREGA
1) Login (/login): usuário e senha, mensagens de erro claras (inclui bloqueio por tentativas). Se `trocarSenha` for true após o login, obrigar a tela de nova senha (senha atual, nova com mínimo 8 caracteres, confirmação) antes de liberar o sistema. Rotas protegidas redirecionam para /login quando não autenticado.
2) Minha senha.
3) Usuários (somente admin): tabela (login, nome, perfil Administrador/Usuário, situação Ativo/Inativo, último acesso), botão Novo usuário, diálogo para criar/editar (login em minúsculas 3 a 40 caracteres letras/números/ponto/hífen/sublinhado e imutável após criado; nome; perfil; ativo; senha provisória obrigatória ao criar e opcional para redefinir), excluir com confirmação. Mostrar as mensagens de erro da API (ex.: não pode excluir a si mesmo nem o último administrador).
4) Painel: cartões com total de condomínios, prestações de contas e editais; aviso se o último backup (config id "backup", campo em) tiver mais de 30 dias ou nunca foi feito; lista "Atenção" com vencimentos em até 90 dias (seguro vigenciaSeguro, recarga de extintores vigenciaExtintores, vistoria técnica = vistoriaAno + vistoriaIntervalo, mandatoFim da administração); tabela das próximas 5 assembleias (data >= hoje) com condomínio e tipo.
5) Condomínios: lista (código, nome, CNPJ, rateio mensal) e formulário completo com cartões: Dados gerais (codigo, nome, nomeRelatorio, cnpj, unidades, rateioAtual, enderecoEdital, administradoraTermo, prazoConvocacao em dias, quorum, variacaoPadrao); Administração (lista cargo/nome/mandatoFim mm/aaaa, linhas adicionáveis e reordenáveis); Seguro (seguradora, vigenciaSeguro, seguro.riscoAbsoluto e lista de coberturas desc/valor); Manutenções e vistorias (vigenciaExtintores, ultGordura, ultDedetizacao, ultCaixaDagua, vistoriaAno, vistoriaLei, vistoriaIntervalo padrão 3); Índices de correção aplicados (lista ano/pct); Histórico mensal e automações (somenteAnual padrão true; regras de preenchimento automático como lista campo/rotulo/regex/modo 'ultimo'|'ultimo+12'; variacaoMetodo 'manual'|'percentual'|'mediaIndices' e variacaoParam); Regras do relatório (deducaoRegex padrão "fundo de caixa p/ obras", aguaRubrica padrão "^[áa]gua", arredondamento 'truncar'|'arredondar'|'centavos'); De-para de rótulos (lista de/para). Excluir com confirmação. Nome é obrigatório; se nomeRelatorio estiver vazio, usar nome.
6) Escritório (config id "escritorio": nome, cidade, rodape, assinatura multilinha, logo em base64 com logoRatio — redimensionar a no máximo 900px de largura) e Backup (exportar JSON "krieger-backup-AAAAMMDD.json" e gravar config id "backup" com em = ISO atual; restaurar com modo Mesclar/Substituir e confirmação para Substituir; só admin pode restaurar).

TIPOS (src/domain/types.ts) — mantenha exatamente estes nomes de campo, pois já existem dados e backups assim:
Condominio { id, codigo, nome, nomeRelatorio, cnpj, enderecoEdital, unidades:number|null, rateioAtual:number|null, prazoConvocacao:number, quorum:string, administradoraTermo:string, administracao:{cargo,nome,mandatoFim?}[], seguradora, vigenciaSeguro, seguro:{riscoAbsoluto:number|null, coberturas:{desc,valor}[]}, vigenciaExtintores, ultGordura, ultDedetizacao, ultCaixaDagua, vistoriaAno, vistoriaLei, vistoriaIntervalo:number, indices:{ano,pct}[], mapeamento:{de,para}[], deducaoRegex, aguaRubrica, arredondamento, variacaoPadrao:number|null, conhecidas:string[], somenteAnual:boolean, regras:{campo,rotulo,fonte,regex,modo}[], variacaoMetodo, variacaoParam:number|null }.
Demonstrativo { condominio, periodo:{ini,fim} (dd/mm/aaaa), saldoAnterior:{contas:{nome,valor}[],total}, receitas:{itens:{nome,valor}[],subtotal,totalComSaldo}, despesas:{grupos:{nome,itens:{nome,valor}[]}[],subtotal,saldoRestante}, saldoAtual:{contas,total}, totais:{saldoAnterior,receitas,despesas,saldoAtual}, avisos:string[], erros:string[] }.
Exercicio { id, condoId, condoNome, ano, demonstrativo, origem:string[], cidade, dataEmissao, rateioAtual, rateioAprovado?, variacao, variacaoMetodo, variacaoParam, deducaoRegex, arredondamento, confer, consid:{administracao, contasReceber, contasPagar, seguradora, vigenciaSeguro, seguro, vigenciaExtintores, ultGordura, ultDedetizacao, ultCaixaDagua, vistoriaAno, vistoriaLei, vistoriaIntervalo, aguaRubrica, consumoAguaManual?, indices, extras:{rotulo,valor}[]}, prev?:{modo:'tradicional'|'detalhado', driver?, alvos?, ajustes?:{id,descricao,sinal:'+'|'-',valor:number,grupo?:string}[] }, mostrarAnalise?, mostrarPizza? }.
Mensal { id, condoId, condoNome, demonstrativo, origem, receber:{unidades,valor}, notas:{rubrica,texto,valor}[] }.
Assembleia (edital) { id, condoId, modeloId, tipo:'ordinaria'|'extraordinaria', modalidade:'online'|'presencial'|'hibrida', data (aaaa-mm-dd), hora1, hora2, quorum, local, zoomLink, zoomId, zoomSenha, pauta:string[], exercicio, entregaContas:'email'|'administracao'|'aplicativo', dataEmissao, cidade, assinante, cargo, timbrado:boolean, linhasLista }.
Modelo { id, nome, versao, pautaOrdinaria:string[], blocos:{id,tipo:'titulo'|'subtitulo'|'texto'|'item'|'esquerda'|'pauta',texto,cond}[], historico? }.
Ata { id, condoId, assembleiaId, tipo, data, hora, modalidade, local, mesa:{presidente,secretario}, presentes:{unidade,nome,procurador:boolean}[], quorum:{unidadesPresentes:number,totalUnidades:number}, itens:{titulo,discussao,deliberacao,votos:{favor,contra,abstencao}}[], encerramento, observacoes, status:'rascunho'|'finalizada' }.

Entregue primeiro essas telas funcionando no preview com o adaptador mock, com código limpo e componentes reutilizáveis (tabela, formulário com listas repetíveis, campo de dinheiro, diálogos de confirmação). Nas próximas mensagens vou pedir: Prestação de contas com previsão orçamentária (com linhas de ajuste + e −), Previsto × Realizado, Relatório mensal, Editais e Modelos, Atas e Relatório final.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/aa3c8b14-19f5-402a-87df-2d6d01f6de4c).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
