import { describe, expect, it } from "vitest";
import { lerApoliceSeguro } from "@/domain/pdfParser";

describe("lerApoliceSeguro — layouts Tokio Marine usados no Lago Negro", () => {
  it.each([
    {
      ano: "2023–2024",
      texto: `Tokio Marine Condomínio - Apólice de Seguro
Vigência do Seguro: a partir das 24 horas do dia 21/05/2023 até às 24 horas do dia 21/05/2024.
Dados do Seguro
Ramo: 01.16 Apólice: 00797613
Segurado: CONDOMINIO RURAL LAGO NEGRO CNPJ: 019.741.383/0001-87
Coberturas Contratadas Franquias
de Indenização R$
Incêndio, Raio, Explosão, 2.800.000,00 123,49
Fumaça e Queda Aeronave
Danos Elétricos 20.000,00 631,35 20% com mínimo de R$ 3500,00
Despesas Fixas 30.000,00 7,61
Prêmio Líquido Total: 2.247,04
Limite Máximo de Garantia: R$3.190.000,00`,
      apolice: "00797613",
      inicio: "21/05/2023",
      fim: "21/05/2024",
      risco: 3190000,
      coberturas: [{ desc: "Danos Elétricos", valor: 20000 }, { desc: "Despesas Fixas", valor: 30000 }],
    },
    {
      ano: "2024–2025",
      texto: `Tokio Marine Condomínio - Apólice de Seguro
Vigência do Seguro: a partir das 24 horas do dia 21/05/2024 até às 24 horas do dia 21/05/2025.
Dados do Seguro
Ramo: 01.16 Apólice: 00801293
Segurado: CONDOMINIO RURAL LAGO NEGRO CNPJ: 019.741.383/0001-87
Coberturas Contratadas P.O.S
de Indenização R$
Incêndio, Raio, Explosão, 3.000.000,00 145,33
Fumaça e Queda Aeronave
Danos Elétricos 30.000,00 1.163,38 20% com mínimo de R$ 4000,00
Roubo e Subtração de Bens com 25.000,00 130,69 10% com mínimo de R$ 200,00
Arrombamento
Prêmio Líquido Total: 3.008,81
Limite Máximo de Garantia: R$3.390.000,00`,
      apolice: "00801293",
      inicio: "21/05/2024",
      fim: "21/05/2025",
      risco: 3390000,
      coberturas: [{ desc: "Danos Elétricos", valor: 30000 }, { desc: "Roubo e Subtração de Bens com", valor: 25000 }],
    },
    {
      ano: "2025–2026",
      texto: `Obrigado por escolher a Tokio Marine Seguradora!
Vigência: a partir das 24 horas do dia 21/05/2025 até às 24 horas do dia 21/05/2026.
Ramo: 01.16 Apólice: 00805922
Segurado: CONDOMINIO RURAL LAGO NEGRO CNPJ: 019.741.383/0001-87
Coberturas Contratadas Prêmio Líquido R$
Indenização
Incêndio, Raio, Explosão, Fumaça e Queda 3.000.000,00 136,55
Aeronave
Danos Elétricos 30.000,00 1.467,33
Responsabilidade Civil Danos Morais 30.000,00 18,81
Assistência 24 horas Plano Básico 27,18
Prêmio Líquido Total: 3.694,82
Limite Máximo de Garantia: R$3.390.000,00`,
      apolice: "00805922",
      inicio: "21/05/2025",
      fim: "21/05/2026",
      risco: 3390000,
      coberturas: [{ desc: "Danos Elétricos", valor: 30000 }, { desc: "Responsabilidade Civil Danos Morais", valor: 30000 }],
    },
  ])("reconhece o layout $ano sem depender da corretora", ({ texto, apolice, inicio, fim, risco, coberturas }) => {
    const r = lerApoliceSeguro(texto);
    expect(r).not.toBeNull();
    expect(r).toMatchObject({ numeroApolice: apolice, vigenciaIni: inicio, vigenciaFim: fim, riscoAbsoluto: risco });
    expect(r?.condominio).toEqual({ codigo: null, nome: "CONDOMINIO RURAL LAGO NEGRO", cnpj: "019.741.383/0001-87" });
    expect(r?.coberturas).toEqual(coberturas);
  });
});
