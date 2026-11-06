import { describe, expect, it } from "vitest";
import { formatNumeroBR, parseData, parseNumeroBR } from "@/lib/format";
import { backupAtrasado, calcularVencimentos, dataVistoria, proximasAssembleias } from "@/domain/painel";
import { condominioPadrao, normalizarCondominio, prepararCondominio } from "@/domain/condominio";
import { validarLogin, validarNovaSenha } from "@/domain/usuario";
import { nomeArquivoBackup } from "@/domain/backup";
import type { Assembleia, Condominio } from "@/domain/types";

const hoje = new Date(2026, 9, 19); // 19/10/2026

function condo(p: Partial<Condominio>): Condominio {
  return normalizarCondominio({ ...condominioPadrao(), id: "c1", nome: "Teste", ...p });
}

describe("valores em R$ no formato brasileiro", () => {
  it("formata 1234.56 como 1.234,56", () => {
    expect(formatNumeroBR(1234.56)).toBe("1.234,56");
  });
  it("aceita vírgula decimal e ponto de milhar", () => {
    expect(parseNumeroBR("1.234,56")).toBe(1234.56);
    expect(parseNumeroBR("650,5")).toBe(650.5);
    expect(parseNumeroBR("")).toBeNull();
  });
});

describe("datas", () => {
  it("lê dd/mm/aaaa e mm/aaaa (último dia do mês)", () => {
    expect(parseData("03/12/2026")?.getDate()).toBe(3);
    expect(parseData("02/2027")?.getDate()).toBe(28);
    expect(parseData("31/02/2026")).toBeNull();
  });
});

describe("painel — vencimentos em até 90 dias", () => {
  it("inclui o seguro que vence em 90 dias e exclui o que vence em 91", () => {
    const em90 = condo({ vigenciaSeguro: "17/01/2027" });
    const em91 = condo({ vigenciaSeguro: "18/01/2027" });
    expect(calcularVencimentos([em90], hoje)).toHaveLength(1);
    expect(calcularVencimentos([em91], hoje)).toHaveLength(0);
  });
  it("inclui itens já vencidos com dias negativos", () => {
    const v = calcularVencimentos([condo({ vigenciaExtintores: "09/10/2026" })], hoje);
    expect(v[0]?.dias).toBe(-10);
  });
  it("vistoria técnica vence em vistoriaAno + vistoriaIntervalo", () => {
    expect(dataVistoria({ vistoriaAno: 2023, vistoriaIntervalo: 3 })?.getFullYear()).toBe(2026);
  });
  it("considera o fim do mandato da administração (mm/aaaa)", () => {
    const v = calcularVencimentos([condo({ administracao: [{ cargo: "Síndico", nome: "X", mandatoFim: "12/2026" }] })], hoje);
    expect(v.map((x) => x.tipo)).toContain("mandato");
  });
});

describe("painel — backup", () => {
  it("avisa quando nunca foi feito ou tem mais de 30 dias", () => {
    expect(backupAtrasado(undefined, hoje)).toBe(true);
    expect(backupAtrasado(new Date(2026, 8, 18).toISOString(), hoje)).toBe(true); // 31 dias
    expect(backupAtrasado(new Date(2026, 8, 20).toISOString(), hoje)).toBe(false); // 29 dias
  });
});

describe("painel — próximas assembleias", () => {
  it("mostra só datas a partir de hoje, no máximo 5", () => {
    const a = (data: string) => ({ id: data, data, hora1: "" }) as Assembleia;
    const lista = ["2026-10-18", "2026-10-19", "2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05"].map(a);
    const r = proximasAssembleias(lista, hoje);
    expect(r).toHaveLength(5);
    expect(r[0]?.data).toBe("2026-10-19");
  });
});

describe("condomínio", () => {
  it("exige nome", () => {
    expect(prepararCondominio(condo({ nome: "  " })).ok).toBe(false);
  });
  it("usa o nome quando nomeRelatorio está vazio", () => {
    const r = prepararCondominio(condo({ nome: "Ed. Sol", nomeRelatorio: "" }));
    expect(r.ok && r.valor.nomeRelatorio).toBe("Ed. Sol");
  });
  it("padrões: vistoria a cada 3 anos e somente anual", () => {
    const p = condominioPadrao();
    expect(p.vistoriaIntervalo).toBe(3);
    expect(p.somenteAnual).toBe(true);
    expect(p.deducaoRegex).toBe("fundo de caixa p/ obras");
    expect(p.aguaRubrica).toBe("^[áa]gua");
  });
});

describe("usuários", () => {
  it("login: minúsculas, 3 a 40 caracteres, letras/números/ponto/hífen/sublinhado", () => {
    expect(validarLogin("maria.silva_2-x")).toBeNull();
    expect(validarLogin("ab")).not.toBeNull();
    expect(validarLogin("Maria")).not.toBeNull();
    expect(validarLogin("a".repeat(41))).not.toBeNull();
  });
  it("nova senha com no mínimo 8 caracteres e confirmação igual", () => {
    expect(validarNovaSenha("1234567", "1234567")).not.toBeNull();
    expect(validarNovaSenha("12345678", "12345679")).not.toBeNull();
    expect(validarNovaSenha("12345678", "12345678")).toBeNull();
  });
});

describe("backup", () => {
  it("nome do arquivo krieger-backup-AAAAMMDD.json", () => {
    expect(nomeArquivoBackup(hoje)).toBe("krieger-backup-20261019.json");
  });
});
