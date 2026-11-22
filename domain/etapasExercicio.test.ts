import { describe, expect, it } from "vitest";
import { demonstrativoVazio, recalcularDemonstrativo } from "@/domain/demonstrativo";
import {
  editalDoExercicio,
  etapasDoExercicio,
  type ChaveEtapa,
  type EstadoEtapa,
} from "@/domain/etapasExercicio";
import type { Demonstrativo } from "@/domain/types";

function demo(saldoAtual: number): Demonstrativo {
  return recalcularDemonstrativo({
    ...demonstrativoVazio("Teste"),
    saldoAnterior: { contas: [{ nome: "Conta", valor: 0 }], total: 0 },
    receitas: { itens: [{ nome: "Cotas", valor: 1000 }], subtotal: 0, totalComSaldo: 0 },
    despesas: { grupos: [{ nome: "Pessoal", itens: [{ nome: "Salários", valor: 800 }] }], subtotal: 0, saldoRestante: 0 },
    saldoAtual: { contas: [{ nome: "Conta", valor: saldoAtual }], total: 0 },
  });
}

const base = { condoId: "c1", ano: 2025, rateioAprovado: null, fechado: false };
const estados = (etapas: ReturnType<typeof etapasDoExercicio>) =>
  Object.fromEntries(etapas.map((e) => [e.chave, e.estado])) as Record<ChaveEtapa, EstadoEtapa>;

describe("fluxo guiado do exercício (#309)", () => {
  it("exercício novo: importar em andamento e o resto pendente", () => {
    const etapas = etapasDoExercicio({ ...base, demonstrativo: demonstrativoVazio("Teste") }, [], []);
    expect(estados(etapas)).toEqual({
      importar: "em_andamento",
      conferir: "pendente",
      previsao: "pendente",
      edital: "pendente",
      ata: "pendente",
      fechar: "pendente",
    });
  });

  it("saldo que não fecha deixa a conferência em andamento", () => {
    const etapas = etapasDoExercicio({ ...base, demonstrativo: demo(999) }, [], []);
    expect(estados(etapas).importar).toBe("concluida");
    expect(estados(etapas).conferir).toBe("em_andamento");
  });

  it("com saldo fechando, rateio aprovado, edital e ata, só falta fechar", () => {
    const editais = [{ id: "ed1", condoId: "c1", exercicio: "2025", data: "2026-03-10" }];
    const atas = [{ id: "at1", assembleiaId: "ed1" }];
    const etapas = etapasDoExercicio({ ...base, rateioAprovado: 450, demonstrativo: demo(200) }, editais, atas);
    expect(estados(etapas)).toMatchObject({
      importar: "concluida",
      conferir: "concluida",
      previsao: "concluida",
      edital: "concluida",
      ata: "concluida",
      fechar: "em_andamento",
    });
    expect(etapas.find((e) => e.chave === "ata")?.registroId).toBe("at1");
  });

  it("exercício fechado conclui a última etapa", () => {
    const etapas = etapasDoExercicio({ ...base, fechado: true, demonstrativo: demo(200) }, [], []);
    expect(estados(etapas).fechar).toBe("concluida");
  });

  it("edital de outro ano ou outro condomínio não conta", () => {
    const editais = [
      { id: "a", condoId: "c1", exercicio: "2024", data: "2025-03-10" },
      { id: "b", condoId: "c2", exercicio: "2025", data: "2026-03-10" },
    ];
    expect(editalDoExercicio({ condoId: "c1", ano: 2025 }, editais)).toBeNull();
  });
});
