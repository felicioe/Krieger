import { describe, expect, it } from "vitest";
import {
  formatarPercentualCompleto,
  montarLinhaHistorico,
  parsePercentualCompleto,
  preservarPercentualInformado,
  sugestoesPercentual,
  validarLinhaHistorico,
  variacaoCompleta,
  aplicarRateioBase,
  calcularVariacao,
  historicoDoAno,
  historicoDoExercicio,
  historicoOrdenado,
  rateioBaseDoAno,
  variacaoDoAno,
} from "./historicoRateio";
import type { HistoricoRateio } from "./types";

const linha = (
  ano: number,
  aprovado: number,
  atual: number | null = null,
): HistoricoRateio => ({
  id: `hr-${ano}`,
  condoId: "c1",
  condoNome: "Urban Classic",
  ano,
  rateioAtual: atual,
  rateioSugerido: aprovado,
  variacao: calcularVariacao(atual, aprovado),
  rateioAprovado: aprovado,
  travadoEm: "2026-11-15T00:00:00.000Z",
  fonte: "calculo",
  exercicioId: `e-${ano}`,
});

describe("calcularVariacao", () => {
  it("calcula a variação percentual do atual sobre o anterior", () => {
    expect(calcularVariacao(321, 370)).toBe(15.26);
    expect(calcularVariacao(100, 100)).toBe(0);
    expect(calcularVariacao(100, 80)).toBe(-20);
  });

  it("devolve null quando falta um dos lados ou o anterior é zero", () => {
    expect(calcularVariacao(null, 370)).toBeNull();
    expect(calcularVariacao(321, null)).toBeNull();
    expect(calcularVariacao(0, 370)).toBeNull();
  });
});

describe("historicoDoExercicio", () => {
  it("monta a linha com o rateio aprovado e a variação sobre o atual", () => {
    const l = historicoDoExercicio(
      {
        id: "e-2025",
        condoId: "c1",
        condoNome: "Urban Classic",
        ano: 2025,
        rateioAtual: 321,
        rateioAprovado: 370,
      },
      370,
      "calculo",
      "2026-11-15T00:00:00.000Z",
    );
    expect(l.rateioAprovado).toBe(370);
    expect(l.rateioAtual).toBe(321);
    expect(l.variacao).toBe(15.26);
    expect(l.fonte).toBe("calculo");
    expect(l.exercicioId).toBe("e-2025");
  });

  it("usa o sugerido quando o aprovado ainda não foi informado", () => {
    const l = historicoDoExercicio(
      {
        id: "e",
        condoId: "c1",
        condoNome: "X",
        ano: 2026,
        rateioAtual: 370,
        rateioAprovado: null,
      },
      400,
      "importacao",
      "2026-11-15T00:00:00.000Z",
    );
    expect(l.rateioAprovado).toBe(400);
    expect(l.variacao).toBe(8.11);
  });
});

describe("rateioBaseDoAno", () => {
  const linhas = [linha(2024, 321), linha(2025, 370, 321)];

  it("usa o aprovado do ano anterior como base", () => {
    expect(rateioBaseDoAno(linhas, "c1", 2026)).toBe(370);
    expect(rateioBaseDoAno(linhas, "c1", 2025)).toBe(321);
  });

  it("devolve null quando não há ano anterior travado", () => {
    expect(rateioBaseDoAno(linhas, "c1", 2024)).toBeNull();
    expect(rateioBaseDoAno(linhas, "outro", 2026)).toBeNull();
  });
});

describe("variacaoDoAno", () => {
  const linhas = [linha(2025, 370, 321)];

  it("usa o valor travado do próprio ano quando existe", () => {
    expect(
      variacaoDoAno([...linhas, linha(2026, 400, 370)], "c1", 2026, 999),
    ).toBe(8.11);
  });

  it("cai no sugerido quando o ano ainda não foi travado", () => {
    expect(variacaoDoAno(linhas, "c1", 2026, 400)).toBe(8.11);
  });

  it("devolve null sem base do ano anterior", () => {
    expect(variacaoDoAno(linhas, "c1", 2025, 400)).toBeNull();
  });
});

describe("aplicarRateioBase", () => {
  const linhas = [linha(2025, 370, 321)];

  it("preenche o rateio atual vazio com o aprovado do ano anterior", () => {
    const e = { condoId: "c1", ano: 2026, rateioAtual: null };
    expect(aplicarRateioBase(e, linhas).rateioAtual).toBe(370);
  });

  it("não sobrescreve um rateio atual já informado", () => {
    const e = { condoId: "c1", ano: 2026, rateioAtual: 500 };
    expect(aplicarRateioBase(e, linhas).rateioAtual).toBe(500);
  });
});

describe("historicoOrdenado e historicoDoAno", () => {
  const linhas = [
    linha(2026, 400, 370),
    linha(2024, 321),
    linha(2025, 370, 321),
  ];

  it("ordena do mais antigo para o mais recente", () => {
    expect(historicoOrdenado(linhas, "c1").map((l) => l.ano)).toEqual([
      2024, 2025, 2026,
    ]);
  });

  it("acha a linha do ano pedido", () => {
    expect(historicoDoAno(linhas, "c1", 2025)?.rateioAprovado).toBe(370);
    expect(historicoDoAno(linhas, "c1", 2030)).toBeNull();
  });
});

describe("tela Histórico de rateios (#292)", () => {
  it("variacaoCompleta guarda 6 casas, sem o arredondamento a 2 casas", () => {
    expect(variacaoCompleta(752.78, 820)).toBe(8.929568); // 820 ÷ 752,78 − 1
    expect(variacaoCompleta(321, 370)).toBe(15.264798);
    expect(calcularVariacao(321, 370)).toBe(15.26);
    expect(variacaoCompleta(null, 370)).toBeNull();
    expect(variacaoCompleta(0, 370)).toBeNull();
  });

  it("formata e lê percentuais com até 6 casas", () => {
    expect(formatarPercentualCompleto(15.264798)).toBe("15,264798");
    expect(formatarPercentualCompleto(8.93)).toBe("8,93");
    expect(formatarPercentualCompleto(0)).toBe("0,00");
    expect(formatarPercentualCompleto(null)).toBe("—");
    expect(parsePercentualCompleto("8,932412")).toBe(8.932412);
    expect(parsePercentualCompleto("8.932")).toBe(8.932); // ponto é decimal, não milhar
    expect(parsePercentualCompleto("8,93%")).toBe(8.93);
    expect(parsePercentualCompleto("-2,5")).toBe(-2.5);
    expect(parsePercentualCompleto("")).toBeNull();
    expect(parsePercentualCompleto("abc")).toBeNull();
    expect(parsePercentualCompleto("1,2,3")).toBeNull();
  });

  const entrada = { condoId: "c1", ano: 2025, rateioAtual: 752.78, rateioAprovado: 820, rateioSugerido: 800, percentualInformado: null };

  it("sugestões: do aprovado e do sugerido, com todas as casas", () => {
    const s = sugestoesPercentual(entrada);
    expect(s.doAprovado).toBe(8.929568);
    expect(s.doSugerido).toBe(6.272749);
  });

  it("o % informado vale mais que o calculado e marca a origem", () => {
    const calculada = montarLinhaHistorico(entrada, { travadoEm: "t" });
    expect(calculada).toMatchObject({ variacao: 8.929568, variacaoOrigem: "calculado", fonte: "manual", rateioAprovado: 820 });
    const informada = montarLinhaHistorico({ ...entrada, percentualInformado: 8.93 }, { travadoEm: "t" });
    expect(informada).toMatchObject({ variacao: 8.93, variacaoOrigem: "informado" });
    const completa = montarLinhaHistorico({ ...entrada, percentualInformado: 8.9324123456 }, { travadoEm: "t" });
    expect(completa.variacao).toBe(8.932412);
  });

  it("validação: campos obrigatórios, faixa do % e avisos de 0% ou divergência", () => {
    expect(validarLinhaHistorico({ ...entrada, condoId: "", ano: 25, rateioAprovado: null }).erros).toMatchObject({
      condoId: expect.any(String), ano: expect.any(String), rateioAprovado: expect.any(String),
    });
    expect(validarLinhaHistorico({ ...entrada, percentualInformado: 2000 }).erros.percentualInformado).toBeDefined();
    expect(validarLinhaHistorico(entrada).erros).toEqual({});
    expect(validarLinhaHistorico({ ...entrada, rateioAtual: 820 }).avisos.join(" ")).toMatch(/0%/);
    expect(validarLinhaHistorico({ ...entrada, rateioAtual: null }).avisos.join(" ")).toMatch(/Sem rateio atual/);
    expect(validarLinhaHistorico({ ...entrada, percentualInformado: 9.5 }).avisos.join(" ")).toMatch(/difere do calculado/);
  });

  it("travar o rateio preserva o % informado; calculado é substituído", () => {
    const nova = { variacao: 0, variacaoOrigem: "calculado" as const };
    expect(preservarPercentualInformado(nova, { variacao: 8.932412, variacaoOrigem: "informado" })).toEqual({ variacao: 8.932412, variacaoOrigem: "informado" });
    expect(preservarPercentualInformado(nova, { variacao: 3, variacaoOrigem: "calculado" })).toBe(nova);
    expect(preservarPercentualInformado(nova, null)).toBe(nova);
  });
});
