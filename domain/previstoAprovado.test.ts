import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { previstoAprovadoDerivado, previstoDoExercicio, percentualExplicitoDoExercicio } from "./previstoAprovado";
import { percentualAprovadoDoHistorico } from "./historicoRateio";
import { demonstrativoVazio, recalcularDemonstrativo } from "./demonstrativo";
import type { Demonstrativo, Exercicio, HistoricoRateio, PrevisaoAprovada } from "./types";

const demo = (grupos: Demonstrativo["despesas"]["grupos"]): Demonstrativo =>
  recalcularDemonstrativo({ ...demonstrativoVazio("T"), despesas: { grupos, subtotal: 0, saldoRestante: 0 } });

const linha = (ano: number, extra: Partial<HistoricoRateio>): HistoricoRateio => ({
  id: `h${ano}`, condoId: "c1", ano, rateioAtual: null, rateioSugerido: null, variacao: null, rateioAprovado: 370, travadoEm: "", fonte: "importacao", exercicioId: null, ...extra,
});

const base = demo([{ nome: "Pessoal", itens: [{ nome: "Salários", valor: 120000 }] }]);

describe("previstoAprovadoDerivado", () => {
  it("exemplo da especificação: R$ 120.000 com 10% gera R$ 132.000", () => {
    const p = previstoAprovadoDerivado({ condoId: "c1", anoDestino: 2026, demonstrativoBase: base, historicoRateios: [linha(2025, { variacao: 10 })] });
    expect(p.situacao).toBe("ok");
    expect(p.totalPrevisto).toBe(132000);
    expect(p.origemPercentual).toBe("historico");
    expect(p.grupos[0]!.contas[0]).toMatchObject({ realizadoOrigem: 120000, previsto: 132000 });
  });

  it("total fecha pela soma das linhas arredondadas em centavos", () => {
    const b = demo([{ nome: "G", itens: [{ nome: "A", valor: 0.05 }, { nome: "B", valor: 0.05 }, { nome: "C", valor: 0.05 }] }]);
    const p = previstoAprovadoDerivado({ condoId: "c1", anoDestino: 2026, demonstrativoBase: b, historicoRateios: [linha(2025, { variacao: 10 })] });
    const soma = p.grupos[0]!.contas.reduce((s, c) => s + c.previsto, 0);
    expect(p.totalPrevisto).toBeCloseTo(soma, 2);
  });

  it("0% é válido e não vira pendência", () => {
    const p = previstoAprovadoDerivado({ condoId: "c1", anoDestino: 2026, demonstrativoBase: base, historicoRateios: [linha(2025, { variacao: 0 })] });
    expect(p.situacao).toBe("ok");
    expect(p.totalPrevisto).toBe(120000);
  });

  it("variação vazia no histórico é recalculada pelos rateios da própria linha (caso Lago Negro 321 → 370)", () => {
    expect(percentualAprovadoDoHistorico([linha(2025, { rateioAtual: 321 })], "c1", 2025)).toBe(15.26);
    expect(percentualAprovadoDoHistorico([linha(2025, { rateioSugerido: 321 })], "c1", 2025)).toBe(15.26);
    expect(percentualAprovadoDoHistorico([linha(2025, {})], "c1", 2025)).toBeNull();
    expect(percentualAprovadoDoHistorico([], "c1", 2025)).toBeNull();
  });

  it("sem base: sem previsão aprovada; sem percentual: pendente", () => {
    expect(previstoAprovadoDerivado({ condoId: "c1", anoDestino: 2026, demonstrativoBase: null }).situacao).toBe("sem_base");
    expect(previstoAprovadoDerivado({ condoId: "c1", anoDestino: 2026, demonstrativoBase: base }).situacao).toBe("sem_percentual");
  });

  it("percentual explícito do exercício ignora 0 (não informado) e o método em valor", () => {
    expect(percentualExplicitoDoExercicio({ variacao: 0, variacaoMetodo: "manual", variacaoParam: null })).toBeNull();
    expect(percentualExplicitoDoExercicio({ variacao: 0, variacaoMetodo: "percentual", variacaoParam: 8 })).toBe(8);
    expect(percentualExplicitoDoExercicio({ variacao: 0, variacaoMetodo: "valor", variacaoParam: 30000 })).toBeNull();
  });
});

describe("fixtures compartilhadas com o PHP (scripts/test-previsoes-aprovadas.php)", () => {
  const casos = JSON.parse(readFileSync(new URL("./fixtures/previsto-aprovado.json", import.meta.url), "utf8")) as {
    nome: string;
    percentual: number;
    mapeamento: { de: string; para: string }[];
    grupos: Demonstrativo["despesas"]["grupos"];
    esperado: { totalPrevisto: number; grupos: unknown[] };
  }[];
  for (const c of casos) {
    it(c.nome, () => {
      const p = previstoAprovadoDerivado({
        condoId: "c1",
        anoDestino: 2026,
        demonstrativoBase: demo(c.grupos),
        historicoRateios: [linha(2025, { variacao: c.percentual })],
        mapeamento: c.mapeamento,
      });
      expect(p.totalPrevisto).toBe(c.esperado.totalPrevisto);
      expect(p.grupos).toEqual(c.esperado.grupos);
    });
  }
});

describe("previsto aprovado gravado pelo servidor", () => {
  const registro: PrevisaoAprovada = {
    id: "pa-1", condoId: "c1", exercicioDestino: 2026, versao: 2, exercicioBaseId: "e25", percentualAprovado: 10, totalPrevisto: 999,
    grupos: [{ nome: "Pessoal", totalPrevisto: 999, contas: [{ grupo: "Pessoal", nome: "Salários", realizadoOrigem: 900, previsto: 999 }] }],
    origem: "aprovacao", aprovadoEm: "2025-12-01 10:00:00", aprovadoPor: "u1", anterior: null,
  };
  const exercicio = (extra: Partial<Exercicio> = {}) =>
    ({ id: "e26", condoId: "c1", condoNome: "T", ano: 2026, variacao: 0, variacaoMetodo: "manual", variacaoParam: null, ...extra }) as Exercicio;

  it("exercício aberto usa o registro gravado, com a versão", () => {
    const p = previstoDoExercicio(exercicio(), { demonstrativoBase: base, historicoRateios: [linha(2025, { variacao: 10 })], previsoesAprovadas: [registro] });
    expect(p.origem).toBe("aprovado");
    expect(p.versao).toBe(2);
    expect(p.totalPrevisto).toBe(999);
  });

  it("registro de outro condomínio ou ano não vale; sem registro deriva do exercício anterior", () => {
    const outros = [{ ...registro, condoId: "c2" }, { ...registro, exercicioDestino: 2027 }];
    const p = previstoDoExercicio(exercicio(), { demonstrativoBase: base, historicoRateios: [linha(2025, { variacao: 10 })], previsoesAprovadas: outros });
    expect(p.origem).toBe("derivado");
    expect(p.totalPrevisto).toBe(132000);
  });

  it("exercício fechado ignora a tabela: usa o previsto congelado; sem congelado, mantém o derivado", () => {
    const congelado = { ...registro, totalPrevisto: 555 };
    const fechadoComCongelado = exercicio({ fechado: true, fechamento: { versao: 1, fechadoEm: "", fechadoPor: "u", condominio: { mapeamento: [] } as never, mensais: [], exercicioAnterior: { demonstrativo: base }, escritorio: null, previstoAprovado: congelado } });
    expect(previstoDoExercicio(fechadoComCongelado, { previsoesAprovadas: [registro] }).totalPrevisto).toBe(555);
    const fechadoSemCongelado = exercicio({ fechado: true, fechamento: { versao: 1, fechadoEm: "", fechadoPor: "u", condominio: { mapeamento: [] } as never, mensais: [], exercicioAnterior: { demonstrativo: base }, escritorio: null } });
    const p = previstoDoExercicio(fechadoSemCongelado, { historicoRateios: [linha(2025, { variacao: 10 })], previsoesAprovadas: [registro] });
    expect(p.origem).toBe("derivado");
    expect(p.totalPrevisto).toBe(132000);
  });
});
