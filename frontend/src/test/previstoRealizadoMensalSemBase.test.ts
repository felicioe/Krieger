import { describe, expect, it } from "vitest";
import { compararPrevistoRealizadoMensal } from "@/domain/previstoRealizadoMensal";
import { demonstrativoVazio, recalcularDemonstrativo } from "@/domain/demonstrativo";
import { documentoPrevistoRealizadoMensal } from "@/documentos/previstoRealizadoMensal";
import type { Demonstrativo, Exercicio, HistoricoRateio } from "@/domain/types";

function demo(grupos: Demonstrativo["despesas"]["grupos"], ini = "", fim = ""): Demonstrativo {
  return recalcularDemonstrativo({
    ...demonstrativoVazio("Teste"),
    periodo: { ini, fim },
    despesas: { grupos, subtotal: 0, saldoRestante: 0 },
  });
}

const exercicio = {
  id: "e1",
  condoId: "c1",
  condoNome: "Teste",
  ano: 2026,
  demonstrativo: demo(
    [{ nome: "Pessoal", itens: [{ nome: "Salários", valor: 120000 }] }],
    "01/01/2026",
    "31/12/2026",
  ),
  origem: [],
  cidade: "",
  dataEmissao: "",
  rateioAtual: null,
  variacao: 0,
  variacaoMetodo: "manual",
  variacaoParam: null,
  deducaoRegex: "",
  arredondamento: "centavos",
  confer: null,
  consid: {},
  prev: { modo: "tradicional", ajustes: [] },
} as unknown as Exercicio;

const hist: HistoricoRateio[] = [
  {
    id: "h1",
    condoId: "c1",
    ano: 2025,
    rateioAtual: null,
    rateioSugerido: null,
    variacao: 10,
    rateioAprovado: 1,
    travadoEm: "",
    fonte: "calculo",
    exercicioId: null,
  },
];

const opcoes = { orcado: true, horizontal: true, vertical: false };

function textos(sem: boolean) {
  const base = demo([{ nome: "Pessoal", itens: [{ nome: "Salários", valor: 240000 }] }]);
  const resultado = compararPrevistoRealizadoMensal(exercicio, [], {
    historicoRateios: hist,
    ...(sem ? {} : { demonstrativoBase: base }),
  });
  const doc = documentoPrevistoRealizadoMensal({
    resultado,
    exercicio,
    condominio: null,
    escritorio: null,
    mensais: [],
    opcoes,
  });
  return doc.blocos.flatMap((b) =>
    b.tipo === "paragrafo" && typeof b.texto === "string" ? [b.texto] : [],
  );
}

describe("Previsto × Realizado mensal: aviso de sem base no PDF/Word (#311)", () => {
  it("sem demonstrativo base, o documento traz o mesmo aviso da tela", () => {
    expect(textos(true).some((t) => t.startsWith("Sem demonstrativo base"))).toBe(true);
  });

  it("com base, o documento não traz o aviso", () => {
    expect(textos(false).some((t) => t.startsWith("Sem demonstrativo base"))).toBe(false);
  });
});
