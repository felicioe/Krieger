---
target: Login e Registro de Alterações publicados
total_score: 31
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 0
target_identity: "url:https://krieger.therafinancial.com.br/"
timestamp: 2026-10-22T17-50-47Z
slug: krieger-therafinancial-com-br
---
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
