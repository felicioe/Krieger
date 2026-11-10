import { describe, expect, it } from "vitest";
import { condominioPadrao } from "@/domain/condominio";
import type { Ata, Condominio } from "@/domain/types";
import type { Bloco } from "@/lib/documento/tipos";

const condo: Condominio = {
  ...condominioPadrao(),
  id: "c1",
  codigo: "243",
  nome: "Lago Negro",
  nomeRelatorio: "Condomínio Rural Lago Negro",
  cnpj: "19.741.383/0001-87",
  enderecoEdital: "Rua Augusto Wolf, s/n, Vargedo, Rancho Queimado/SC",
  unidades: 120,
};

const ata: Ata = {
  id: "a1",
  condoId: "c1",
  assembleiaId: "as1",
  tipo: "ordinaria",
  data: "2025-12-13",
  hora: "09:00",
  modalidade: "presencial",
  local: "nas dependências do condomínio",
  mesa: { presidente: "Roberto Fuck de Almeida", secretario: "Alexandre Krieger" },
  presentes: [
    { unidade: "LARA 02", nome: "Roni Paulo", procurador: false },
    { unidade: "CEDR 17", nome: "Deoni Segalin", procurador: true },
  ],
  quorum: { unidadesPresentes: 24, totalUnidades: 120 },
  itens: [
    { titulo: "Leitura e aprovação da ata anterior", discussao: "Lida sem ressalvas", deliberacao: "Aprovada por unanimidade", votos: { favor: 24, contra: 0, abstencao: 0 } },
    { titulo: "Aprovação das contas", discussao: "", deliberacao: "Aprovadas", votos: { favor: 20, contra: 1, abstencao: 3 } },
  ],
  encerramento: "Não havendo mais assuntos.",
  observacoes: "",
  status: "finalizada",
};

const MODELO = `# ATA DA ASSEMBLEIA GERAL {{ata.tipo}}

## {{condominio.nomeRelatorio}}

Aos {{ata.dataExtenso}}, às {{ata.hora}}, no {{ata.local}}, reuniram-se os condôminos do {{condominio.nomeRelatorio}}, CNPJ {{condominio.cnpj}}, para Assembleia Geral Ordinária.

## Unidades presentes

{{ata.unidades}}

Quórum: {{ata.quorumTexto}}.

## Ordem do dia

{{ata.itensTexto}}

## Encerramento

{{ata.encerramento}}

{{cidade}}, {{ata.data}}.`;

const blocos = (b: Bloco[]) => b;

describe("documento da ata com modelo de cartório", () => {
  it("converte #, ## e listas do texto do modelo nos blocos correspondentes", async () => {
    const { documentoAta } = await import("@/documentos/ata");
    const doc = documentoAta({ ata, condominio: condo, cidade: "Rancho Queimado", escritorio: null, modelo: { texto: `${MODELO}\n\n- primeiro item\n- segundo item` } });

    const titulos = doc.blocos.filter((b): b is Extract<Bloco, { tipo: "titulo" }> => b.tipo === "titulo");
    expect(titulos[0]?.nivel).toBe(1);
    expect(titulos[0]?.texto).toBe("ATA DA ASSEMBLEIA GERAL Ordinária");
    expect(titulos.some((t) => t.nivel === 2 && t.texto === "Condomínio Rural Lago Negro")).toBe(true);

    const listas = doc.blocos.filter((b): b is Extract<Bloco, { tipo: "lista" }> => b.tipo === "lista");
    expect(listas).toHaveLength(1);
    expect(listas[0]?.itens).toEqual(["primeiro item", "segundo item"]);
  });

  it("substitui as variáveis novas (dataExtenso, unidades, quorumTexto, itensTexto)", async () => {
    const { documentoAta } = await import("@/documentos/ata");
    const doc = documentoAta({ ata, condominio: condo, cidade: "Rancho Queimado", escritorio: null, modelo: { texto: MODELO } });
    const texto = blocos(doc.blocos)
      .map((b) => (b.tipo === "paragrafo" ? (typeof b.texto === "string" ? b.texto : b.texto.map((t) => t.texto).join("")) : b.tipo === "titulo" ? b.texto : ""))
      .join("\n");

    expect(texto).not.toContain("{{");
    expect(texto).toContain("13 de dezembro de 2025");
    expect(texto).toContain("LARA 02, CEDR 17");
    expect(texto).toContain("24 unidades presentes de 120 unidades (20,00%)");
    // itens numerados com discussão e deliberação
    expect(texto).toContain("1 — Leitura e aprovação da ata anterior.");
    expect(texto).toContain("Deliberação: Aprovadas");
    expect(texto).toContain("Rancho Queimado, 13/12/2025.");
  });

  it("respeita logoEscritorio e bordaPagina do modelo", async () => {
    const { documentoAta } = await import("@/documentos/ata");
    const escritorio = { id: "escritorio" as const, nome: "Krieger", cidade: "", rodape: "", assinatura: "", logo: "data:image/png;base64,AA", logoRatio: 3 };

    const semLogo = documentoAta({ ata, condominio: condo, cidade: "X", escritorio, modelo: { texto: MODELO, logoEscritorio: false, bordaPagina: true } });
    expect(semLogo.timbre).toBeNull();
    expect(semLogo.bordaPagina).toBe(true);

    const comLogo = documentoAta({ ata, condominio: condo, cidade: "X", escritorio, modelo: { texto: MODELO, logoEscritorio: true, bordaPagina: false } });
    expect(comLogo.timbre?.nome).toBe("Krieger");
    expect(comLogo.bordaPagina).toBeUndefined();
  });
});
