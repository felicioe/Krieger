# Sistema Krieger — roteiro

- [x] Base: menu, login, troca obrigatória de senha, Minha senha, Usuários, Painel, Condomínios, Escritório, Backup, mock da API
- [x] Logo oficial no menu, login e ícone da aba
- [x] Prestação de contas com previsão orçamentária (ajustes + e −) — demonstrativo digitado à mão
- [x] Importar PDF Systemar (parser do usuário, extração com pdf.js, importações pendentes com conferência do cadastro, botão "Importar PDF" no Relatório mensal e na Prestação de contas)
- [x] Previsto × Realizado (tabela por rubrica e grupo, totais, gráfico) — PDF fica para a etapa de relatórios
- [x] Relatório mensal (lista, demonstrativo, contas a receber, notas; atalho no condomínio) — entrada manual; PDF de exportação e leitura do PDF Systemar ficam para depois
- [x] Editais e Modelos de edital (cadastro; atalho no condomínio) — PDF/Word do edital, lista de presença, procuração e lógica de "cond" ficam para depois
- [x] Atas (lista, editor, finalizar/reabrir; criação a partir do edital) — PDF/Word com papel timbrado fica para depois
- [x] Relatório final (seções escolhidas, prévia na tela, considerações finais editáveis, conferência e emissão) — PDF fica para depois

- [x] PDF e Word: edital (blocos do modelo via modeloTexto.ts do usuário, timbrado opcional), ata (timbrada, rascunho com marca d'água), relatório mensal, relatório final (emitido pela conferência), Previsto × Realizado avulso; variáveis do edital formatadas e condições e/ou (modeloTexto.ts do Claude); próxima vistoria via dataVistoria; lista de presença e procuração (lógica do Claude) no botão "Gerar documentos" do edital

## Pendências (aguardando decisão do usuário)
- [x] Leitura das páginas "Considerações finais" e "Previsão orçamentária sugerida" do PDF (funções do Claude; preenchem as Considerações finais da prestação de contas, aviso na conferência)
