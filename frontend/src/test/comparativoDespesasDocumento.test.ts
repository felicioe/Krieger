import { describe, expect, it } from "vitest";
import { demonstrativoVazio } from "@/domain/demonstrativo";
import { comparativoDespesas } from "@/domain/comparativoDespesas";
import { documentoComparativoDespesas } from "@/documentos/comparativoDespesas";
import { podeAcessarRota } from "@/lib/permissoes";
import type { Demonstrativo, Usuario } from "@/domain/types";

const ex = (ano: number, grupos: Demonstrativo["despesas"]["grupos"]) => ({
  ano,
  demonstrativo: {
    ...demonstrativoVazio("T"),
    despesas: { grupos, subtotal: 0, saldoRestante: 0 },
  },
});

describe("Comparativo de despesas em PDF/Word (#252)", () => {
  const r = comparativoDespesas([
    ex(2024, [{ nome: "Pessoal", itens: [{ nome: "Salários", valor: 900 }] }]),
    ex(2025, [
      { nome: "Pessoal", itens: [{ nome: "Salários", valor: 1000 }] },
      { nome: "Manutenção", itens: [{ nome: "Elevadores", valor: 300 }] },
    ]),
  ]);
  const doc = documentoComparativoDespesas({
    resultado: r,
    analitico: false,
    condominio: null,
    nomeCondominio: "Teste",
    escritorio: null,
  });

  it("tabela com um ano por coluna, célula vazia para grupo ausente e total no rodapé", () => {
    const tabela = doc.blocos.find((b) => b.tipo === "tabela");
    if (!tabela || tabela.tipo !== "tabela") throw new Error("sem tabela");
    expect(tabela.colunas.map((c) => c.titulo)).toEqual([
      "Grupo",
      "2024",
      "2025",
      "Variação (R$)",
      "Variação (%)",
    ]);
    const manutencao = tabela.linhas.find((l) => l.celulas[0] === "Manutenção");
    expect(manutencao?.celulas[1]).toBe("");
    expect(tabela.linhas.at(-1)?.celulas[0]).toBe("Total");
    expect(doc.orientacao).toBe("paisagem");
  });

  it("rota do relatório segue a permissão de prestação de contas", () => {
    const usuario = {
      id: "u",
      login: "u",
      nome: "U",
      perfil: "user",
      trocarSenha: false,
      permissoes: ["painel.visualizar"],
    } as Usuario;
    expect(podeAcessarRota(usuario, "/relatorios/comparativo-despesas")).toBe(false);
    expect(
      podeAcessarRota(
        { ...usuario, permissoes: ["prestacao_contas.visualizar"] },
        "/relatorios/comparativo-despesas",
      ),
    ).toBe(true);
  });
});
