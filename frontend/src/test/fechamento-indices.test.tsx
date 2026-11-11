import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { mockApi } from "@/lib/mockApi";
import { condominioPadrao } from "@/domain/condominio";
import { exercicioPadrao } from "@/domain/exercicio";
import { demonstrativoVazio } from "@/domain/demonstrativo";
import { EditorDemonstrativo } from "@/components/demonstrativo/EditorDemonstrativo";
import type { Condominio, Exercicio } from "@/domain/types";

beforeEach(async () => {
  localStorage.clear();
  await mockApi.auth.entrar("admin", "admin123");
});
describe("Fechamento integrado", () => {
  it("persiste, bloqueia salvar/excluir, reabre com motivo e conserva snapshot", async () => {
    const c = await mockApi.salvar("condominios", {
      ...condominioPadrao(),
      id: "c-fechar",
      nome: "Fictício",
      unidades: 10,
    });
    const e = await mockApi.salvar("exercicios", { ...exercicioPadrao(c, 2026), id: "e-fechar" });
    const fechado = await mockApi.fechamentoExercicio(e.id, true, "", e.atualizadoEm ?? null);
    expect((await mockApi.obter<Exercicio>("exercicios", e.id))?.fechado).toBe(true);
    await expect(
      mockApi.salvar("exercicios", { ...fechado, fechado: false }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(mockApi.excluir("exercicios", e.id)).rejects.toMatchObject({ status: 409 });
    await mockApi.salvar("condominios", { ...c, unidades: 90 });
    expect(fechado.fechamento?.condominio.unidades).toBe(10);
    await expect(
      mockApi.fechamentoExercicio(e.id, false, "", fechado.atualizadoEm ?? null),
    ).rejects.toMatchObject({ status: 400 });
    const aberto = await mockApi.fechamentoExercicio(
      e.id,
      false,
      "Conferência",
      fechado.atualizadoEm ?? null,
    );
    expect(aberto.fechado).toBe(false);
    expect(aberto.historicoFechamento?.at(-1)?.motivo).toBe("Conferência");
  });
  it("importa histórico, permite manutenção e não repõe exclusão manual", async () => {
    const c = await mockApi.salvar("condominios", {
      ...condominioPadrao(),
      id: "c-indices",
      nome: "Fictício",
    });
    const e = { ...exercicioPadrao(c, 2026), id: "e-indices" };
    e.consid.indices = [{ ano: 2025, pct: 6 }];
    await mockApi.salvar("exercicios", e);
    const cadastro = await mockApi.obter<Condominio>("condominios", c.id);
    expect(cadastro?.indices).toEqual([{ ano: 2025, pct: 6, noRelatorio: true }]);
    await mockApi.salvar("condominios", { ...cadastro!, indices: [] });
    await mockApi.salvar("exercicios", e);
    expect((await mockApi.obter<Condominio>("condominios", c.id))?.indices).toEqual([]);
  });
  it("todos os controles do demonstrativo ficam desabilitados", () => {
    const d = demonstrativoVazio("Fictício");
    d.receitas.itens = [{ nome: "Receita", valor: 100 }];
    d.despesas.grupos = [{ nome: "Grupo", itens: [{ nome: "Despesa", valor: 100 }] }];
    const { container } = render(
      <EditorDemonstrativo
        valor={d}
        onChange={() => {
          throw new Error("Não pode editar");
        }}
        bloqueado
      />,
    );
    for (const controle of container.querySelectorAll("input,button,select,textarea"))
      expect(controle).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Adicionar grupo" })).not.toBeInTheDocument();
  });
});
