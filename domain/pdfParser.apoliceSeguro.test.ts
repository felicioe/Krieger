import { describe, expect, it } from "vitest";
import { lerApoliceSeguro } from "@/domain/pdfParser";

// Estrutura real do layout Allianz (ver domain/pdfParser.ts), dados fictícios. O "" imita o
// traço fora do padrão que essa fonte usa no lugar do hífen comum (achado lendo uma apólice real).
const apolice = [
  "  APÓLICE",
  "  SEGURO           CONDOMÍNIO",
  "     Seguradora Exemplar",
  "     Condomínio",
  "                                             Nº. da Proposta: 111222333 Emissão: 01/03/2025",
  "                                             Nº. da Apólice: 999888777M1X000011",
  "    Agradecemos por escolher a Seguradora Exemplar.",
  "    Essa é a apólice do seu seguro Condomínio.",
  "     SUAS INFORMAÇÕES",
  "  Nome: CONDOMÍNIO JARDIM TESTE                            CNPJ: 12.345.678/000199",
  "  Endereço de correspondência: R. EXEMPLO, 123",
  "0    INFORMAÇÕES DO SEGURO",
  "  Limite Máximo de Garantia da Apólice: R$ 5.000.000,00     Versão da tabela: 1/1",
  "  Vigência: das 24H de 15/03/2025 às 24H de 15/03/2026      Valor de Novo: Sim",
  "14 COBERTURAS                              Limite Máximo       Preço por",
  "                                          de Indenização      Cobertura       %         R$",
  "   Básica Simples                         R$  5.000.000,00   R$      200,00         Sem Franquia",
  "   Danos Elétricos                        R$     30.000,00   R$    1.500,00   20        3.000,00",
  "   RC Danos Morais                        R$      15.000,00  R$       10,00         Sem Franquia",
  "   Vendaval / Ciclone / Tornado / Granizo R$      45.000,00  R$      600,00   20        2.000,00",
  "   Assistência 24h                                           R$       12,00         Sem Franquia",
  "   Prêmio Líquido                                           R$     4.000,00",
].join("\n");

describe("lerApoliceSeguro", () => {
  it("lê seguradora, apólice, vigência completa, risco absoluto e condomínio", () => {
    const r = lerApoliceSeguro(apolice);
    expect(r).not.toBeNull();
    expect(r?.seguradora).toBe("Seguradora Exemplar");
    expect(r?.numeroApolice).toBe("999888777M1X000011");
    expect(r?.vigenciaIni).toBe("15/03/2025");
    expect(r?.vigenciaFim).toBe("15/03/2026");
    expect(r?.riscoAbsoluto).toBe(5000000);
    expect(r?.condominio).toEqual({ codigo: null, nome: "CONDOMÍNIO JARDIM TESTE", cnpj: "12.345.678/0001-99" });
  });

  it("coberturas: pega o limite máximo (1ª coluna de valor), ignora básica/assistência/prêmio", () => {
    const r = lerApoliceSeguro(apolice);
    expect(r?.coberturas).toEqual([
      { desc: "Danos Elétricos", valor: 30000 },
      { desc: "RC Danos Morais", valor: 15000 },
      { desc: "Vendaval / Ciclone / Tornado / Granizo", valor: 45000 },
    ]);
  });

  it("PDF de outro layout (ex.: demonstrativo do Systemar) não é reconhecido", () => {
    expect(lerApoliceSeguro("DEMONSTRATIVO GERAL ENCERRADO EM 31/10/2026\nCONSIDERAÇÕES FINAIS")).toBeNull();
  });

  it("reconhece o layout Tokio Marine/Firmo com assistência nomeada", () => {
    const r = lerApoliceSeguro([
      "Obrigado por escolher a Tokio Marine Seguradora!",
      "Vigência: a partir das 24 horas do dia 21/05/2025 até às 24 horas do dia 21/05/2026.",
      "Apólice: 00805922",
      "Segurado: CONDOMINIO RURAL LAGO NEGRO CNPJ: 019.741.383/0001-87",
      "Limite Máximo de Garantia: R$3.390.000,00",
      "Incêndio, Raio, Explosão, Fumaça e Queda Aeronave 3.000.000,00 136,55",
      "Danos Elétricos 30.000,00 1.467,33",
      "Assistência 24 horas Plano Básico 27,18",
      "Prêmio Líquido Total: 3.694,82",
    ].join("\n"));
    expect(r?.seguradora).toBe("Tokio Marine Seguradora");
    expect(r?.numeroApolice).toBe("00805922");
    expect(r?.riscoAbsoluto).toBe(3390000);
    expect(r?.coberturas).toEqual([{ desc: "Danos Elétricos", valor: 30000 }]);
  });
});
