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

- [x] Menu Previsão orçamentária (previsão sugerida do Systemar editável: deduções, variação, resultado e quadro por unidade; aba da previsão pelo demonstrativo saiu da Prestação de contas e foi para esse menu; Relatório final usa a sugerida quando existe)

## Pendências (aguardando decisão do usuário)
- [x] Leitura das páginas "Considerações finais" e "Previsão orçamentária sugerida" do PDF (funções do Claude; preenchem as Considerações finais da prestação de contas, aviso na conferência)
- [x] Backup no servidor na tela de Backup (gerar, histórico com Baixar/Restaurar/Excluir; contrato api.backup.* do Claude) — migração kr_backups no servidor real fica com o usuário

## Auditoria Impeccable #46 (só front-end)
- [x] #30 tabelas: botão de abrir em cada linha (Tab/Enter/Espaço), foco visível, nome do registro, sem abrir duas vezes
- [x] #31 Field: dica/erro com ids e aria-describedby, aria-invalid, aria-required; Selecao repassa ao botão da lista
- [x] #32 toque 44×44 no celular/tela de toque; listas editáveis pela largura disponível; 320/390/768/desktop sem rolagem lateral
- [x] #47 menu do celular: Enter/Espaço abre, Escape/Fechar fecha com foco de volta; navegar foca o conteúdo
- [x] #48 marca: variantes derivadas da logo oficial documentadas em src/assets/MARCA.md; compacta a 32 px
- [ ] Teste de toque real e leitor de tela — fica com o responsável (não disponível aqui)

## Previsto × Realizado e variação em R$
- [x] Tabela do comparativo no PDF/Word numa folha só: anual e "/mês" na mesma linha, coluna Rubrica mais larga
- [x] Opção "Valor fixo (R$)" na previsão pelo demonstrativo (tela, prévia e PDF/Word do Relatório final)
- [x] Cálculo da variação em R$ (código do Claude em src/domain/previsao.ts) e opção também no cadastro do condomínio

## Listas editáveis
- [x] Alça de arrastar no lugar das setas ↑↓ (mouse, toque e teclado: setas movem direto; Espaço levanta/solta; Escape cancela; anúncios em pt-BR)

## Auditoria Impeccable #59–#62 + resíduos #32/#47 (só front-end)
- [x] #59 bordas de campos (input/seleção/caixa) ≥ 3:1; foco visível; estados documentados
- [x] #60 avisos da previsão (unidades, resultado parcial, percentual incomum) junto dos parâmetros e do resultado
- [x] #61 cadastro do condomínio: Dados gerais primeiro, seções avançadas recolhíveis com resumo; explicar expressão regular e de-para
- [x] #62 menu agrupado por rotina; singular/plural e "hoje" no Painel; ausências distinguíveis
- [x] #32 caixas de marcar/chaves 44×44 no celular/toque; texto ampliado e espaçamento de texto
- [x] #47 navegação real pelo menu do celular: URL, título e foco depois da rota carregar (inclusive lenta)
- [ ] Medição na produção, leitor de tela real e toque físico — ficam com o responsável (não disponíveis aqui)

## Trava de divergência da importação
- [x] Confirmação antes de salvar quando os totais do PDF importado mudaram (Relatório mensal e Prestação de contas; função do Claude)

## Correções #68–#71 (só front-end)
- [x] #69 confirmação da importação numa chamada única (`api.confirmarImportacao`), ids gerados antes, repetir não duplica; simulado do preview equivalente
- [x] #70 trava de divergência: quatro totais (PDF/atual/diferença), "Voltar e revisar", referência só some depois de salvar com sucesso; também no registro recém-criado por PDF
- [x] #71 foco volta ao "Importar PDF" (Cancelar/Escape/Fechar/erro); ao trocar de página vai para o conteúdo; janelas de confirmação devolvem o foco a quem as abriu
- [ ] #68 estados da conferência do PDF: tela pronta para verificado/parcial/não verificado/divergente — aguardando `estado`/`comparacoes`/`esperadas` no `resumoConferencia` do domínio (Codex)
- [ ] Leitor de tela real e toque físico — ficam com o responsável
