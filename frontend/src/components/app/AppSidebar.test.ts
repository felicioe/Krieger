import { describe, expect, it } from "vitest";
import { GRUPOS_MENU, ITENS_MENU } from "./AppSidebar";

const localizar = (to: string) => {
  const grupo = GRUPOS_MENU.find((candidato) => candidato.itens.some((item) => item.to === to));
  const item = grupo?.itens.find((candidato) => candidato.to === to);
  return { grupo, item };
};

describe("arquitetura do menu principal", () => {
  it("mantém cada rota em um único grupo", () => {
    const rotas = ITENS_MENU.map((item) => item.to);
    expect(new Set(rotas).size).toBe(rotas.length);
  });

  it("reúne importação e acompanhamento de carga", () => {
    expect(localizar("/importador").grupo?.titulo).toBe("Dados e importação");
    expect(localizar("/relatorio-mensal").grupo?.titulo).toBe("Dados e importação");
  });

  it("mantém apenas saídas analíticas no grupo de relatórios", () => {
    const grupo = GRUPOS_MENU.find(({ titulo }) => titulo === "Relatórios e análises");
    expect(grupo?.itens.map(({ to }) => to)).toEqual([
      "/previsto-realizado",
      "/relatorios/orcado-realizado-mensal",
      "/relatorios/inadimplencia",
      "/relatorios/comparativo-despesas",
      "/relatorios/consolidado-escritorio",
    ]);
  });

  it("reúne modelos com assembleias e documentos", () => {
    expect(localizar("/modelos").grupo?.titulo).toBe("Assembleias e documentos");
    expect(localizar("/modelos-ata").grupo?.titulo).toBe("Assembleias e documentos");
  });

  it("reúne usuários com administração sem ampliar o acesso", () => {
    const { grupo, item } = localizar("/usuarios");
    expect(grupo?.titulo).toBe("Administração");
    expect(item?.apenasAdmin).toBe(true);
  });

  it("preserva as permissões das rotas movidas", () => {
    expect(localizar("/importador").item?.permissao).toBe("importador.visualizar");
    expect(localizar("/relatorio-mensal").item?.permissao).toBe("relatorio_mensal.visualizar");
    expect(localizar("/modelos").item?.permissao).toBe("modelos.visualizar");
    expect(localizar("/modelos-ata").item?.permissao).toBe("modelos_ata.visualizar");
  });
});
