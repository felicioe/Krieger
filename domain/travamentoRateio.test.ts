import { describe, expect, it } from "vitest";
import { executarTravamentoRateio, type PlanoTravamento } from "./historicoRateio";
import type { Exercicio } from "./types";

const exercicioSalvo = { id: "e2025", ano: 2025 } as unknown as Exercicio;
const plano: PlanoTravamento = {
  linha: { id: "h2025" } as PlanoTravamento["linha"],
  proximo: { id: "e2026", rateioAtual: 1234.5 },
};

function falhaEm(etapa: "exercicio" | "historico" | "propagacao") {
  const chamadas: string[] = [];
  const falhar = (nome: string) => {
    chamadas.push(nome);
    if (etapa === nome) return Promise.reject(new Error(`falha em ${nome}`));
    return Promise.resolve(nome);
  };
  return {
    chamadas,
    entrada: {
      gravarExercicio: () => falhar("exercicio") as Promise<Exercicio>,
      planejar: () => plano,
      gravarHistorico: () => falhar("historico"),
      gravarProximo: () => falhar("propagacao"),
    },
  };
}

describe("executarTravamentoRateio", () => {
  it("grava as três etapas e informa o exercício seguinte quando tudo passa", async () => {
    const chamadas: string[] = [];
    const resultado = await executarTravamentoRateio({
      gravarExercicio: async () => (chamadas.push("exercicio"), exercicioSalvo),
      planejar: () => plano,
      gravarHistorico: async () => void chamadas.push("historico"),
      gravarProximo: async () => void chamadas.push("propagacao"),
    });
    expect(resultado).toEqual({ ok: true, proximoId: "e2026" });
    expect(chamadas).toEqual(["exercicio", "historico", "propagacao"]);
  });

  it("para na etapa do exercício e não grava histórico nem propagação", async () => {
    const { chamadas, entrada } = falhaEm("exercicio");
    const resultado = await executarTravamentoRateio(entrada);
    expect(resultado).toMatchObject({ ok: false, etapa: "exercicio" });
    expect(chamadas).toEqual(["exercicio"]);
  });

  it("falha do histórico é informada como histórico, sem propagar", async () => {
    const { chamadas, entrada } = falhaEm("historico");
    const resultado = await executarTravamentoRateio(entrada);
    expect(resultado).toMatchObject({ ok: false, etapa: "historico" });
    expect(chamadas).toEqual(["exercicio", "historico"]);
  });

  it("falha da propagação mantém o histórico gravado e informa o exercício seguinte", async () => {
    const { chamadas, entrada } = falhaEm("propagacao");
    const resultado = await executarTravamentoRateio(entrada);
    expect(resultado).toMatchObject({ ok: false, etapa: "propagacao", proximoId: "e2026" });
    expect(chamadas).toEqual(["exercicio", "historico", "propagacao"]);
  });

  it("sem exercício seguinte, não tenta propagar", async () => {
    const chamadas: string[] = [];
    const resultado = await executarTravamentoRateio({
      gravarExercicio: async () => exercicioSalvo,
      planejar: () => ({ ...plano, proximo: null }),
      gravarHistorico: async () => void chamadas.push("historico"),
      gravarProximo: async () => void chamadas.push("propagacao"),
    });
    expect(resultado).toEqual({ ok: true, proximoId: null });
    expect(chamadas).toEqual(["historico"]);
  });
});
