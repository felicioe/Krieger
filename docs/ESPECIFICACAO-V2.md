# Sistema Krieger v2 – especificação

> Especificação funcional com referências históricas ao Lovable. O fluxo atual
> é Claude/Codex → GitHub main → Hostinger via conector/API. Consulte
> [arquitetura atual](ARQUITETURA.md), [estado atual](ESTADO-ATUAL.md) e
> [publicação](PUBLICACAO.md) para implementação e limitações verificadas.

Reconstrução do sistema de prestação de contas e editais de condomínios. O sistema atual (build em `assets/`) foi lido
para extrair telas, campos e regras; esta versão mantém os mesmos nomes de campos para aceitar os backups antigos.

## Arquitetura
| Camada | Tecnologia | Onde fica |
|---|---|---|
| Frontend | React + TypeScript + Vite + Tailwind + shadcn/ui, SPA estática (sem Supabase) | Fontes recuperados em frontend/; build integrado pendente (#16); index.html/assets da raiz ainda servem o pacote atual |
| Regras de negócio | TypeScript puro e testado (`domain/`): leitura de PDF, previsão orçamentária, previsto×realizado, atas | este repositório |
| API | PHP 8 + MySQL (Hostinger): `api.php` (dados), `auth.php` (login/usuários), `lib_auth.php` | este repositório |
| Publicação | Build do frontend + arquivos PHP em `public_html` | Hostinger |

A API é genérica por "store" (tabela `kr_<store>` com `id` e `dados` JSON): `condominios`, `exercicios`, `mensais`,
`assembleias`, `modelos`, `config`, `importacoes` e a nova `atas`. Ações: `listar`, `obter`, `salvar`, `excluir`, `exportar`, `importar`.
Autenticação por sessão (cookie), perfis `admin` e `user`; só administradores gerenciam usuários e restauram backup.

## Telas
1. **Login** (e troca obrigatória de senha no primeiro acesso), **Minha senha**, **Usuários** (admin: criar, editar, ativar/desativar, redefinir senha, excluir).
2. **Painel**: totais, alertas de vencimento (seguro, extintores, vistoria, mandatos), próximas assembleias, aviso de backup.
3. **Condomínios**: cadastro completo (dados gerais, administração, seguro e coberturas, manutenções, índices, regras de importação, de-para de rótulos).
4. **Relatório mensal**: importa PDFs mensais, confere totais, contas a receber, notas explicativas, PDF.
5. **Prestação de contas** (exercício): importa o demonstrativo, considerações finais, **previsão orçamentária ao vivo**, análise gráfica, PDF.
6. **Previsto × Realizado** (novo).
7. **Relatório final de prestação de contas** (novo): documento único com as seções escolhidas.
8. **Editais** (PDF/Word, lista de presença, procuração), **Modelos de edital** (blocos, variáveis, histórico).
9. **Atas** (novo).
10. **Escritório** (nome, cidade, rodapé, assinatura, logo) e **Backup** (exportar/restaurar).

## Regras novas
### Previsão orçamentária com linhas de ajuste (+ / −)
`exercicio.prev.ajustes: { id, descricao, sinal: "+" | "-", valor, grupo?: string }[]`.
Base anual = despesas ordinárias (ou soma das rubricas no modo detalhado) − dedução (fundo de obras) + variação.
**Anual ajustado = base + Σ ajustes "+" − Σ ajustes "−".** Mensal, índice, fundo de reserva e valor por unidade partem do anual ajustado.
Cada linha pode ser criada, editada e excluída e aparece no demonstrativo da previsão e no PDF. Sem grupo, vale para o total.

### Previsto × Realizado
Por rubrica e grupo: previsto anual e mensal (previsão do exercício N, já com ajustes) × realizado (demonstrativo/mensais do exercício N+1,
acumulado até o mês escolhido). Colunas: previsto, realizado, diferença (R$ e %), situação (dentro, acima, abaixo). Totais por grupo e geral, gráfico de barras, PDF.

### Atas
`ata = { id, condoId, assembleiaId, tipo, data, hora, modalidade, local, mesa:{presidente,secretario}, presentes:[{unidade,nome,procurador}],
quorum:{unidadesPresentes,totalUnidades}, itens:[{titulo,discussao,deliberacao,votos:{favor,contra,abstencao}}], encerramento, observacoes, status:"rascunho"|"finalizada" }`.
Puxa automaticamente do cadastro do condomínio (nome, CNPJ, endereço, síndico, administradora) e do edital emitido (data, horários, modalidade, local, Zoom, quórum, pauta,
assinante, cidade). O "miolo" da reunião (presença, mesa, discussão e deliberação por item) é digitado. Saída em PDF e Word, com papel timbrado opcional.

### Relatório final de prestação de contas
Documento único montado a partir do exercício: capa, demonstrativo (saldo anterior, receitas, despesas por grupo, saldo atual), considerações finais,
previsão orçamentária (com ajustes), previsto × realizado, análise gráfica, inadimplência, notas explicativas dos relatórios mensais e assinatura.
O usuário escolhe quais seções incluir; conferência dos totais antes de emitir.

## Acesso
Sessão com cookie `HttpOnly`/`SameSite=Lax`, bloqueio após 5 falhas em 15 min, expiração em 8 h sem uso, senha provisória com troca obrigatória,
último administrador ativo nunca pode ser removido.

## Projeto histórico no Lovable

Referência para recuperação dos fontes; links não foram validados nesta revisão.
Não é uma etapa obrigatória do fluxo atual de desenvolvimento.
- Editor: https://lovable.dev/projects/aa3c8b14-19f5-402a-87df-2d6d01f6de4c
- Prévia: https://id-preview--aa3c8b14-19f5-402a-87df-2d6d01f6de4c.lovable.app (usa adaptador de dados de teste; a API PHP só existe na Hostinger)
- Entregas: 1) base + login + usuários + condomínios + painel + escritório + backup; 2) prestação de contas e previsão (ajustes +/−);
  3) previsto × realizado; 4) relatório mensal; 5) editais e modelos; 6) atas e relatório final.
