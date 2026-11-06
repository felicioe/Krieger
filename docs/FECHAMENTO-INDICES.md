# Fechamento de exercícios e histórico de reajustes

## Histórico por condomínio

O histórico anual é exclusivo de cada condomínio. Não há catálogo compartilhado de IGP-M,
INPC ou outros índices econômicos. O percentual representa o reajuste efetivamente registrado
para aquele condomínio e ano.

- Na primeira importação de prestação com histórico, a confirmação transacional preenche
  `kr_indices_condominio` e espelha o histórico no cadastro. Reimportações não substituem
  decisões manuais nem recriam linhas excluídas.
- A seção existente **Condomínios → Índices de correção aplicados** permite incluir, editar e
  excluir. **Salvar** valida ano/percentual, rejeita ano duplicado e grava cadastro+tabela na
  mesma transação. O histórico pode ser vazio por decisão do usuário.
- Dados legados em `Condominio.indices` continuam visíveis. Se o cadastro não tem histórico,
  a leitura apresenta o primeiro histórico de prestação importada do mesmo condomínio.
  Ao salvar o cadastro, ele é migrado para a tabela. Nenhuma gravação acontece em um GET.
- `data_aplicacao`, na estrutura já criada, registra quando o registro foi persistido pelo
  sistema. Não deve ser interpretada como data histórica comprovada da assembleia. O dado
  importado disponível é ano+percentual.
- A preferência **No relatório** permanece no JSON compatível com os relatórios existentes.
  Cada prestação preserva seu histórico em `consid.indices`; editar o cadastro não reescreve
  uma prestação encerrada.
- O backup exporta os índices da tabela dentro do cadastro, mantendo o formato legado.
  A restauração recompõe tabela e JSON na mesma transação. Não há uma segunda coleção divergente.

## Fechar e reabrir

O botão **Fechar exercício** fica na prestação e exige somente `prestacao_contas.editar`.
Não exige perfil de administrador. Os dados e a previsão devem ser salvos antes de confirmar.

A confirmação é uma ação própria da API, persistida imediatamente. O servidor registra autor,
data e uma cópia do condomínio, mensais, exercício anterior e escritório utilizados nos cálculos.
O relatório final, comparativos e previsão de um exercício fechado usam essas fontes preservadas,
não versões que tenham sido editadas depois. Visualização e geração do documento continuam disponíveis.

A API bloqueia alteração, reimportação sobre o mesmo exercício, exclusão e alteração de anexos
vinculados. A interface bloqueia controles, importação e atualização dinâmica. Uma requisição
manual não pode remover `fechado` nem fornecer seu próprio snapshot pelo CRUD.

**Reabrir exercício** exige confirmação e motivo, com a mesma permissão de edição. O histórico
registra a ação; a reabertura remove a fonte congelada e permite voltar à edição. Não há
exigência de administrador e não há limitação inventada ao criador do registro.

Limpeza em massa e restauração são recusadas enquanto houver exercícios fechados, inclusive
para administrador. É necessário reabrir explicitamente antes dessas operações destrutivas.
Novos lançamentos mensais podem continuar: não alteram os snapshots dos exercícios já encerrados.

## Banco e publicação

O usuário confirmou no phpMyAdmin a criação de `kr_indices_condominio` e a existência de
`kr_decisoes_importacao`. Esta integração reutiliza exatamente essas estruturas. **Não há SQL
adicional para executar.** O campo `fechado` e seu snapshot ficam no JSON `kr_exercicios.dados`,
não em uma coluna SQL própria.

Os arquivos `lib_indices.php` e `lib_exercicios.php` integram o pacote Hostinger e têm guarda
contra acesso direto. Não publicar a árvore de fontes. Não presumir que merge comprova deploy.

## Validação

- Domínio: validação de índices, preservação de exclusões, separação por condomínio e relatório
  fechado invariável quando o cadastro ou o demonstrativo anterior mudam.
- Frontend: adaptador local fecha/salva/reabre, recusa alterações e exclusão, mantém índices
  importados e bloqueia todos os controles do editor.
- MySQL efêmero: importação inicial, manutenção/exclusão, rollback, snapshots, versões obsoletas,
  bloqueios e reabertura auditada. Executado no CI, nunca no banco de produção.
