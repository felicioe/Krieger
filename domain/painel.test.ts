import { describe, expect, it } from "vitest";
import { calcularPendenciasAjuste } from "@/domain/painel";
import { condominioPadrao } from "@/domain/condominio";
import { exercicioPadrao } from "@/domain/exercicio";
import { calcularPrevisaoSugerida, chaveDivergencia, compararComTotaisPdf } from "@/domain/previsaoSugerida";
import type { Condominio, Exercicio, PrevisaoSugeridaExercicio } from "@/domain/types";

const condo = (parcial: Partial<Condominio> = {}): Condominio => ({ ...condominioPadrao(), id: "c1", nome: "Condomínio Exemplo", ...parcial });

const previsaoComDivergencia: PrevisaoSugeridaExercicio = {
  rateioMensalAtual: 20000,
  categorias: [{ nome: "Pessoal", anual: 150000, media: 12500 }],
  deducoes: [],
  variacao: { sinal: "+", valor: 0 },
  totaisPdf: { totalDespesasAno: 100000, totalOrdinario: 100000, rateioAnualSugerido: 100000, rateioMensalSugerido: 8333.33, indiceSugerido: 5 },
};

const exercicio = (parcial: Partial<Exercicio> = {}): Exercicio => ({
  id: "e1",
  ...exercicioPadrao(condo(), 2026),
  ...parcial,
});

describe("calcularPendenciasAjuste", () => {
  it("condomínio com alertaCadastro vira uma pendência do tipo alerta_cadastro", () => {
    const r = calcularPendenciasAjuste([condo({ alertaCadastro: "Sem CNPJ nesta listagem — casado pelo código." })], []);
    expect(r).toEqual([
      { tipo: "alerta_cadastro", condoId: "c1", condoNome: "Condomínio Exemplo", descricao: "Sem CNPJ nesta listagem — casado pelo código." },
    ]);
  });

  it("condomínio sem alertaCadastro não entra na lista", () => {
    expect(calcularPendenciasAjuste([condo()], [])).toEqual([]);
  });

  it("previsão sugerida com divergência ainda não confirmada vira pendência do tipo divergencia_previsao", () => {
    const e = exercicio({ previsaoSugerida: previsaoComDivergencia });
    const r = calcularPendenciasAjuste([], [e]);
    expect(r).toEqual([
      { tipo: "divergencia_previsao", condoId: e.condoId, condoNome: e.condoNome, descricao: "Previsão sugerida do exercício 2026 em conferência", exercicioId: "e1" },
    ]);
  });

  it("sem previsão sugerida, ou sem divergência, não vira pendência", () => {
    expect(calcularPendenciasAjuste([], [exercicio()])).toEqual([]);
    const semDivergencia: PrevisaoSugeridaExercicio = { ...previsaoComDivergencia, totaisPdf: null };
    expect(calcularPendenciasAjuste([], [exercicio({ previsaoSugerida: semDivergencia })])).toEqual([]);
  });

  it("divergência já confirmada (decisão bate com a chave atual) deixa de ser pendência", () => {
    const confirmada: PrevisaoSugeridaExercicio = {
      ...previsaoComDivergencia,
      decisaoDivergencia: { chave: "", status: "confirmado", em: "2026-10-29T00:00:00.000Z", por: "u1", porNome: "Fulano" },
    };
    // A chave real depende dos valores calculados; recalcula a esperada em vez de montar a string à mão.
    const divergencias = compararComTotaisPdf(calcularPrevisaoSugerida(previsaoComDivergencia), previsaoComDivergencia.totaisPdf);
    confirmada.decisaoDivergencia!.chave = chaveDivergencia(divergencias);
    const r = calcularPendenciasAjuste([], [exercicio({ previsaoSugerida: confirmada })]);
    expect(r).toEqual([]);
  });

  it("divergência adiada ('revisar_depois') continua como pendência", () => {
    const adiada: PrevisaoSugeridaExercicio = {
      ...previsaoComDivergencia,
      decisaoDivergencia: { chave: "qualquer", status: "revisar_depois", em: "2026-10-29T00:00:00.000Z", por: "u1", porNome: "Fulano" },
    };
    const r = calcularPendenciasAjuste([], [exercicio({ previsaoSugerida: adiada })]);
    expect(r).toHaveLength(1);
  });
});
