import { describe, expect, it } from "vitest";
import { condominioPadrao } from "@/domain/condominio";
import { recalcularDemonstrativo } from "@/domain/demonstrativo";
import {
  competenciaMensal,
  mensalPadrao,
  periodoDoMes,
  prepararMensal,
  relatorioAnterior,
  unidadesDoUltimoRelatorio,
  validarMensal,
} from "@/domain/mensal";
import type { Condominio, Mensal } from "@/domain/types";

const condo: Condominio = { ...condominioPadrao(), id: "c1", nome: "Acácias" };

function comSaldo(mes: number, ano: number): Mensal {
  const m = { id: `m${mes}`, ...mensalPadrao(condo, { mes, ano }) };
  m.demonstrativo = recalcularDemonstrativo({
    ...m.demonstrativo!,
    receitas: { itens: [{ nome: "Taxa condominial", valor: 1000 }], subtotal: 0, totalComSaldo: 0 },
    despesas: { grupos: [{ nome: "Pessoal", itens: [{ nome: "Salários", valor: 600 }] }], subtotal: 0, saldoRestante: 0 },
    saldoAtual: { contas: [{ nome: "Conta corrente", valor: 400 }], total: 0 },
  });
  return m;
}

describe("relatório mensal", () => {
  it("o período do novo relatório cobre o mês inteiro", () => {
    expect(periodoDoMes({ mes: 2, ano: 2024 })).toEqual({ ini: "01/02/2024", fim: "29/02/2024" });
    expect(competenciaMensal(mensalPadrao(condo, { mes: 9, ano: 2026 }))).toEqual({ mes: 9, ano: 2026 });
  });

  it("partindo do mês anterior: saldo anterior = saldo atual dele; nomes copiados com valores zerados", () => {
    const anterior = comSaldo(1, 2026);
    const novo = mensalPadrao(condo, { mes: 2, ano: 2026 }, anterior);
    expect(novo.demonstrativo!.saldoAnterior.contas).toEqual([{ nome: "Conta corrente", valor: 400 }]);
    expect(novo.demonstrativo!.saldoAnterior.total).toBe(400);
    expect(novo.demonstrativo!.despesas.grupos).toEqual([{ nome: "Pessoal", itens: [{ nome: "Salários", valor: 0 }] }]);
    expect(novo.demonstrativo!.receitas.itens).toEqual([{ nome: "Taxa condominial", valor: 0 }]);
  });

  it("encontra o relatório do mês anterior, inclusive na virada do ano", () => {
    const dez = comSaldo(12, 2025);
    expect(relatorioAnterior("c1", { mes: 1, ano: 2026 }, [dez])?.id).toBe("m12");
    expect(relatorioAnterior("outro", { mes: 1, ano: 2026 }, [dez])).toBeNull();
  });

  it("unidades do último relatório mensal com essa informação (quantidade de unidades lida do PDF)", () => {
    const comUnidades = (mes: number, ano: number, unidades: number | null): Mensal => ({
      ...comSaldo(mes, ano),
      receber: { unidades, valor: unidades ? 1000 : null },
    });
    expect(unidadesDoUltimoRelatorio("c1", [])).toBeNull();
    expect(unidadesDoUltimoRelatorio("c1", [comUnidades(1, 2026, null)])).toBeNull();
    // pega o mais recente entre os que têm o dado, ignorando os sem
    expect(
      unidadesDoUltimoRelatorio("c1", [
        comUnidades(1, 2026, 48),
        comUnidades(3, 2026, 50),
        comUnidades(2, 2026, null),
        { ...comUnidades(1, 2026, 99), id: "outro", condoId: "outro-condo" },
      ]),
    ).toBe(50);
  });

  it("um único relatório por condomínio e mês", () => {
    const jan = comSaldo(1, 2026);
    expect(validarMensal("c1", { mes: 1, ano: 2026 }, [jan]).ok).toBe(false);
    expect(validarMensal("c1", { mes: 1, ano: 2026 }, [jan], jan.id).ok).toBe(true);
    expect(validarMensal("c2", { mes: 1, ano: 2026 }, [jan]).ok).toBe(true);
    expect(validarMensal("c1", null, []).ok).toBe(false);
  });

  it("ao salvar descarta notas totalmente vazias", () => {
    const m = comSaldo(1, 2026);
    m.notas = [
      { rubrica: "", texto: "", valor: null },
      { rubrica: "Energia elétrica", texto: "Reajuste", valor: null },
    ];
    expect(prepararMensal(m).notas).toHaveLength(1);
  });
});
