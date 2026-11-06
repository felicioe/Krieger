import { describe, it, expect } from "vitest";
import { exercicioPadrao, normalizarExercicio } from "./exercicio";
import { condominioPadrao } from "./condominio";
import { demonstrativoBasePrevisao } from "./previsao";
import { montarRelatorioFinal } from "./relatorioFinal";
import type { Exercicio } from "./types";

describe("Fechamento e preservação das fontes", () => {
  const c = { ...condominioPadrao(), id: "condo-teste", nome: "Condomínio fictício", unidades: 10 };
  it("cria aberto e preserva estado ao normalizar legados", () => {
    expect(exercicioPadrao(c, 2026).fechado).toBe(false);
    expect(normalizarExercicio({ id: "e", fechado: true }).fechado).toBe(true);
    expect(normalizarExercicio({ id: "e" }).fechado).toBe(false);
  });
  it("relatório fechado não muda quando condomínio, ano anterior ou mensais externos mudam", () => {
    const e: Exercicio = { ...exercicioPadrao(c, 2026), id: "e", fechado: true };
    e.fechamento = { versao: 1, fechadoEm: "2026-11-06T12:00:00Z", fechadoPor: "usuario", condominio: structuredClone(c), mensais: [], exercicioAnterior: null, escritorio: null };
    const antes = montarRelatorioFinal({ exercicio: e, condominio: c, escritorio: null, mensais: [] });
    const outro = { ...c, unidades: 99, nome: "Nome alterado depois" };
    const d = structuredClone(e.demonstrativo)!;
    d.despesas.grupos = [{ nome: "Alteração externa", itens: [{ nome: "Despesa", valor: 99999 }] }];
    const depois = montarRelatorioFinal({ exercicio: e, condominio: outro, escritorio: null, mensais: [], exercicioAnterior: { demonstrativo: d } });
    expect(depois).toEqual(antes);
    expect(demonstrativoBasePrevisao(e, { demonstrativo: d })).toEqual(e.demonstrativo);
  });
});
