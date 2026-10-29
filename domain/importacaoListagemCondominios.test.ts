import { describe, expect, it } from "vitest";
import { analisarListagemCondominios, type DadosReceitaResolvidos } from "@/domain/importacaoListagemCondominios";
import { condominioPadrao } from "@/domain/condominio";
import type { CondominioDaListagem } from "@/domain/pdfParser";
import type { Condominio } from "@/domain/types";

// Dados fictícios (mesmo padrão de pdfParser.listagemCondominios.test.ts — nunca nome/CNPJ real de
// condomínio ou pessoa em fixture de teste).
const linhaBase: CondominioDaListagem = {
  codigo: "227",
  nome: "ASSOCIACAO EXEMPLO DOS CONDOMINOS",
  cnpj: "11.222.333/0001-44",
  endereco: "RUA EXEMPLO, 131 - QUADRA 2",
  bairro: "BAIRRO TESTE",
  cidade: "CIDADE EXEMPLO",
  uf: "SC",
  cep: "88.111-001",
  areaTotalM2: 0,
  administracao: [{ cargo: "Síndico", identificacao: "ST B1", nome: "FULANO DE TAL", telefone: null }],
};

const condoExistente = (parcial: Partial<Condominio> = {}): Condominio => ({
  id: "c1",
  ...condominioPadrao(),
  codigo: "227",
  nome: "Associação Exemplo",
  cnpj: "11222333000144",
  ...parcial,
});

describe("analisarListagemCondominios", () => {
  it("casa pelo código quando o CNPJ da linha está ausente, e sinaliza o alerta sem travar", () => {
    const linha: CondominioDaListagem = { ...linhaBase, cnpj: null };
    const existente = condoExistente();
    const [r] = analisarListagemCondominios([linha], [existente], new Map());
    expect(r!.existente).toBe(existente);
    expect(r!.alertas).toEqual(["Sem CNPJ nesta listagem — casado pelo código."]);
    expect(r!.excluidoPorPadrao).toBe(false);
    // CNPJ existente é preservado (não some só porque esta listagem não trouxe o campo).
    expect(r!.proposto.cnpj).toBe("11222333000144");
  });

  it("sinaliza CNPJ duplicado nos dois condomínios do próprio lote, sem travar nenhum", () => {
    const a: CondominioDaListagem = { ...linhaBase, codigo: "281", nome: "CONDOMINIO RES. FULANA EXEMPLO", cnpj: "03.333.444/0001-55" };
    const b: CondominioDaListagem = { ...linhaBase, codigo: "282", nome: "CONDOMINIO RES. BELTRANA EXEMPLO", cnpj: "03.333.444/0001-55" };
    const [ra, rb] = analisarListagemCondominios([a, b], [], new Map());
    expect(ra!.alertas).toEqual(["CNPJ também aparece em outro condomínio desta importação — verifique."]);
    expect(rb!.alertas).toEqual(["CNPJ também aparece em outro condomínio desta importação — verifique."]);
  });

  it("exclui por padrão a própria Krieger (pelo CNPJ) e linhas 'TESTE -' (pelo nome), sem precisar o usuário filtrar", () => {
    const krieger: CondominioDaListagem = { ...linhaBase, codigo: "999", nome: "KRIEGER ASS. CONTÁBIL E CONDOMINIAL", cnpj: "05.248.266/0001-71" };
    const teste: CondominioDaListagem = { ...linhaBase, codigo: "928", nome: "TESTE - CONDOMÍNIO EXEMPLO", cnpj: "23.444.555/0001-66" };
    const normal: CondominioDaListagem = { ...linhaBase, codigo: "128", nome: "CONDOMÍNIO EXEMPLO", cnpj: "23.444.555/0001-66" };
    const [rk, rt, rn] = analisarListagemCondominios([krieger, teste, normal], [], new Map());
    expect(rk!.excluidoPorPadrao).toBe(true);
    expect(rt!.excluidoPorPadrao).toBe(true);
    expect(rn!.excluidoPorPadrao).toBe(false);
  });

  it("sem condomínio existente, tudo é proposto (novo cadastro) e a administração vem do PDF", () => {
    const [r] = analisarListagemCondominios([linhaBase], [], new Map());
    expect(r!.existente).toBeNull();
    expect(r!.proposto.codigo).toBe("227");
    expect(r!.proposto.administracao).toEqual([{ cargo: "Síndico", identificacao: "ST B1", nome: "FULANO DE TAL" }]);
  });

  it("com condomínio existente, só os campos que mudaram entram em camposAlterados", () => {
    const existente = condoExistente({ nome: "ASSOCIACAO EXEMPLO DOS CONDOMINOS", enderecoEdital: "já certo" });
    const linha: CondominioDaListagem = { ...linhaBase, nome: "ASSOCIACAO EXEMPLO DOS CONDOMINOS" };
    const [r] = analisarListagemCondominios([linha], [existente], new Map());
    expect(r!.camposAlterados).not.toContain("nome"); // já bate, não muda
    expect(r!.camposAlterados).toContain("administracao"); // existente não tinha administração nenhuma
  });

  it("quando a Receita Federal tem razão social e endereço pro CNPJ, usa esses valores em vez dos do PDF", () => {
    const receita = new Map<string, DadosReceitaResolvidos>([
      ["11222333000144", { razaoSocial: "ASSOCIACAO EXEMPLO DOS CONDOMINOS LTDA", endereco: "Endereço da Receita" }],
    ]);
    const [r] = analisarListagemCondominios([linhaBase], [], receita);
    expect(r!.proposto.nome).toBe("ASSOCIACAO EXEMPLO DOS CONDOMINOS LTDA");
    expect(r!.proposto.enderecoEdital).toBe("Endereço da Receita");
  });

  it("sem resposta da Receita (falha ou sem CNPJ), usa nome e endereço do próprio PDF", () => {
    const [r] = analisarListagemCondominios([linhaBase], [], new Map());
    expect(r!.proposto.nome).toBe("ASSOCIACAO EXEMPLO DOS CONDOMINOS");
    expect(r!.proposto.enderecoEdital).toBe("RUA EXEMPLO, 131 - QUADRA 2 - BAIRRO TESTE - CIDADE EXEMPLO/SC - CEP 88.111-001");
  });
});
