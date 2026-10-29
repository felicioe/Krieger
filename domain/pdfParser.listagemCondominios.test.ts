import { describe, expect, it } from "vitest";
import { lerListagemCondominios } from "@/domain/pdfParser";

// Estrutura real da "Listagem Completa de Condomínios" do Systemar (acompanha o mesmo padrão de
// `pdfParser.consideracoes.test.ts`: estrutura/formatação reais, nomes e dados fictícios — nunca
// nome/telefone de pessoa real nem CNPJ de condomínio real em fixture de teste). O espaçamento em
// colunas (múltiplos espaços entre nome/CNPJ/área e entre nome/telefone da administração) reflete
// o texto de verdade extraído do PDF pelo pipeline do app (pdf.js + domain/layoutTexto.ts) — não a
// extração de uma ferramenta de leitura genérica, que não preserva esse espaçamento.
const pagina1 = [
  "                          Sistema de Condomínios Auto-Gestão v. 4.2.5 (1.12)                                          Página 1 de 2",
  "                                     Listagem Completa de Condomínios - Alfabético",
  "  Cod. Nome do Condomínio                                               CNPJ                Area  Total (M2)",
  "       Endereço                                                                             Bairro",
  "       Cidade                                                           UF                  CEP",
  "   001 - CONDOMÍNIO RESIDENCIAL JARDIM TESTE                             1234567-89          0,000000",
  "       RUA DAS FLORES, 100                                                                  CENTRO",
  "       CIDADE EXEMPLO                                                   SC                  88.000-798",
  "       Síndico/Conselheiro                                              Telefone",
  "   002 - ASSOCIACAO EXEMPLO DOS CONDOMINOS                               11.222.333/0001-44  0,000000",
  "       RUA EXEMPLO, 131 - QUADRA 2                                                           BAIRRO TESTE",
  "       CIDADE EXEMPLO                                                   SC                  88.111-001",
  "       Síndico/Conselheiro                                              Telefone",
  "             Síndico: (ST B1) FULANO DE TAL",
  "       Conselheiro 1: (ST A 1) BELTRANO EXEMPLO",
  "       Conselheiro 2: (Externo) CICLANO AMOSTRA",
  "          Subsíndico: (ST B2) SICRANA TESTE                             47 0000-0000",
  "       Conselheiro 3: (ST A 6) FULANA SUBSTITUTA",
  "KRIEGER ASSESSORIA CONTÁBIL E CONDOMINIAL LTDA                                               Systemar Informática Ltda ® - 29/10/26 11:23",
].join("\n");

const pagina2 = [
  "                          Sistema de Condomínios Auto-Gestão v. 4.2.5 (1.12)                                          Página 2 de 2",
  "                                     Listagem Completa de Condomínios - Alfabético",
  "  Cod. Nome do Condomínio                                               CNPJ                Area  Total (M2)",
  "       Endereço                                                                             Bairro",
  "       Cidade                                                           UF                  CEP",
  "   003 - CONDOMÍNIO EXEMPLO SEM CNPJ                                                         0,000000",
  "       RUA SEM NUMERO, 10                                                                   BAIRRO DOIS",
  "       OUTRA CIDADE                                                     SC                  88.222-000",
  "       Síndico/Conselheiro                                              Telefone",
  "             Síndico: (SINDICA) FULANA EXEMPLO",
  "       Conselheiro 2: (00201) BELTRANA DOIS                             11 00000-0000",
  "       Conselheiro 1: (00901) CICLANO DOIS                               (54) 00000-0000",
  "   004 - CONDOMÍNIO EXEMPLO ENDERECO EM BRANCO                           00.000.000/0001-00  0,000000",
  "                                                                                             CENTRO",
  "       CIDADE TRES                                                      SC                  88.333-000",
  "       Síndico/Conselheiro                                              Telefone",
  "KRIEGER ASSESSORIA CONTÁBIL E CONDOMINIAL LTDA                                               Systemar Informática Ltda ® - 29/10/26 11:23",
  "Total:4",
].join("\n");

const texto = [pagina1, pagina2].join("\f");

describe("lerListagemCondominios", () => {
  it("devolve null quando o PDF não é essa listagem", () => {
    expect(lerListagemCondominios("Demonstrativo qualquer sem essa seção")).toBeNull();
  });

  it("lê os 4 condomínios das duas páginas, descartando cabeçalho/rodapé (inclusive na junção entre páginas)", () => {
    const r = lerListagemCondominios(texto)!;
    expect(r).not.toBeNull();
    expect(r.map((c) => c.codigo)).toEqual(["001", "002", "003", "004"]);
  });

  it("lê código, nome, CNPJ e área total — CNPJ ausente vira null, sem perder o nome", () => {
    const r = lerListagemCondominios(texto)!;
    expect(r[0]).toMatchObject({ codigo: "001", nome: "CONDOMÍNIO RESIDENCIAL JARDIM TESTE", cnpj: "1234567-89", areaTotalM2: 0 });
    expect(r[2]).toMatchObject({ codigo: "003", nome: "CONDOMÍNIO EXEMPLO SEM CNPJ", cnpj: null, areaTotalM2: 0 });
  });

  it("lê endereço, bairro, cidade, UF e CEP — endereço em branco vira string vazia sem perder o bairro", () => {
    const r = lerListagemCondominios(texto)!;
    expect(r[1]).toMatchObject({
      endereco: "RUA EXEMPLO, 131 - QUADRA 2",
      bairro: "BAIRRO TESTE",
      cidade: "CIDADE EXEMPLO",
      uf: "SC",
      cep: "88.111-001",
    });
    expect(r[3]).toMatchObject({ endereco: "", bairro: "CENTRO", cidade: "CIDADE TRES", uf: "SC", cep: "88.333-000" });
  });

  it("condomínio sem nenhum membro de administração vem com a lista vazia", () => {
    const r = lerListagemCondominios(texto)!;
    expect(r[0]!.administracao).toEqual([]);
    expect(r[3]!.administracao).toEqual([]);
  });

  it("lê os membros da administração em qualquer ordem, com identificação e telefone quando houver", () => {
    const r = lerListagemCondominios(texto)!;
    expect(r[1]!.administracao).toEqual([
      { cargo: "Síndico", identificacao: "ST B1", nome: "FULANO DE TAL", telefone: null },
      { cargo: "Conselheiro 1", identificacao: "ST A 1", nome: "BELTRANO EXEMPLO", telefone: null },
      { cargo: "Conselheiro 2", identificacao: "Externo", nome: "CICLANO AMOSTRA", telefone: null },
      { cargo: "Subsíndico", identificacao: "ST B2", nome: "SICRANA TESTE", telefone: "47 0000-0000" },
      { cargo: "Conselheiro 3", identificacao: "ST A 6", nome: "FULANA SUBSTITUTA", telefone: null },
    ]);
  });
});
