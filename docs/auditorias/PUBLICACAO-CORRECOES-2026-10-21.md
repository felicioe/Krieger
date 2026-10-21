# Publicação das correções da auditoria — 21/10/2026

## Cadeia de origem

- Frontend produzido exclusivamente no Lovable: 39f8a740d323654c6b2c1077b0d3f9e059a91b8d.
- Integração incremental: PR #56, head 991544c; CI 39686055782 aprovado.
- Main publicada: 4aec83aee13541ad24cf33a15312910e1421fcb3.
- CI da main: https://github.com/felicioe/Krieger/actions/runs/39686204575 (aprovado).
- Artefato: krieger-hostinger, 127 arquivos; hash SHA256 da árvore ordenada
  caminho + espaço + hash de cada arquivo + LF:
  e65eadadc95940fad0f4f2b4e7ce0d8c8c3fc5b4930f24c844b89aa786cc3067.
- Branch deploy-hostinger: d0284be19555fcca7946a1136de2205366303ebe.
- Destino: https://krieger.therafinancial.com.br, conta u630316951.
- Conector hosting_deploy, static/PHP, Git felicioe/Krieger/deploy-hostinger:
  retornou deployed e autoDeploy true; nenhuma troca de branch configurada.
- Ponto de retorno dos arquivos: a6df60d, preservando parser recente da Claude.
  Nenhuma migração de banco nem configuração/credencial alterada.

## Validação executada

122 testes de raiz e 90 frontend (14 novos) passaram. Tipagem de raiz/frontend,
docs:check, build React e package:hostinger passaram localmente. CI confirmou
sintaxe PHP/build/pacote. Detector Impeccable retornou somente side-tab no menu:
falso positivo funcional já contextualizado na auditoria, sem novo defeito.

Produção: HTTP200, index.html igual byte a byte ao artefato (SHA256
22480b2bef7c4d756ed4e2e90dbcf03846f2e80a7ef6d5a5a94ff4bb6aee0081).
Runtime index-BW-D6XlB.js e stylesheet styles-DKX9HdyL.css. API sem sessão401,
lib_auth.php403 e arquivos de configuração404; auth.php sem parâmetros400.
A tela de entrada renderiza as variantes clara/colorida da marca corretamente.

Comparação HTTP de 123 arquivos estáticos: 119 idênticos byte a byte. Os três
PNGs de marca têm bytes recompostos na entrega, mas dimensões e pixels RGBA
idênticos (comparação Pillow). Branding/logo-krieger.jpg veio 1600×901 em vez de
1919×1081, com cache HIT; não alegar igualdade desse JPG. A UI atual usa os PNGs
em assets/, não esse JPG legado. Não foi alterada configuração de otimização/CDN.

## Resultado por issue e limites

| Issue | Entrega | Critério ainda pendente |
| --- | --- | --- |
| #30 | Botões semânticos nas 8 listas, teste de Tab/Enter/Espaço e clique único | Revalidar listas autenticadas na produção após login. |
| #31 | Field e Selecao com ids/descrição/requisito/erro; regressões aprovadas | Leitor de tela e revisão autenticada de senha/perfil na produção. |
| #32 | Alvos móveis ampliados e layouts responsivos por largura disponível | Checkbox/switch não ampliados; zoom/toque físico e revisão interna em produção. |
| #47 | MenuMovel com acionador e retorno de foco; regressões aprovadas | Revalidar menu em sessão autenticada na produção. |
| #48 | Três variantes distintas sincronizadas, marca compacta 32 px | Revisão do cabeçalho móvel autenticado na produção. |
| #49 | Pipeline corrigido, CI aprovado, cadeia main/artefato/deploy documentada | Validação autenticada/operacional e preservação da configuração não inferidas de HTTP público. |
| #33 | Sem alteração de performance nesta entrega | Medição real de rede e Core Web Vitals. |

O Chrome autenticado ficou indisponível no fim da sessão. O navegador integrado
mostra login; foi solicitado ao responsável entrar diretamente no site, sem
compartilhar senha no chat. Não declarar testes internos de produção concluídos
nem encerrar issues com esses critérios pendentes. Não foram salvos cadastros,
importados PDFs reais ou gerados/restaurados backups. Preferência permanente:
revisão visual somente no site publicado, não no app/preview Lovable.
