# Impeccable — auditoria da produção em 21/10/2026

Rastreamento: [#46](https://github.com/felicioe/Krieger/issues/46).
Site: [Krieger](https://krieger.therafinancial.com.br/).
Skill Impeccable 4.7.0, playbook audit.md, modo Operate.

## Veredito de integridade

**Interface institucional coerente; aprovação técnica da liberação ainda pendente.**
O React está realmente publicado, com marca, navegação móvel, formulários e
carregamento dividido. As antigas conclusões sobre frontend ausente não se aplicam.
Permanecem a ação de tabela inacessível por teclado e problemas de continuidade
de foco/contrato dos formulários. A cadeia de CI não prepara o build que o
empacotador agora exige. Isso impede declarar a liberação reproduzível e pronta.

## Identidade da versão auditada

| Camada | Evidência |
| --- | --- |
| Main consultada | `960d6fcbb26f838290a2d6af0c12dc68457b32f2` |
| Branch configurada na Hostinger | `deploy-hostinger`, auto-deploy habilitado |
| Commit da branch de publicação | `4d3bfd1b74f9b4f4f6ef61a1685b439fbd30d2c7` |
| Origem declarada na mensagem do pacote | main `5709184bad465e98a2b9048c1d3a6415ee0bd7ea` |
| Entrada observada no DOM | `/assets/index-D_dJBo1m.js` |
| Estilo observado no DOM | `/assets/styles-9y22bij-.css` |
| Marca observada | `/assets/logo-krieger-CYlQ_0aF.png` |

Os nomes de recursos observados correspondem ao HTML/árvore de deploy-hostinger.
A origem main 5709184 é uma declaração do commit, não uma atestação criptográfica
do build. Main avançou depois dela; não atribuir funcionalidades posteriores à UI
publicada sem nova verificação. Manter a branch curada: não apontar main crua para
o document root. Config.php e o incidente anterior continuam sob a #19.

## Método, privacidade e alcance

Inspeção autenticada em aba temporária do Chrome, aproveitando sessão existente;
sem senha, submissão, upload, criação, alteração, exclusão, exportação ou deploy.
Telas inspecionadas: painel, condomínios/listagem/formulário novo vazio, minha
senha, listagens de relatórios/editais/modelos, backup e previsto×realizado.
Navegação para Atas foi feita, mas uma coleta pegou conteúdo transitório de outra
rota; essa leitura não foi usada como prova de erro da página.

Foram usados DOM, árvore acessível, screenshots para inspeção, Tab, Enter, Escape
e viewports. Nenhum nome de condomínio, CNPJ, saldo, documento ou screenshot
com dados reais foi anexado ao GitHub. Evidências públicas são agregadas em
[JSON sanitizado](evidencias-producao-2026-10-21.json).

| Perfil | Tamanho solicitado | Tamanho efetivo retornado pelo navegador |
| --- | --- | --- |
| Desktop | Sem override | 1745×828 |
| Móvel | 390×844 | 355×767 |
| Estreito | 320×720 | 291×655 |
| Intermediário | 768×1024 | 698×931 |

Usar tamanhos efetivos nas conclusões: o backend aplicou escala/tamanho diferente.
Viewport não é teste de gesto físico. Formulário vazio/painel não apresentaram
overflow global nesses tamanhos; não se conclui isso para todos os editores.
Não houve leitor de tela, zoom de texto a 200%, toque físico/sintetizado, contraste
por pixels, rede controlada, LCP ou INP. A API de leitura do navegador não expôs
Performance; essa tentativa foi descartada, sem fabricar resultados.

## Health Score de triagem

| Dimensão | Nota /4 | Base da avaliação |
| --- | --- | --- |
| Acessibilidade | 2 | Falha de teclado confirmada; dicas/requisitos sem associação completa |
| Performance | 3 | Chunks e preloads menores; orçamento/rede/Core Web Vitals pendentes |
| Theming | 3 | Tokens e identidade consistentes; variantes de marca iguais e compacta diminuta |
| Responsividade | 3 | Gaveta e reflow funcionam na amostra; controles compactos e foco pendentes |
| Integridade | 2 | Produção identificada, mas pipeline não constrói frontend antes do pacote |
| **Total** | **13/20** | **Aceitável na triagem, com trabalho significativo** |

Não é certificação WCAG nem aprovação de todas as tarefas do sistema. A auditoria
anterior misturava fonte recuperada e bundle legado; as notas não são diretamente
comparáveis como um benchmark. Aqui a prova central é a produção React atual.

## Achados confirmados

**6 achados: 2 P1 e 4 P2; nenhum P0 comprovado.** Três issues existentes foram
revalidadas; três foram abertas. Performance segue como medição pendente na #33,
sem regressão de velocidade comprovada. Não foram criadas cópias das issues antigas.

### P1 — Abertura de registro sem equivalente de teclado

- Acessibilidade; [#30](https://github.com/felicioe/Krieger/issues/30), revalidada.
- Produção: #/condominios. Duas linhas com tabIndex=-1 e nenhum link/botão/controle
  focável. Tab a partir da busca sai da área principal e não alcança as linhas.
- Fonte correlata: DataTable.tsx:54–57 e _authenticated.condominios.index.tsx:65–78.
- Impacto: teclado não permite abrir um cadastro pela ação oferecida ao mouse.
- Referência: [WCAG 2.1.1](https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html).
- Recomendação: link semântico no nome/identificador ou botão explícito por registro,
  nome acessível e foco visível, preservando a semântica da tabela.
- Aceite: Tab/Enter abre o registro certo, mouse continua funcionando e controles
  internos não disparam navegação dupla. `/impeccable harden`.

### P1 — CI chama pacote React sem construir o frontend

- Integridade de entrega; [#49](https://github.com/felicioe/Krieger/issues/49), nova.
- .github/workflows/validate.yml instala/testa só a raiz e depois chama package:hostinger.
  scripts/package-hostinger.mjs:16–23 exige frontend/.output/public/index.html.
- Reprodução local sem essa saída: package:hostinger terminou com código 1 e a
  mensagem de que o index do frontend não existe. Não é falha do site no ar.
- O comentário recomenda npm ci no frontend, mas não há package-lock.json nem
  npm-shrinkwrap.json versionados ali; há bun.lock. README também diz que o
  empacotador compila, embora ele apenas copie uma saída já construída.
- Impacto: checkout/CI documentados não reproduzem o artefato, prejudicando uma
  publicação rastreável. Padrão de engenharia da liberação, sem alegação WCAG.
- Aceite: runtime/gerenciador/lock definidos, build frontend no CI antes de pacote,
  docs alinhadas e SHA main → artefato → deploy-hostinger → validação registrados.
  Preservar config.php; não contornar checks. Repetir `/impeccable audit` após ajuste.

### P2 — Dicas e obrigatoriedade não ligadas ao controle

- Acessibilidade; [#31](https://github.com/felicioe/Krieger/issues/31), revalidada.
- #/condominios/novo: dicas de Nome no relatório e Parâmetro da variação sem
  aria-describedby; Nome* não expõe required/aria-required. Labels/id existem.
- Fonte: components/app/Field.tsx:24–32 e inputs.tsx:135–164.
- Impacto: tecnologia assistiva não recebe a associação da instrução/estado junto
  ao campo. Referência: relações programáticas WCAG 1.3.1; sem leitor de tela nesta sessão.
- Aceite: IDs únicos para dica/erro, describedby e requisito apropriados ao controle;
  atributos encaminhados até Input/SelectTrigger. `/impeccable harden`.

### P2 — Alvos móveis compactos

- Responsividade; [#32](https://github.com/felicioe/Krieger/issues/32), revalidada.
- DOM publicado: links do menu e inputs ~36 px; Abrir menu ~36×36; Fazer backup
  no painel, 32 px de altura. Fonte: ui/button.tsx:21–24, _authenticated.tsx:40.
- Impacto: menor tolerância a imprecisão em uso móvel. O reflow melhorou; não
  repetir o antigo problema de menu legado em várias linhas como se ainda existisse.
- 44×44 é meta aprimorada, não prova automática de violação AA. Comparar com
  [2.5.8 AA, 24 px e exceções](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
  e [2.5.5 AAA](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html).
- Aceite: ampliar hit areas prioritárias ou justificar alternativa e validar
  editores/texto longo/toque e zoom. `/impeccable adapt`.

### P2 — Fechar menu móvel perde posição do foco

- Acessibilidade; [#47](https://github.com/felicioe/Krieger/issues/47), nova.
- Produção: Abrir menu + Enter leva foco ao botão Close. Escape fecha, mas o
  elemento ativo vira BODY, sem voltar ao invocador. Reproduzido também com mouse.
- Fonte: _authenticated.tsx:33–45 e ui/sheet.tsx:58–68; botão externo ao Sheet,
  sem Trigger/ref de retorno. Close também permanece em inglês na interface pt-BR.
- Impacto: pessoa com teclado perde a posição ao sair da gaveta. Referência ao
  [padrão de diálogo WAI-ARIA APG](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/),
  sem declarar falha WCAG automática apenas pelo foco no body.
- Aceite: retorno ao invocador ou destino apropriado após navegar, controle de
  fechamento em pt-BR e teste Enter/Espaço/Escape. `/impeccable harden`.

### P2 — Variantes de marca são o mesmo bitmap

- Theming/integridade visual; [#48](https://github.com/felicioe/Krieger/issues/48), nova.
- Os três logos em frontend/src/assets têm o mesmo SHA-256. A imagem publicada
  é 1600×901 tanto no menu quanto no cabeçalho compacto; no móvel ela mede
  ~49,72×28 CSS px. A miniatura da arte inteira perde legibilidade.
- Fonte: components/app/Marca.tsx:1–3 e 22–28 promete versões clara e compacta.
  No desktop a mesma arte com fundo branco aparece sobre o menu escuro.
- Impacto: variantes não cumprem a intenção declarada; não é ausência de asset
  (a #16 foi resolvida), nem ausência de alt (ele existe e é adequado).
- Aceite: variantes oficiais distintas ou decisão documentada de reutilização
  com recorte/renderização adequados; conferir proporção/legibilidade no build e
  em produção. Não redesenhar a marca sem pedido. `/impeccable polish`.

## Performance: nova linha de base, sem regressão comprovada

Atualização na [#33](https://github.com/felicioe/Krieger/issues/33). O monólito legado
de 1.768.836 bytes não descreve mais o JavaScript inicial atual.

| Conjunto do pacote de deploy | Bruto | Gzip local |
| --- | ---: | ---: |
| index-D_dJBo1m.js | 382.151 B | 117.426 B |
| 14 modulepreloads declarados no HTML, incluindo a entrada | 495.205 B | 158.427 B |

Medido a partir dos blobs da branch de deploy, via node:zlib. Não são bytes HTTP,
nem todos os chunks de toda rota, nem LCP/INP. Não somar bibliotecas PDF/Word
carregadas após interação à carga inicial sem observar a rede. A divisão é
positiva; medir budget e rede na #33 antes de afirmar lentidão ou aprovar performance.

## Detector, falsos positivos e pontos positivos

Detector source: `impeccable.cmd detect --json frontend/src`, main 960d6fc.
Uma ocorrência side-tab em AppSidebar.tsx:41 (border-l-4), novamente descartada:
é indicador funcional do item selecionado, previsto na identidade, não decoração
aleatória de cartão. Não implica falha da produção nem exige remover o indicador.

Positivos verificados: React realmente servido; assets resolvidos; navegação por
hash; labels associados; formulários vazios com reflow; busca rotulada; menu móvel
com nome e foco inicial; Escape fecha; rotas de documentos/backup renderizam;
tokens semânticos e identidade consistentes; code splitting no pacote.

Não foram abertas falsas issues para: overflow global não observado, filtro
combobox que tem nome pelo texto do controle, campos internos ocultos da biblioteca,
heading transitório durante carregamento, tema escuro sem requisito ou diferenças
de fonte/cores que não foram medidas. O H5 do alerta após H1 fica como melhoria
semântica a revisar, sem criar cauda de P3s. Contraste e reduced-motion precisam
de testes próprios; ausência de medição não é aprovação nem falha.

## Fluxo obrigatório das próximas correções

Issue → branch a partir de main → implementação nos fontes → testes → commit/PR
→ revisão/CI aprovado → merge → build/pacote da main aprovada → atualização da
branch curada deploy-hostinger → validação do site e registro do SHA publicado.

Corrigir primeiro #30/#49, depois #31/#47 e #32. Medir #33, resolver variantes #48,
repetir `/impeccable audit` e finalizar com `/impeccable polish`. Os comandos podem
ser executados separadamente ou em conjunto, na ordem escolhida pelo responsável.
Esta entrega é auditoria/documentação: nenhuma correção de UI ou deploy foi feita.

## Validação desta entrega documental

Instalação limpa da raiz, 114 testes em 13 arquivos, typecheck e docs:check passaram.
O empacotamento sem build frontend foi executado e falhou com código 1, conforme
#49. Não foi montado um build artificial só para fazer esse check passar. O CI
deve registrar o mesmo bloqueio até a correção da cadeia; não declarar a versão
aprovada para publicação nem fazer merge contornando essa verificação.
