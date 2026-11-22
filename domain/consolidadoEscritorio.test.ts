import { describe, expect, it } from "vitest";
import { demonstrativoVazio, recalcularDemonstrativo } from "@/domain/demonstrativo";
import {
  consolidadoEscritorio,
  filtrarConsolidado,
  mesReferenciaPadrao,
  ordenarConsolidado,
  totaisConsolidado,
} from "@/domain/consolidadoEscritorio";
import type { HistoricoRateio, Mensal } from "@/domain/types";

function mensal(condoId: string, mes: number, ano: number, saldoAtual: number, receber: number): Mensal {
  const mm = String(mes).padStart(2, "0");
  const d = recalcularDemonstrativo({
    ...demonstrativoVazio("T"),
    periodo: { ini: `01/${mm}/${ano}`, fim: `28/${mm}/${ano}` },
    saldoAnterior: { contas: [{ nome: "Conta", valor: 0 }], total: 0 },
    receitas: { itens: [{ nome: "Cotas", valor: 1000 }], subtotal: 0, totalComSaldo: 0 },
    despesas: { grupos: [{ nome: "Pessoal", itens: [{ nome: "Salários", valor: 800 }] }], subtotal: 0, saldoRestante: 0 },
    saldoAtual: { contas: [{ nome: "Conta", valor: saldoAtual }], total: 0 },
  });
  return { id: `${condoId}${mm}`, condoId, condoNome: condoId, demonstrativo: d, origem: [], receber: { unidades: 1, valor: receber }, notas: [] };
}

const condominios = [
  { id: "a", nome: "Alfa", codigo: "001", cnpj: "11.111.111/0001-11" },
  { id: "b", nome: "Beta", codigo: "002", cnpj: "" },
  { id: "c", nome: "Gama", codigo: "003", cnpj: "" },
];
const mensais = [mensal("a", 10, 2026, 200, 500), mensal("b", 10, 2026, 999, 800), mensal("c", 9, 2026, 200, 100)];
const historico: HistoricoRateio[] = [
  { id: "h", condoId: "a", ano: 2025, rateioAtual: 400, rateioSugerido: null, variacao: 10, rateioAprovado: 440, travadoEm: "", fonte: "calculo", exercicioId: null },
];
const outubro = { mes: 10, ano: 2026 };

describe("consolidado do escritório (#253)", () => {
  const linhas = consolidadoEscritorio(condominios, mensais, historico, outubro);
  const por = (id: string) => linhas.find((l) => l.condoId === id)!;

  it("em dia: relatório do mês de referência com saldo que fecha", () => {
    expect(por("a").situacao).toBe("em_dia");
    expect(por("a").variacaoRateio).toBe(10);
    expect(por("a").inadimplencia).toBe(500);
  });

  it("incompleto: o saldo do mês de referência não fecha", () => {
    expect(por("b").situacao).toBe("incompleto");
  });

  it("atrasado: sem relatório do mês de referência; condomínio sem nada também aparece", () => {
    expect(por("c").situacao).toBe("atrasado");
    const semNada = consolidadoEscritorio([{ id: "z", nome: "Zeta", codigo: "", cnpj: "" }], [], [], outubro);
    expect(semNada[0]).toMatchObject({ situacao: "atrasado", receitas: null, ultimoMes: null });
    expect(semNada[0]!.motivo).toBe("Nenhum relatório mensal importado.");
  });

  it("ordena por atraso, por inadimplência e por saldo", () => {
    expect(ordenarConsolidado(linhas, "atraso").map((l) => l.condoId)).toEqual(["c", "b", "a"]);
    expect(ordenarConsolidado(linhas, "inadimplencia").map((l) => l.condoId)).toEqual(["b", "a", "c"]);
    expect(ordenarConsolidado(linhas, "saldo")[0]!.condoId).toMatch(/a|c/);
  });

  it("busca por nome, código ou CNPJ e filtra por situação", () => {
    expect(filtrarConsolidado(linhas, "alfa", "todas").map((l) => l.condoId)).toEqual(["a"]);
    expect(filtrarConsolidado(linhas, "002", "todas").map((l) => l.condoId)).toEqual(["b"]);
    expect(filtrarConsolidado(linhas, "11111111", "todas").map((l) => l.condoId)).toEqual(["a"]);
    expect(filtrarConsolidado(linhas, "", "atrasado").map((l) => l.condoId)).toEqual(["c"]);
  });

  it("totais do escritório são a soma das linhas", () => {
    expect(totaisConsolidado(linhas).inadimplencia).toBe(1400);
  });

  it("mês de referência padrão é o mês anterior, inclusive em janeiro", () => {
    expect(mesReferenciaPadrao(new Date(2026, 0, 15))).toEqual({ mes: 12, ano: 2025 });
    expect(mesReferenciaPadrao(new Date(2026, 10, 22))).toEqual({ mes: 10, ano: 2026 });
  });
});
