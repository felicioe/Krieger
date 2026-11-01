import { describe, expect, it } from "vitest";
import { adicionarPalavraChave, chipParaRegex } from "./rubricaAmigavel";
import { expressaoDeducao } from "./previsao";

describe("chipParaRegex", () => {
  it("toda vogal (acentuada ou não) vira classe acento-insensível, pra casar qualquer grafia", () => {
    expect(chipParaRegex("esgoto")).toBe("[eéèê]sg[oóòôõ]t[oóòôõ]");
    expect(chipParaRegex("água")).toBe("[aáàâã]g[uúùû][aáàâã]");
  });

  it("escapa caracteres especiais de regex digitados sem querer", () => {
    expect(chipParaRegex("fundo (reserva)")).toBe("f[uúùû]nd[oóòôõ] \\(r[eéèê]s[eéèê]rv[aáàâã]\\)");
  });

  it("string vazia ou só espaço vira string vazia", () => {
    expect(chipParaRegex("   ")).toBe("");
  });

  it("o resultado realmente casa com a palavra digitada em qualquer grafia de acento/maiúscula", () => {
    const re = expressaoDeducao(chipParaRegex("água"))!;
    expect(re.test("Água e esgoto")).toBe(true);
    expect(re.test("agua")).toBe(true);
    expect(re.test("Energia")).toBe(false);
  });
});

describe("adicionarPalavraChave", () => {
  it("quando a expressão está vazia, vira só a palavra nova", () => {
    expect(adicionarPalavraChave("", "esgoto")).toBe(chipParaRegex("esgoto"));
  });

  it("quando já existe expressão, acrescenta como nova alternativa com |, sem tocar no que já havia", () => {
    expect(adicionarPalavraChave("^[áa]gua", "esgoto")).toBe(`^[áa]gua|${chipParaRegex("esgoto")}`);
  });

  it("preserva expressões técnicas complexas já existentes (ex.: com .*), só soma no final", () => {
    const base = "manuten[çc][ãa]o.*elevador";
    expect(adicionarPalavraChave(base, "ascensor")).toBe(`${base}|${chipParaRegex("ascensor")}`);
  });

  it("palavra vazia não altera a expressão", () => {
    expect(adicionarPalavraChave("^[áa]gua", "   ")).toBe("^[áa]gua");
  });
});
