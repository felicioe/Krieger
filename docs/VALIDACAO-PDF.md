# Validação da importação Systemar — issue #6

Estado: pendente de execução ponta a ponta com PDF real ou anonimizado fiel ao layout.
Os testes de domínio existentes não demonstram extração de texto pelo worker PDF,
interação no navegador nem persistência na API PHP.

## Procedimento

1. Usar ambiente de teste com backup e um relatório de período único e um comparativo mensal.
2. Importar pelo botão do sistema; conferir condomínio, período e colunas disponíveis.
3. Comparar receitas, despesas, saldo anterior e saldo atual com o documento, incluindo centavos.
4. No comparativo, conferir um mês e o total do período; validar saldos inicial/final.
5. Conferir Considerações finais e Previsão sugerida quando presentes; testar também ausência dessas seções.
6. Conferir staging quando o condomínio não existe e o destino mensal/prestação de contas.
7. Salvar, recarregar e conferir persistência; verificar console e requisições com falha.

## Evidência a registrar na issue

- Commit e ambiente testados, navegador e data.
- Tipo de layout e número de páginas, sem identificação do condomínio.
- Resultado esperado e observado para cada passo e erro reproduzível, se houver.
- Resultado aprovado/reprovado por cenário e vínculo para correções.

Não anexar PDFs reais, credenciais ou capturas com dados pessoais ao repositório.
Para fixtures públicas, usar dados fictícios mantendo estrutura e posições do layout.
Só encerrar #6 após registrar os resultados da execução; este roteiro não é evidência de aprovação.
