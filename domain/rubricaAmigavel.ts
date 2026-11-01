/**
 * Ajuda a montar expressões de rubrica (água, energia, elevador, dedução) sem exigir que o
 * usuário escreva regex: ele digita uma palavra-chave comum, e isso vira uma alternativa (`|`)
 * acrescentada à expressão já existente, seguindo o mesmo estilo de classes de caractere
 * acento-insensíveis que os padrões do sistema já usam (ex.: "^[áa]gua").
 *
 * Só soma — nunca reinterpreta nem remove o que já estava na expressão, mesmo que seja uma
 * expressão técnica complexa (com `.*`, grupos etc.) escrita à mão.
 */

const CLASSES_ACENTO: Record<string, string> = {
  a: "[aáàâã]", á: "[aáàâã]", à: "[aáàâã]", â: "[aáàâã]", ã: "[aáàâã]",
  e: "[eéèê]", é: "[eéèê]", è: "[eéèê]", ê: "[eéèê]",
  i: "[ií]", í: "[ií]",
  o: "[oóòôõ]", ó: "[oóòôõ]", ò: "[oóòôõ]", ô: "[oóòôõ]", õ: "[oóòôõ]",
  u: "[uúùû]", ú: "[uúùû]", ù: "[uúùû]", û: "[uúùû]",
  c: "[cç]", ç: "[cç]",
};

const ESPECIAIS_REGEX = new Set(["\\", "^", "$", ".", "*", "+", "?", "(", ")", "[", "]", "{", "}", "|"]);

/** Transforma uma palavra em texto livre numa expressão acento-insensível (mesmo estilo dos padrões do sistema). */
export function chipParaRegex(palavra: string): string {
  const texto = palavra.trim().toLowerCase();
  if (!texto) return "";
  let out = "";
  for (const ch of texto) {
    if (CLASSES_ACENTO[ch]) out += CLASSES_ACENTO[ch];
    else if (ESPECIAIS_REGEX.has(ch)) out += `\\${ch}`;
    else out += ch;
  }
  return out;
}

/**
 * Se `texto` não é uma regex válida sozinho, `expressaoDeducao` (domain/previsao.ts) cai pro
 * mesmo fallback: trata o texto inteiro como busca literal, escapando os caracteres especiais.
 * Aplica o mesmo escape aqui antes de somar `|novaAlternativa` — senão a expressão combinada
 * continua inválida, e o fallback passa a escapar tudo junto (`texto|nova` literal), deixando de
 * casar tanto o texto original quanto a palavra nova.
 */
function paraRegexValida(texto: string): string {
  try {
    new RegExp(texto);
    return texto;
  } catch {
    return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}

/** Acrescenta uma palavra-chave como nova alternativa (`|`) à expressão existente; nunca remove ou reescreve o que já havia. */
export function adicionarPalavraChave(regexAtual: string, palavra: string): string {
  const nova = chipParaRegex(palavra);
  if (!nova) return regexAtual;
  const atual = regexAtual.trim();
  return atual ? `${paraRegexValida(atual)}|${nova}` : nova;
}
