import { describe, expect, it } from "vitest";
import { demonstrativoVazio } from "@/domain/demonstrativo";
import {
  colunasComparativoDespesas,
  comparativoDespesas,
  rodapeComparativoDespesas,
} from "@/domain/comparativoDespesas";
import type { Demonstrativo } from "@/domain/types";

function ex(ano: number, grupos: Demonstrativo["despesas"]["grupos"]) {
  return {
    ano,
    demonstrativo: { ...demonstrativoVazio("T"), despesas: { grupos, subtotal: 0, saldoRestante: 0 } },
  };
}

const exercicios = [
  ex(2025, [
    { nome: "Pessoal", itens: [{ nome: "Salários", valor: 1000 }, { nome: "Encargos", valor: 200 }] },
    { nome: "Manutenção", itens: [{ nome: "Elevadores", valor: 300 }] },
  ]),
  ex(2024, [{ nome: "Pessoal", itens: [{ nome: "Salários", valor: 900 }] }]),
  ex(2026, [
    { nome: "PESSOAL ", itens: [{ nome: "Salários", valor: 1500 }] },
    { nome: "Manutenção", itens: [{ nome: "Elevadores", valor: 330 }] },
  ]),
];

describe("comparativo de despesas entre exercícios (#252)", () => {
  it("ordena os exercícios e casa grupos com nome escrito diferente", () => {
    const r = comparativoDespesas(exercicios);
    expect(r.anos).toEqual([2024, 2025, 2026]);
    const pessoal = r.linhas.find((l) => l.grupo === "Pessoal")!;
    expect(pessoal.valores).toEqual([900, 1200, 1500]);
    expect(pessoal.variacao).toBe(600);
    expect(pessoal.variacaoPct).toBe(66.67);
  });

  it("grupo ausente num exercício fica vazio, nunca zero, e sem variação", () => {
    const r = comparativoDespesas(exercicios);
    const manutencao = r.linhas.find((l) => l.grupo === "Manutenção")!;
    expect(manutencao.valores).toEqual([null, 300, 330]);
    expect(manutencao.variacao).toBeNull();
    const colunas = colunasComparativoDespesas(r);
    expect(colunas[1]!.texto!(manutencao)).toBe("");
  });

  it("totais por exercício são a soma das linhas", () => {
    const r = comparativoDespesas(exercicios);
    expect(r.totais).toEqual([900, 1500, 1830]);
    expect(r.variacaoTotal).toBe(930);
    expect(rodapeComparativoDespesas(r)[0]).toBe("Total");
  });

  it("ordena por maior variação, ou pelo valor do último exercício", () => {
    expect(comparativoDespesas(exercicios).linhas.map((l) => l.grupo)).toEqual(["Pessoal", "Manutenção"]);
    expect(comparativoDespesas(exercicios, { ordem: "valor" }).linhas[0]!.grupo).toBe("Pessoal");
  });

  it("modo analítico abre por rubrica", () => {
    const r = comparativoDespesas(exercicios, { analitico: true });
    const encargos = r.linhas.find((l) => l.rubrica === "Encargos")!;
    expect(encargos.valores).toEqual([null, 200, null]);
  });

  it("período de um exercício só: sem variação", () => {
    const r = comparativoDespesas([exercicios[0]!]);
    expect(r.anos).toEqual([2025]);
    expect(r.linhas.every((l) => l.variacao === null && l.variacaoPct === null)).toBe(true);
    expect(r.variacaoTotal).toBeNull();
  });
});
