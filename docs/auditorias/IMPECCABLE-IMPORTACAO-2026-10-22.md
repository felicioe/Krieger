# Impeccable — jornada de importação e conferência

## Errata e reteste após PR74

O arquivo chamado sem-totais.pdf da primeira execução ainda continha as quatro
linhas de total, por erro no gerador da fixture. A alegação de reprodução
visual de falsa confirmação com esse arquivo foi inválida. O diagnóstico de
código e de domínio sem conferencia era válido, mas não substituía a prova
de navegador. Evidência retificada também na issue #68.

O gerador foi corrigido: remove exatamente quatro linhas exclusivamente
numéricas, reabre o PDF e verifica que não sobrou nenhuma linha de total.
Na produção main9c0c1c1/deploy204bb76, runtime index-iq1N4M9k.js, o PDF correto
mostrou “Totais não conferidos” e cobertura0/4. O PDF válido mostrou4/4 e o
divergente mostrou2.000×2.100. Cancelar/Escape/Fechar devolveram foco ao botão.
Protegido/inválido e sem texto foram recusados com mensagens legíveis. O
comparativo mensal e a seleção do total foram exercitados até a prévia, sem
gravação. A nota abaixo é a amostra histórica anterior, com esta errata; não
descreve a versão corrigida nem certifica persistência em produção.

Auditoria técnica de 22/10/2026, modo Operate, issue #67. Site publicado:
https://krieger.therafinancial.com.br. Runtime observado index-CGBpV4Il.js,
origem main 01651fa/deploy c56e3ba. Fontes avaliados até main ea1588b (PR #66).
A existência de uma função nova no domínio não prova sua entrega ao usuário.

## Veredito de integridade

Reprovado para considerar a conferência financeira integralmente confiável:
a interface afirma que os totais conferem mesmo quando o PDF não declara
totais para comparação (#68). O produto tem sistema visual coerente e a
extração válida/divergente funcionou na amostra. Detector local no diretório
de importação e rota de lista retornou []: isso não detecta os problemas
comportamentais descritos abaixo. Nenhum falso positivo nesse alvo.

## Saúde técnica provisória

| Dimensão | Nota/4 | Evidência e limite |
| --- | ---: | --- |
| Acessibilidade | 2 | Erro exposto como alert; fechamento do diálogo perde foco para BODY. Sem leitor de tela. |
| Performance | 3 | pdf.js e worker carregados por import dinâmico; leitura sequencial de páginas. Sem LCP/INP/CPU/rede limitada medidos. |
| Temas | 3 | Controles e avisos usam primitives/tokens. Tema escuro não foi exercitado; contraste de todos os estados não refeito. |
| Responsividade | 3 | Entrada e prévia estreita sem overflow horizontal global; botões de aproximadamente44px. Sem toque físico/zoom/text-spacing nesta jornada. |
| Integridade | 2 | Falsa confirmação reproduzida; gravações múltiplas sem recuperação demonstrada; nova comparação ainda sem consumidor frontend. |
| Total | 13/20 | Aceitável, com trabalho significativo pendente. Nota da amostra, não certificação WCAG. |

Não comparar diretamente com crítica26/40 nem com auditorias de outro escopo.
Achados: 0 P0, 2 P1 e 2 P2. Um P1 é risco arquitetural, sem incidente real
reproduzido. Um P2 é integração pendente, sem regressão comprovada.

## Método e resultados em produção

Chrome no Windows, sessão já autenticada. Sem abrir Lovable/preview. PDFs
fictícios gerados com ReportLab, sem identificação/dados reais. Nenhum botão
Conferir cadastro, Criar ou Salvar foi confirmado. Leitura e cancelamento da
prévia não criaram registros. Lista real só foi observada; valores reais e
capturas sensíveis não foram publicados.

O upload inicialmente foi bloqueado pela extensão. Após o responsável ativar
Permitir acesso a URLs de arquivo, a conexão foi retomada e os testes seguiram.
Esse bloqueio foi do ambiente de automação, não um defeito do Krieger.

| Cenário | Esperado | Observado |
| --- | --- | --- |
| valido.pdf, período único | Saldo anterior1.000, receitas2.000, despesas500, saldo atual2.500 | Quatro totais corretos e período01/08/2026–31/08/2026; formato e origem identificados. |
| divergente.pdf | Receitas somam2.000; total declarado2.100 | Aviso explícito com os dois valores; comportamento aprovado. |
| Arquivo denominado sem-totais.pdf | Informar impossibilidade de conferir totais declarados | Fixture anterior inválida: ainda tinha totais. Ver errata acima e diagnóstico de código da #68. |
| sem-texto.pdf | Erro compreensível sem criar registro | “O PDF não tem texto legível (pode ser uma imagem digitalizada).”, role=alert; aprovado na amostra. |
| Escape após prévia | Retornar ao botão Importar PDF | Diálogo fecha; após estabilização foco=BODY; reprovado, #71. |
| Fechar após erro | Retornar ao botão Importar PDF | Diálogo fecha; foco=BODY novamente; reprovado. |

Entrada: viewport solicitado390×844, efetivo355px de largura; document.scrollWidth355.
Botão Importar PDF142,34×43,99 CSSpx. Tabela tem rolagem interna.
Prévia: solicitado320×720, efetivo291px; documento scrollWidth291;
diálogo clientWidth275/scrollWidth275, clientHeight652/scrollHeight971.
Ações Cancelar/Conferir cadastro e Fechar mediram aproximadamente44px de altura;
rolagem vertical mantém conteúdo acessível. Pequenas frações decorrem de escala.
Não é emulação de gesto de toque.

## Achados priorizados

### P1 — Confirmação positiva sem comparação (#68)

Local: domain/importacao.ts:143–168 e
frontend/src/components/importacao/ResumoImportacao.tsx:90–94.
A ausência de conferencia ou de comparações produz ok=true; o componente
traduz isso em “Os totais do PDF conferem…”. Diagnóstico temporário de domínio
passou. A prova de navegador da amostra anterior foi retificada: ver errata.
Impacto: uma leitura parcial ganha aparência de conferência financeira concluída.
Recomendação: representar não verificado/parcial/verificado/divergente e escopo
das comparações. /impeccable harden e /impeccable clarify. Sem alegação WCAG automática.

### P1 — Falha parcial de confirmação sem recuperação demonstrada (#69)

Local: frontend/src/routes/_authenticated.importacoes.$id.tsx:125–145.
Criar condomínio, salvar relatório e atualizar importação são chamadas separadas.
Uma falha intermediária pode deixar gravações anteriores e staging pendente.
Evidência estrutural; não foram provocadas falhas nem demonstradas duplicações reais.
Recomendação: operação atômica ou protocolo idempotente/recuperável no backend,
com testes de falha entre etapas em ambiente de teste e UI coerente no Lovable.
/impeccable harden. Não restaurar/apagar produção para testar.

### P2 — Comparação importado/gravado ainda sem ligação à revisão (#70)

Local: domain/importacao.ts:192; busca em frontend/src não encontra consumidor.
PR #66 adiciona função/testes, mas não uma apresentação na tela. Isso é uma
pendência de integração, não prova de regressão da produção.
Recomendação: Lovable consumir a função canônica no primeiro salvamento após
importação, preservando edições legítimas posteriores. Função compara quatro
totais; não prometer auditoria de cada rubrica. /impeccable harden.

### P2 — Foco perdido ao fechar importação (#71)

Local: frontend/src/components/importacao/ImportarPdf.tsx:121.
Dialog controlado sem acionador/ref de retorno ligados ao botão de seleção.
Confirmado após a transição por Escape e Fechar: activeElement=BODY.
Impacto: navegação por teclado perde a posição de retomada. Referência de
comportamento: WAI-ARIA APG Dialog; sem atestado geral de conformidade WCAG.
Recomendação: retorno ao Importar PDF quando ainda montado e visível, cobrindo
leitura assíncrona, cancelamento e erro em testes integrados. /impeccable harden.

## Padrões e pontos preservados

Padrão principal: distinguir “não encontrei divergências” de “tive dados
suficientes para conferir”; outra separação necessária é importação lida,
registro criado e confirmação final. Não esconder essas etapas atrás de um
único sinal de sucesso.

Preservar: identificação de origem/período, prévia antes da gravação, aviso
numérico de divergência, erro legível, carregamento sob demanda do PDF,
diálogo com rolagem e controles móveis amplos. Não trocar o mecanismo de
cálculo para corrigir apresentação.

## Validação e limites

- npm test -- --run domain/importacao.test.ts: 23 testes passaram.
- Diagnóstico temporário de ausência de conferência: 1 teste passou; arquivo
  removido após a medição, sem impor comportamento defeituoso como regressão permanente.
- Detector local: [] no diretório de componentes de importação e rota de lista.
- Sem alterações de frontend, backend ou dados durante esta auditoria.
- Não exercitados: comparativo multimensal no browser, PDF protegido/inválido,
  arquivo grande/leitura lenta, correspondência com condomínio existente,
  gravação/recarga/persistência, falhas de rede, leitor de tela, toque físico,
  zoom/text-spacing e Core Web Vitals.
- #6 já estava fechada; este relatório não reabre nem substitui sua evidência histórica.
- Entrega UX anterior do Lovable concluiu durante esta auditoria (mensagem
  umsg_01m5htzekrfrsbx33zaca95557). Exige revisão/sincronização própria;
  esta auditoria não declara essas alterações publicadas.

## Próximos comandos

1. P1 /impeccable harden: conferência com cobertura explícita e recuperação de gravação.
2. P1 /impeccable clarify: texto de conferência parcial/ausente.
3. P2 /impeccable harden: comparação na revisão e retorno de foco.
4. /impeccable audit: repetir os cenários após correções, completando persistência em teste.
5. /impeccable polish: finalizar após resolver problemas funcionais.

As correções podem ser tratadas individualmente ou em conjunto, em qualquer
ordem que respeite as dependências. Frontend no Lovable; sincronização permitida.
Relatório e issues não equivalem a correção; não publicar novo runtime por docs.

