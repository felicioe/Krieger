import { beforeEach, describe, expect, it } from "vitest";
import {
  LIMITE_RECENTES,
  lerRecentes,
  registrarRecente,
  removerRecente,
} from "@/lib/condominiosRecentes";
import { opcoesCondominio } from "@/components/app/inputs";
import type { Condominio } from "@/domain/types";

const condo = (id: string, nome: string): Condominio =>
  ({ id, nome, codigo: id.toUpperCase() }) as Condominio;

let seq = 0;
// Cada teste usa um usuário novo: o estado em memória não é apagado entre os testes.
const novoUsuario = () => `teste-${++seq}`;

describe("condomínios recentes (#295)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("coloca o último escolhido no topo, sem duplicar, com limite de 5", () => {
    const u = novoUsuario();
    for (const id of ["a", "b", "c", "d", "e", "f"]) registrarRecente(u, id);
    expect(lerRecentes(u)).toEqual(["f", "e", "d", "c", "b"]);
    registrarRecente(u, "c");
    expect(lerRecentes(u)).toEqual(["c", "f", "e", "d", "b"]);
    expect(LIMITE_RECENTES).toBe(5);
  });

  it("mantém listas separadas por usuário", () => {
    const u1 = novoUsuario(),
      u2 = novoUsuario();
    registrarRecente(u1, "a");
    registrarRecente(u2, "b");
    expect(lerRecentes(u1)).toEqual(["a"]);
    expect(lerRecentes(u2)).toEqual(["b"]);
  });

  it("grava no navegador com a chave por usuário", () => {
    const u = novoUsuario();
    registrarRecente(u, "a");
    registrarRecente(u, "b");
    expect(JSON.parse(localStorage.getItem(`krieger.condominios.recentes.${u}`) ?? "[]")).toEqual([
      "b",
      "a",
    ]);
  });

  it("remove um condomínio da lista", () => {
    const u = novoUsuario();
    registrarRecente(u, "a");
    registrarRecente(u, "b");
    removerRecente(u, "a");
    expect(lerRecentes(u)).toEqual(["b"]);
  });

  it("sem usuário não grava nada", () => {
    registrarRecente(undefined, "a");
    expect(lerRecentes(undefined)).toEqual([]);
  });

  it("opções: os últimos (até 5) vêm primeiro, depois os demais em ordem alfabética", () => {
    const condos = [
      condo("1", "Zeta"),
      condo("2", "Alfa"),
      condo("3", "Beta"),
      condo("4", "Gama"),
      condo("5", "Delta"),
      condo("6", "Épsilon"),
      condo("7", "Chi"),
    ];
    const ids = opcoesCondominio(condos, false, ["6", "4", "1", "7", "2", "3"]).map((o) => o.valor);
    expect(ids).toEqual(["6", "4", "1", "7", "2", "3", "5"]);
  });

  it("sem histórico, a lista segue alfabética", () => {
    const condos = [condo("1", "Zeta"), condo("2", "Alfa")];
    expect(opcoesCondominio(condos, false, []).map((o) => o.valor)).toEqual(["2", "1"]);
  });

  it("opções de condomínio marcam a escolha para gravar como recente", () => {
    const opcoes = opcoesCondominio([condo("1", "Alfa")]);
    expect(opcoes.every((o) => o.ehCondominio)).toBe(true);
  });
});
