# Auditoria técnica Impeccable — 20/10/2026

Rastreamento: [#29](https://github.com/felicioe/Krieger/issues/29).
Base de código: `main` em `d9e6aab`. Skill Impeccable 4.7.0, playbook `audit.md`.
Modo da superfície: Operate (sistema administrativo de condomínios).

## Veredito de integridade

**Não aprovada para declarar a entrega ponta a ponta pronta.** Há identidade
institucional coerente no código, mas o frontend recuperado ainda não tem todos
os assets e não foi demonstrada a correspondência com o bundle publicado (#16).
Isso é um problema de integridade da entrega, não prova de desenho visual ruim.
O detector mecânico encontrou um único alerta, descartado após inspeção contextual.

## Método e alcance

- Leitura de componentes compartilhados, formulários, tabelas, navegação, tokens,
  importação PDF e carregamento de documentos em `frontend/src`.
- `impeccable.cmd context --target frontend`: contexto carregado; PRODUCT.md e
  DESIGN.md ausentes. A implementação existente foi a referência, sem inventar
  requisito de rebranding, tema escuro ou efeitos visuais.
- `impeccable.cmd detect --json frontend/src`: detector executado; resultado
  normalizado em [JSON](impeccable-detector-2026-10-20.json).
- Inspeção visual do painel publicado em desktop e largura móvel no Chrome.
  Viewport solicitado 390×844; leitura DOM retornou tamanho efetivo 355×767.
  O backend aplicou escala/tamanho diferente; as medidas abaixo usam CSS px reais.
- Medição de arquivo e compressão gzip local do bundle versionado.
- Nenhuma alteração na UI, envio de formulário, importação, exclusão ou deploy.

A sessão do navegador já estava autenticada: login.html redirecionou ao painel.
Não foram copiados nomes, valores financeiros, documentos ou screenshots do
ambiente do usuário para este relatório ou para issues. A prévia Lovable já aberta
foi identificada e deixada como estava; ela não é evidência pública desta auditoria.

### Limitações

Os fontes e a versão publicada são escopos distintos. Não atribuir automaticamente
um achado de `frontend/src` à produção, nem tratar a captura legada como preview
da main. O bundle local tentou acessar PHP e não forneceu demo válida; o servidor
temporário foi encerrado. A instalação de dependências de frontend não concluiu
durante esta auditoria e foi interrompida; build/test dessa árvore não foram
executados. Nenhum placeholder de marca foi criado para mascarar assets ausentes.

Não houve teste com leitor de tela, dispositivo físico, gesto de toque sintetizado,
zoom de 200%, contraste por pixels, dark mode, LCP/INP ou medição de transferência
HTTP. Algumas consultas DOM falharam por timeout; apenas as que retornaram dados
entram como medidas. Viewport não prova interação por toque. As abas temporárias
foram fechadas e o override de viewport removido.

## Audit Health Score provisório

Pontuação de triagem técnica, com alcance limitado acima; não é certificação
WCAG nem resultado integral de testes automatizados de acessibilidade.

| Dimensão | Nota /4 | Evidência principal |
| --- | --- | --- |
| Acessibilidade | 2 | Rótulos/foco presentes, mas ação de linha depende de mouse; dicas não associadas |
| Performance | 2 | Importações pesadas sob demanda nos fontes; bundle publicado inicial grande, sem budget medido |
| Theming | 3 | Tokens semânticos consistentes e paleta institucional; dark mode não é requisito demonstrado |
| Responsividade | 2 | Breakpoints e gaveta nos fontes; alvos móveis compactos e validação de editores pendente |
| Integridade de implementação | 2 | Fontes recuperados, assets ausentes e bundle sem origem/build comprovados |
| **Total** | **11/20** | **Aceitável na triagem, com trabalho significativo; P1s abertos** |

## Achados priorizados

Total: **5 achados acompanhados**, sendo **2 P1 e 3 P2**. Um P1 já estava na #16;
quatro issues novas foram criadas. Não houve P0 comprovado nem cauda de P3s.

### P1 — Abrir registros da tabela depende do mouse

- Issue: [#30](https://github.com/felicioe/Krieger/issues/30).
- Categoria: acessibilidade.
- Local: `frontend/src/components/app/DataTable.tsx:54` e
  `frontend/src/routes/_authenticated.condominios.index.tsx:65`.
- Evidência: `onClick` em `TableRow`; consumidor desenha nome em `span`, sem ação
  semântica equivalente. A linha não entra na ordem de Tab por padrão.
- Impacto: teclado não alcança a ação de abrir o cadastro disponibilizada ao mouse.
- Referência: [WCAG 2.1.1 — Keyboard](https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html);
  comprovação estática do caminho, sem teste de leitor de tela.
- Correção recomendada: link no nome/identificador ou botão explícito por registro,
  nome acessível, foco visível e semântica de tabela preservada. Testar Enter/Tab e mouse.
- Comando: `/impeccable harden`.

### P1 — Assets necessários ao frontend recuperado ausentes

- Issue existente: [#16](https://github.com/felicioe/Krieger/issues/16), sem duplicação.
- Categoria: integridade de implementação.
- Local: `frontend/src/components/app/Marca.tsx:1` e
  `frontend/src/routes/__root.tsx:93` (link de favicon).
- Evidência: imports dos três logos PNG não têm arquivos correspondentes em
  `frontend/src/assets/`; `frontend/public/favicon.png` também está ausente.
- Impacto: clone limpo não fornece os recursos necessários para reproduzir a UI
  com a marca. Não afirmar um erro específico de bundler: build não foi executado.
- Recomendação: recuperar assets oficiais, confirmar dependências/build e comparar
  saída ao pacote servido antes de validar visualmente a main. Não inventar logos.
- Padrão: reprodutibilidade de build, sem referência WCAG específica.
- Comando após recuperar assets: `/impeccable audit`.

### P2 — Dicas e estados de Field não chegam integralmente ao controle

- Issue: [#31](https://github.com/felicioe/Krieger/issues/31).
- Categoria: acessibilidade.
- Local: `frontend/src/components/app/Field.tsx:24` e
  `frontend/src/components/app/inputs.tsx:135`.
- Evidência: label/id existe corretamente; dica/erro não têm ID/aria-describedby;
  obrigatoriedade só desenha asterisco; `Selecao` não encaminha os atributos ARIA
  que Field tenta passar. `FormSenha.tsx:48` usa dica de tamanho mínimo.
- Impacto: instrução e estado ficam menos claros ao navegar por campos com
  tecnologia assistiva. Não alegar que todos os labels ou alertas estão ausentes:
  `Alert` já fornece `role=alert`, inclusive no formulário de senha.
- Referência: relações de informação (WCAG 1.3.1) e estados acessíveis; teste com
  leitor de tela após correção deve confirmar o resultado.
- Recomendação: IDs únicos, describedby e required/aria-required apropriados,
  contrato ARIA propagado até o input/SelectTrigger.
- Comando: `/impeccable harden`.

### P2 — Alvos de toque compactos

- Issue: [#32](https://github.com/felicioe/Krieger/issues/32).
- Categoria: responsividade.
- Local: `frontend/src/components/ui/button.tsx:21`,
  `frontend/src/routes/_authenticated.tsx:40` e `RepeatableList.tsx:68`.
- Evidência estática: alturas padrão 32/36/40 px; ícones de 36 px. Evidência
  separada no bundle publicado: botão genérico Cadastrar mediu 72,53×25,21 CSS px.
- Impacto: menor tolerância a imprecisão em celular; menu legado consome várias
  linhas antes do painel. Há navegação móvel própria nos fontes novos.
- Recomendação: hit area de 44×44 para ações móveis e validação a 320/390/768 px.
- Padrão: 44 px é meta da Impeccable/WCAG 2.5.5 AAA; **não** se conclui violação
  [WCAG 2.5.8 AA](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
  somente por medir menos de 44 px (AA usa 24 px e exceções). Ver também o critério
  [2.5.5 AAA](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html).
- Comando: `/impeccable adapt`.

### P2 — Peso do JavaScript inicial sem orçamento

- Issue: [#33](https://github.com/felicioe/Krieger/issues/33).
- Categoria: performance.
- Local: `index.html:10` referencia `assets/index-cSunhrgO.js`.
- Evidência: **1.768.836 bytes brutos**, **633.045 bytes em gzip local** com node:zlib.
  Worker PDF separado: 1.375.858 bytes; não foi somado automaticamente ao custo inicial.
- Impacto: custo potencial de download/parse em redes/dispositivos limitados.
  Não houve benchmark que demonstre lentidão, LCP/INP ruim ou bytes pela rede.
- Recomendação: resolver #16, analisar chunks, definir orçamento e medir carga
  inicial versus PDF/Word após interação. Manter importações dinâmicas existentes.
- Padrão: orçamento de performance do produto, ainda a definir; sem falha WCAG alegada.
- Comando: `/impeccable optimize`.

## Detector e falsos positivos

Uma ocorrência `side-tab` em `AppSidebar.tsx:41` (`border-l-4`). **Descartada como
defeito**: é indicador de item ativo no menu, não borda decorativa de cartão, e
corresponde ao sistema institucional descrito na especificação. Nenhuma issue
foi aberta só por esse alerta. O detector não verifica teclado, leitor de tela,
contraste por si só ou prontidão de build; resultado pequeno não significa UI aprovada.

## Padrões e pontos positivos

- Componentes compartilhados tornam os problemas de tabela/Field recorrentes,
  mas permitem correção central com testes nos consumidores.
- Separação entre bundle legado e fontes deve continuar explícita nas evidências.
- Paleta institucional usa tokens semânticos em OKLCH e números tabulares.
- Input/Button têm estilos de foco; busca possui aria-label; formulários têm
  autocomplete; o menu móvel possui nome acessível e SheetTitle.
- PDF, worker e geradores PDF/Word são carregados por importação dinâmica nos fontes.
- Table já tem wrapper overflow-auto; não foi aberta falsa issue por scroll de tabela.
- Alert já anuncia erros e ações de reordenação possuem aria-label.
- Não foi cobrado tema escuro sem requisito, nem relatado problema só por usar
  fontes, cartões ou borda de seleção previstos na identidade do produto.

## Pontos a medir, ainda sem defeito confirmado

EditorDemonstrativo combina coluna de valor fixa de 9rem com ações de
RepeatableList. Testar textos longos e zoom no frontend executável antes de
afirmar overflow. Medir contraste dos estados/tokens renderizados; verificar
reduced-motion nas animações de feedback sem eliminar informação útil. Testar
gestos, foco de diálogos e leitura com tecnologia assistiva. Não foram criadas
issues de falha comprovada para hipóteses não reproduzidas.

## Ordem recomendada

1. P1: `/impeccable harden` nas tabelas; resolver assets/build da #16.
2. P2: `/impeccable harden` em Field/Selecao.
3. P2: `/impeccable adapt` em ações móveis e editores.
4. P2: `/impeccable optimize` com medição de bundle/rede.
5. `/impeccable audit` novamente com frontend executável e evidências comparáveis.
6. `/impeccable polish` como etapa final após as correções.

Os comandos podem ser executados um a um ou agrupados, na ordem escolhida pelo
responsável. Esta entrega documenta os achados; não implementa as correções.
