# Auditoria técnica orientada pelo histórico Impeccable — 08/11/2026

## Veredito e alcance

Revisão técnica concluída com cobertura visual limitada. Não constitui certificação WCAG nem aprovação integral da interface.

Base local: main ce8116e. Produção: pacote 93311b3, originado de main 05fe887. Entry index-CHfZpMJm.js. CSS styles-C7l-geDe.css, SHA-256 9159f162ed5706d373f2cc2af3d99a72b0aa3e5433deba8f8c64e4a9d2f7ff9e, igual ao build local.

A skill e o detector Impeccable não estavam disponíveis. Esta revisão usa as dimensões dos relatórios anteriores do projeto, não afirma execução do playbook ou detector original. Foram examinados código, CSS compilado, testes existentes e transferência HTTP pública. A árvore acessível do login local foi obtida e identificou formulário rotulado e modo demonstração. A navegação autenticada, inspeção visual e medições de viewport não foram concluídas: o classificador das ferramentas do navegador apresentou indisponibilidade repetida. Uma captura posterior mostrou apenas a região de notificações; isso não foi atribuído a defeito do produto sem reprodução.

Nenhuma correção de interface, gravação em produção ou alteração de banco foi realizada. Não se atribui pontuação global sem cobertura visual comparável à auditoria anterior.

## Achados e recomendações

### P2 — Preferência por movimento reduzido não contemplada

Evidência: o CSS compilado não contém prefers-reduced-motion. Os componentes frontend/src/components/ui/sheet.tsx e dialog.tsx aplicam entrada/saída com deslocamento e zoom, sem alternativa motion-reduce. A gaveta declara durações de 300/500 ms; o diálogo, 200 ms.

Consequência: pessoas que solicitaram menos movimento no sistema continuam recebendo essas animações não essenciais. Recomenda-se desativar deslocamento e zoom nessa preferência, preservando feedback textual e funcionamento dos controles. Não é, por si só, comprovação de violação WCAG AA; animação por interação está relacionada ao critério 2.3.3 AAA.

Aceite: com prefers-reduced-motion: reduce, abrir e fechar gaveta e diálogo não produz deslocamento/zoom. Foco, Escape e navegação continuam funcionando. Validação no navegador ainda necessária.

### P2 — Falta atalho de teclado para saltar o menu lateral

Evidência: frontend/src/routes/_authenticated.tsx renderiza o menu antes de main#conteudo. O main aceita foco programático com tabIndex=-1, mas não foi encontrado link de salto ou comando equivalente para teclado comum. AppSidebar.tsx contém a navegação agrupada.

Consequência: ao iniciar a sequência de Tab no topo da página desktop, a pessoa percorre links do menu antes do conteúdo. Existe landmark main, útil para tecnologias assistivas; por isso a ausência de skip link não é declarada automaticamente uma falha do critério 2.4.1.

Recomendação: primeiro link focável “Pular para o conteúdo”, visível ao foco, levando ao main existente. Como a aplicação usa rotas por hash, a implementação deve preservar a rota e mover o foco explicitamente, sem trocar o hash do roteador.

Aceite: primeiro Tab revela o atalho; Enter foca o conteúdo da rota atual sem navegar para endereço inválido. Testar desktop e móvel.

### P3 — Estado de carregamento compartilhado sem anúncio explícito

Evidência: frontend/src/components/app/Carregando.tsx apresenta spinner e texto, sem role=status ou região aria-live. É usado pelo pendingComponent do layout autenticado.

Consequência potencial: o estado visual de espera pode não ser anunciado a quem usa leitor de tela. Não houve teste com leitor de tela nem reprodução em rede lenta, portanto o efeito permanece a validar.

Recomendação: testar transição lenta e avaliar anúncio educado do carregamento, sem anúncios duplicados do roteador e sem roubar foco.

### P3 — Cores de aviso fora dos tokens compartilhados

Evidência: frontend/src/components/relatorio/PreviaRelatorio.tsx usa border-amber-400, bg-amber-50 e text-amber-950 no aviso de rateio. AvisosPrevisao.tsx e os componentes Alert/Badge utilizam warning e warning-foreground. Há também cores amber específicas no Drive.

Consequência: mudanças futuras na paleta de aviso não alcançam todos os consumidores. Não foi comprovado contraste insuficiente no aviso literal nem defeito visual atual.

Recomendação: padronizar avisos semânticos pelos componentes/tokens existentes, sem remover cores que tenham outra finalidade no Drive.

## Verificações positivas e falsos positivos descartados

- DataTable oferece botão semântico por registro, nome acessível e foco visível. A antiga dependência exclusiva do mouse não foi reencontrada no código.
- Field encaminha associação de dica/erro, obrigatoriedade e estado inválido.
- MenuMovel usa SheetTrigger, restaura foco e trata navegação com carregamento pendente. DialogContent também possui retorno de foco.
- Botões e seleções aplicam alvos de 44 px em larguras móveis e ponteiro coarse. A media query (pointer:coarse) existe no CSS compilado; ausência da string com espaço era falso negativo da busca.
- RolagemTabela recebe tabIndex=0 quando existe overflow horizontal. Não se confirmou região rolável inacessível.
- As três variantes de marca possuem hashes distintos, dimensões próprias e texto alternativo. A antiga duplicação de bitmap não persiste.
- Rotas usam cabecalho() para títulos próprios. O título inicial do HTML não prova ausência de atualização por rota.
- O teste de navegação distingue as duas previsões por aria-current e destaque visual.
- Os três candidatos a botões sem nome eram falsos positivos: links filhos possuem aria-label ou o texto vem de variável.
- Ausência de scope em tabelas simples não comprova falha: th e estrutura regular podem fornecer associação implícita. A tabela mensal complexa tem escopos explícitos.
- Dois h1 na página com prévia de documento não foram classificados como defeito por contagem isolada.
- Não há requisito confirmado de tema escuro. Classes dark herdadas não justificam exigir sua implementação.
- Avisos warning incluem texto e ícone. A borda não é o único meio de identificação; seu contraste abaixo de 3:1 não foi tratado como violação automática.

### Contraste calculado

Conversão dos tokens OKLCH para sRGB e luminância relativa WCAG. Valores teóricos, não cores computadas de todas as telas ou medição de pixels.

| Amostra | Razão |
| --- | ---: |
| muted-foreground / cartão | 5,50:1 |
| muted-foreground / fundo da página | 5,07:1 |
| control / cartão | 3,63:1 |
| control / fundo da página | 3,35:1 |
| destructive / cartão | 5,82:1 |
| sidebar-muted / sidebar | 5,32:1 |
| sidebar-foreground com opacidade 85% / sidebar | 7,62:1 |
| warning-foreground / warning a 10% sobre branco | 12,68:1 |

Bordas decorativas e botões outline têm exceções documentadas em frontend/docs/CONTRASTE.md. Não foram usados contrastes de combinações hipotéticas como achados de telas reais.

### Performance e validação automática

Medição com scripts/check-bundle-budget.mjs --url=https://krieger.therafinancial.com.br/:

| Métrica | Resultado |
| --- | ---: |
| Entrada e modulepreloads únicos | 19 arquivos |
| Corpos HTTP recebidos | 180.557 bytes |
| Limite do projeto | 256.000 bytes |
| Uso do orçamento | 70,5% |
| Folga | 75.443 bytes |

O orçamento passou. A medição não inclui CSS, fontes, todos os imports de rota, cabeçalhos ou TLS. Não mede LCP, INP ou CLS. Os chunks grandes de PDF/Word/XLSX não devem ser somados à carga inicial sem observar sua solicitação. As fontes da interface vêm do Google Fonts com display=swap e preconnect; isso não comprova ausência de deslocamento visual.

As suítes acessibilidade.test.tsx, impeccable-acessibilidade.test.tsx e auditoria-ux.test.tsx passaram: 37 testes em 3 arquivos. Execução em Node 26.12.0 com NODE_OPTIONS=--localstorage-file=C:/tmp/ls-audit.json. Testes simulados não substituem teclado no navegador ou leitor de tela.

ESLint padrão falhou com 27.665 registros, predominantemente formatação/CRLF. Com a regra prettier/prettier desativada apenas na invocação, restaram 1 erro no teste assinaturaAtomica.test.ts e 22 avisos. Não foram corrigidos nem tratados como defeitos visuais. Não houve execução de axe ou detector Impeccable.

## Limites e encaminhamento

Não verificados: fluxos autenticados no navegador, responsividade efetiva em diferentes viewports, zoom/texto 200%, leitor de tela, toque físico, contraste de todos os estados, exportação visual de PDF/Word, LCP/INP/CLS e comportamento com rede controlada.

Os achados antigos das issues 30, 31, 32, 33, 47, 48 e 49 estão fechados. A revisão encontrou suas correções estruturais; não reabriu essas issues nem criou duplicatas. O teste visual das correções continua distinto da inspeção estática.

Prioridade sugerida: preferência por movimento reduzido e atalho de salto. Depois, validar anúncio de carregamento e consolidar os avisos semânticos. Qualquer implementação depende de pedido separado: esta entrega é exclusivamente de auditoria.
