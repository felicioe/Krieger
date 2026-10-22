Method: dual-agent (A: /root/critique_login_a · B: /root/critique_login_b)

Alvo: https://krieger.therafinancial.com.br/#/login — login, rodapé e Registro de Alterações. Main c930a84, deploy048e732, 22/10/2026.
A crítica resultou em 31/40. Identidade Krieger preservada, tarefa clara e rodapé discreto. Maior oportunidade: ajudar quem tem dificuldade com credenciais.

| Heurística | Nota | Avaliação |
|---|---:|---|
| Visibilidade do estado | 3/4 | Versão/foco visíveis; carregamento previsto na fonte. |
| Linguagem do usuário | 4/4 | Termos claros e conteúdo condominial específico. |
| Controle e liberdade | 4/4 | Histórico fecha e devolve foco. |
| Consistência | 4/4 | Componentes/linguagem coerentes. |
| Prevenção de erros | 3/4 | Validação/autocomplete; senha não conferível. |
| Reconhecimento | 3/4 | Rótulos persistentes e versão identificada. |
| Eficiência | 3/4 | Fluxo curto, gerenciadores de senha. |
| Estética e simplicidade | 4/4 | Uma ação principal, histórico sob demanda. |
| Recuperação de erros | 2/4 | Falta orientação para recuperar acesso. |
| Ajuda e documentação | 1/4 | Histórico não orienta primeiro acesso/senha esquecida. |
| Total | 31/40 | Boa base; duas melhorias prioritárias. |

Especificidade: marca original, azul institucional e texto concreto da contabilidade condominial. Composição convencional adequada ao modo Operate; histórico Read. Sem justificativa para redesenho.
Forças: marca/texto identificam produto; Entrar domina; histórico abre sem autenticação e retorna foco. A observou Escape; B fechamento textual. Formulário montado preservado na fonte, preenchimento não exercitado pelos agentes.
Detector: dois comandos reais (frontend/src/routes/login.tsx e frontend/src/components/login) retornaram [] exit0, zero regras/locations/falsos positivos. Isso não comprova ausência de falhas.
Browser1280x720: secundário5,07–5,50:1 e Entrar11,31:1, texto AA. Inputs/Entrar318x36, rodapé746,66x49, ação histórico134x24, modal512x264, Fechar78x36, X16x16 no desktop com alternativa equivalente. Sem overflow desktop.
Sem overlay: API somente leitura, fallback DOM/estilos/screenshots; nenhum live-server/injeção.

Prioridades:
- P2 falta orientação de recuperação (login.tsx82–103): pessoa esquecendo credenciais não encontra próximo passo. Incluir orientação discreta ao administrador responsável, sem contatos ou reset inventados. /impeccable clarify.
- P2 senha sem conferir (login.tsx93): adicionar Mostrar/Ocultar senha acessível, oculta inicialmente. /impeccable harden.
Sem P0/P1 demonstrados. Campo obrigatório sem aria-required é observação adicional (Field não recebe obrigatorio). X pequeno no desktop tem Fechar equivalente e já cresce mobile/coarse; não declarar falha WCAG automaticamente.

Checklist cognitivo: foco único, blocos curtos, agrupamento, hierarquia, uma decisão por vez, poucas opções, baixa memória entre telas, divulgação progressiva:8passam,0/8falhas,carga baixa.
Jornada: reconhecimento → tarefa previsível → versão opcional sem abandonar login. Vale: dificuldade de acesso. Bom final local: retorno do histórico à tela/acionador; conclusão de autenticação não observada.
Personas: Jordan precisa orientação no primeiro acesso; Sam beneficia foco/semântica mas obrigatoriedade precisa comunicação; Alex beneficia fluxo/autofill e conferir senha.
Menores: 1.0/Implantação inicial corresponde ao marco inaugural; sem data inventada. Tamanho do rodapé merece mobile/zoom, sem problema desktop demonstrado.
Limites: agentes não testaram mobile, zoom, leitor real, rede lenta, autenticação, falha remota ou dados reais. Nenhum envio de formulário. PRODUCT.md/DESIGN.md ausentes; não inventado público/política.
Questions skipped: duas prioridades; correção/hardening já autorizados. Prosseguir issue79, preservar identidade e autoria Lovable.

Verificação adicional do integrador, posterior à síntese: em IAB com viewport
real 320 × 740, documento e diálogo têm largura 320 px sem overflow horizontal.
Rodapé tem 109 px de altura; diálogo 320 × 332 px com ações visíveis.
Preenchimento fictício de usuário permaneceu visualmente após abrir/fechar o
histórico; Escape fechou e retornou foco ao acionador. Nenhum envio de login.
Viewport temporário restaurado. Isso amplia a evidência responsiva, sem alterar
a nota independente nem alegar teste em telefone físico ou leitor real.
O histórico anterior 26/40 tem outro escopo; não comparar diretamente as notas.

## Hardening — issue #79

Autoria Lovable, mensagem `umsg_01m5jbrcjmf2erx9fq2fr7sc2b`, base
`20be9fe3863258275ce15d240e3c87479837b7af` →
`aa97b80013a28e2a1f87c3dc7ba4dbd9fc6f9af9`.
Sincronização restrita aos arquivos de login/testes/instruções; roadmap
concorrente preservado. Não houve alteração de domínio, backend ou banco.

- Orientação ao administrador responsável, sem contato/reset inventado.
- Mostrar/Ocultar senha com botão que não envia formulário, valor preservado,
  mesma entrada e autocomplete; inicialmente oculta.
- Obrigatoriedade e erro associados ao campo; foco no primeiro vazio.
- Ocupado/Entrando e bloqueio de repetição; falha preserva usuário, limpa senha
  conforme comportamento anterior, mostra alerta e retorna foco à senha.
- Histórico com quebra de palavras longas e lista rolável/focável; testes
  permitem versões futuras sem alterar a entrada inaugural 1.0.

Validação independente local: 153 testes de frontend em Node 22, incluindo
troca de visibilidade sem envio, teclado, campos vazios sem chamada à API,
ocupado, falha simulada e 30 versões fictícias. Falhas remotas foram simuladas,
sem credenciais reais ou submissões de login na produção.
Lovable também reportou testes visuais em 320/390/1280 px e texto 200%; isso
é evidência do fornecedor, não substitui a verificação pós-publicação.
Limite reportado: histórico muito longo em 320 px com texto 200% pode exigir
rolagem para o Fechar textual; X e Escape permanecem. Não houve teste em
leitor de tela real nem toque físico. Publicação será registrada no PR/issue.

