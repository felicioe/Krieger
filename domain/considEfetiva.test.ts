import { describe, expect, it } from "vitest";
import {
  condominioComConsid,
  considDoCondominio,
  considEfetiva,
} from "@/domain/exercicio";
import type { Condominio, Exercicio } from "@/domain/types";

const condo = (over: Partial<Condominio> = {}) =>
  ({
    id: "c1",
    nome: "Teste",
    seguradora: "Seguradora A",
    vigenciaSeguro: "01/01/2027",
    ultGordura: "10/11/2026",
    indices: [],
    administracao: [],
    ...over,
  }) as Condominio;

const exercicio = (consid: Exercicio["consid"], fechado = false) =>
  ({ fechado, consid }) as Pick<Exercicio, "fechado" | "consid">;

describe("considerações finais: fonte única no cadastro (#307)", () => {
  it("exercício aberto lê os campos do cadastro, e não a cópia antiga", () => {
    const antigo = considDoCondominio(
      condo({ seguradora: "Antiga", vigenciaSeguro: "01/01/2025" }),
    );
    const efetiva = considEfetiva(exercicio(antigo), condo());
    expect(efetiva.seguradora).toBe("Seguradora A");
    expect(efetiva.vigenciaSeguro).toBe("01/01/2027");
  });

  it("exercício aberto mantém os campos que são do exercício (contas, consumos, extras)", () => {
    const base = considDoCondominio(condo());
    const comContas = {
      ...base,
      contasReceber: { total: 5 },
      consumoAguaManual: 42,
      extras: [{ rotulo: "x", valor: 1 }],
    } as Exercicio["consid"];
    const efetiva = considEfetiva(exercicio(comContas), condo());
    expect(efetiva.contasReceber).toEqual({ total: 5 });
    expect(efetiva.consumoAguaManual).toBe(42);
    expect(efetiva.extras).toEqual([{ rotulo: "x", valor: 1 }]);
  });

  it("exercício fechado não muda: vale o que foi congelado", () => {
    const congelado = considDoCondominio(condo({ seguradora: "Congelada" }));
    const efetiva = considEfetiva(
      exercicio(congelado, true),
      condo({ seguradora: "Nova" }),
    );
    expect(efetiva.seguradora).toBe("Congelada");
  });

  it("ida e volta: gravar no cadastro e ler de volta não perde nada", () => {
    const original = considDoCondominio(condo());
    const editado = {
      ...original,
      seguradora: "Nova Seguradora",
      ultGordura: "20/11/2026",
    };
    const c2 = condominioComConsid(condo(), editado);
    const lido = considDoCondominio(c2);
    expect(lido.seguradora).toBe("Nova Seguradora");
    expect(lido.ultGordura).toBe("20/11/2026");
    expect(lido.vistoriaIntervalo).toBe(original.vistoriaIntervalo);
  });

  it("sem cadastro carregado, mantém o exercício como está", () => {
    const consid = considDoCondominio(condo());
    expect(considEfetiva(exercicio(consid), null)).toBe(consid);
  });
});
