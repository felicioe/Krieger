# Contraste e estados dos controles (issue #59)

Medição: cores dos tokens de `src/styles.css` (OKLCH) convertidas para sRGB e comparadas pela fórmula
de contraste da WCAG 2.x. Não é certificação; a medição na produção continua sendo feita pela auditoria.

## Limites que identificam um controle (WCAG 1.4.11, mínimo 3:1)

| Uso | Token | Cor | Branco (#fff) | Fundo (#f4f6f9) | Linha das listas (muted/40) |
|---|---|---|---|---|---|
| Borda de campo, seleção, área de texto, sinal +/−, trilho da chave desligada | `--control` | #798898 | 3,63:1 | 3,35:1 | 3,19:1 |
| Borda da caixa de marcar | `--primary` | #0a3a5e | 11,81:1 | 10,89:1 | 11,23:1 |
| Anel e borda de foco | `--ring` | #3b678e | 5,96:1 | 5,50:1 | 5,67:1 |
| Borda de campo com erro (`aria-invalid`) | `--destructive` | #c22826 | 5,82:1 | 5,37:1 | 5,53:1 |

## Texto (mínimo 4,5:1)

| Uso | Token | Branco | Fundo |
|---|---|---|---|
| Texto principal | `--foreground` | 14,53:1 | 13,40:1 |
| Rótulos, dicas, placeholder, ícone da seleção | `--muted-foreground` | 5,50:1 | 5,07:1 |
| Mensagem de erro | `--destructive` | 5,82:1 | 5,37:1 |
| Títulos dos grupos do menu (sobre o azul do menu) | `--sidebar-muted` | 5,32:1 sobre `--sidebar` | |

## Estados

- **Normal:** borda `--control` (3:1 ou mais em todos os fundos usados).
- **Foco:** borda e anel de 1 px em `--ring` (total de 2 px visíveis); caixa de marcar e chave usam anel de 2 px com afastamento.
- **Erro:** borda `--destructive`; o anel de foco também fica em `--destructive`. O erro nunca depende só da cor: há mensagem de texto ligada ao campo.
- **Desabilitado:** opacidade 50%. Exceção prevista na WCAG (componentes inativos não precisam de contraste mínimo); o campo desabilitado continua com rótulo legível.

## Exceções documentadas (borda decorativa, mantida em `--border`)

- Cartões, tabelas, divisórias e a caixa só de leitura “Unidades”: a borda não é o que identifica um controle — o cartão é reconhecido pelo título e pelo fundo branco, e a caixa “Unidades” não é editável.
- Botões com contorno (`variant="outline"`): identificados pelo texto e pela sombra, não pela borda.
