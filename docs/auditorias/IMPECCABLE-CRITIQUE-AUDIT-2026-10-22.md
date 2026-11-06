# Impeccable — crítica e auditoria sequencial

Registro de 22/10/2026 das observações feitas no site publicado em 21/10/2026.
Target: https://krieger.therafinancial.com.br/; modo Operate. Runtime observado
index-BW-D6XlB.js (publicação main 4aec83a). Antes de implementar, main já avançou
para 0f376e8/deploy 1d46be7: não presumir que toda tela atual é a mesma da amostra.

## Crítica: 26/40, provisório

Proveniência: duas avaliações isoladas exigidas pela skill — A (design/uso), B
(detector/browser); A terminou antes da síntese com B. Sem edição de frontend,
submissão, restauração, exclusão ou dados reais anexados. A viu Painel, lista,
Novo condomínio vazio, previsão em leitura e Backup; móvel em lista/Backup.
B inspecionou DOM desktop e login. Não é certificação WCAG.

A linguagem é própria da contabilidade condominial e a identidade sóbria é
coerente. A composição administrativa convencional ganha mais com orientação da
tarefa do que com efeitos visuais. Busca, rótulos junto de ícones e composição
visível dos cálculos funcionam bem.

| Heurística | Nota/4 | Evidência/limite |
| --- | --- | --- |
| Visibilidade do estado | 3 | Localização e contexto do exercício claros; persistência não exercitada. |
| Mundo real | 3 | Vocabulário contábil adequado; regex/de-para exigem repertório técnico. |
| Controle/liberdade | 2 | Voltar e Salvar visíveis; recuperação de rascunho não testada. |
| Consistência | 3 | Paleta, títulos, cartões e ações coerentes. |
| Prevenção de erros | 2 | Avisos úteis, mas secundários ao resultado/Salvar na previsão. |
| Reconhecimento | 3 | Busca e contexto ajudam; regras avançadas pedem sintaxe. |
| Eficiência | 2 | Cadastro longo sem índice interno visível. |
| Estética/foco | 3 | Contida; oito seções e onze módulos exigem classificação mental. |
| Recuperação de erros | 3 | Avisos de previsão explicam correção; erros reais não provocados. |
| Ajuda | 2 | Dicas locais boas, explicação técnica insuficiente. |
| Total | 26/40 | Amostra; não comparar com o score técnico /20 da auditoria anterior. |

Carga cognitiva: agrupamento visual e localização funcionam; divulgação
progressiva, jargão e priorização de correções precisam melhorar. A tabela é
conteúdo de consulta: não contar cada célula como decisão simultânea. Jornada:
lista dá uma vitória rápida; cadastro se expande em configurações avançadas e
cria um vale de esforço; resumo da previsão ajuda, mas avisos podem ficar abaixo.
Personas: Alex percorre cadastro longo; Sam depende de leitura/foco/contraste;
Casey precisa rolar algumas tabelas horizontalmente. Não alegar ausência de
teclado com base apenas em crítica visual.

Prioridades da crítica:
- P1: avisos de previsão incompleta/incomum junto de parâmetros/resultado (#60),
  sem alterar regra de Salvar ou cálculo — harden.
- P2: cadastro essencial e avançados com acesso progressivo e ajuda regex/de-para
  (#61), sem resetar dados — distill/clarify.
- P2: agrupar onze módulos por rotina, preservando links/permissões (#62) — layout.
- Observações menores: pluralização mecânica, ausência de CNPJ em branco e
  atenção mesmo sem pendências. Não presumir falta de confirmação em Backup.

## Auditoria de contraste e espaçamento

Reteste em 22/10, runtime publicado index-DxG3-lFZ.js: o cadastro vazio ainda
usa borda oklch(0.88 0.015 251.6). Menu móvel Novo condomínio → Painel altera
a URL e fecha o drawer; após estabilização, h1=Painel e foco=MAIN. A amostra
anterior foi prematura durante a transição. Issue #47 recebeu essa evidência;
regressão com loader lento continua pendente. Nenhum dado foi salvo.

Medição por cores computadas do navegador na produção, OKLCH→sRGB, composição
alpha e luminância relativa WCAG. Não é leitura de pixels nem certificação.

| Amostra | Razão |
| --- | ---: |
| Texto principal/cartão | 14,527:1 |
| Rótulo e dica/cartão | 5,500:1 |
| Salvar | 11,311:1 |
| Título/página | 10,890:1 |
| Menu normal (alpha0,85) | 7,616:1 |
| Menu ativo (alpha0,85) | 6,252:1 |
| Borda input/cartão | 1,434:1 |
| Anel de foco/cartão | 5,957:1 |

Os textos amostrados superam4,5:1 (título grande também supera3:1). Campos vazios
que dependem da borda para identificação merecem correção (#59). Não exigir3:1
de toda borda decorativa nem interpretar cor de um switch sem texto como texto
ilegível. Erro/desabilitado, todos os estados e todas as telas não foram medidos.

Espaçamento computado:6px entre rótulo/campo,8px no cabeçalho de seção,24px após
cada uma das oito seções do cadastro. Rótulos/dicas12px/16px; inputs desktop14px/
20px e~36px de altura, móvel~44px. Isso mostra escala consistente; não comprova
WCAG1.4.12. Esse critério requer adaptação sem perda quando o usuário altera
line-height1,5, paragraph2em, letter0,12em e word0,16em. Não foi executado override
pela CUA, cujo evaluate é somente leitura. Pedir esse teste ao Lovable e registrar
separadamente. Sem leitor de tela ou toque físico nesta execução.

Detector B:179 arquivos na árvore; 1 warning side-tab em AppSidebar.tsx:43,
class border-l-4. Falso positivo funcional: indicador do item ativo, também
comunicado por fundo/peso/texto. Não remover automaticamente. Launcher produziu
JSON válido com exit1; sem outras regras reportadas. Overlay não injetado:
API de browser é somente leitura; não iniciar live-server ou alterar página para
contornar a restrição. Console coletado sem warnings/errors na amostra, sem
alegar cobertura de toda sessão.

## Performance e pendências existentes

14 modulepreloads declarados na publicação observada somaram159.037 bytes de
corpos HTTP recebidos com Accept-Encoding:gzip (respostas gzip/identity). Não
inclui cabeçalhos/TLS, CSS/fontes nem imports adicionais. API PageSpeed devolveu
429; não há LCP/INP aprovados. #33 segue aberta; JSON sanitizado anexo.
#32 continua com checkbox/switch, texto ampliado e limites de toque físico.
#47 precisa reteste integrado de URL/h1/foco após menu, com rota estabilizada;
Escape/Fechar devolveram foco ao acionador. Não inferir erro só de coleta transitória.

## Continuidade autorizada

Issues #59/#60/#61/#62 criadas em22/10. Solicitação Lovable
umsg_01m5htzekrfrsbx33zaca95557, thread main, projeto
 aa3c8b14-19f5-402a-87df-2d6d01f6de4c, após tarefa concorrente de reordenação
acessível. Preservar métodos da previsão, PDF/Word e mudanças atuais da Claude.
Frontend exclusivo Lovable; sincronização permitida e necessária. Codex revisa,
integra fielmente, testa e publica pela main. Revisão visual final só Hostinger.
Nenhuma correção dessas novas issues está declarada concluída neste registro.

Referências:
- https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
- https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html
- https://www.w3.org/WAI/WCAG22/Understanding/text-spacing.html
