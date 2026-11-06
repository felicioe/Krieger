import { describe, expect, it } from "vitest";
import {
  classificarDocumentoPorNome,
  dataPorExtenso,
  extrairCidadeDoEndereco,
  montarParagrafoProvidencia,
  resolverAlocacaoDocumentoDrive,
  valorPorExtensoBRL,
} from "./notificacao";

describe("notificacao (domínio)", () => {
  it("converte valor monetário para extenso em reais conforme padrão das notificações", () => {
    expect(valorPorExtensoBRL(486.3)).toBe("quatrocentos e oitenta e seis reais e trinta centavos");
    expect(valorPorExtensoBRL(1200)).toBe("mil e duzentos reais");
    expect(valorPorExtensoBRL(1)).toBe("um real");
  });

  it("formata data por extenso e extrai cidade do endereço do condomínio", () => {
    expect(dataPorExtenso("08/07/2026")).toBe("08 de julho de 2026");
    expect(
      extrairCidadeDoEndereco("RUA SANTA RITA, 97 - SÃO FRANCISCO DE ASSIS - CAMBORIÚ/SC - CEP 88.340-774"),
    ).toBe("Camboriú");
  });

  it("monta parágrafo de multa com valor e extenso", () => {
    const p = montarParagrafoProvidencia({
      modalidade: "reincidencia_multa",
      enquadramentoMulta: "30% (trinta por cento) do valor do salário mínimo nacional, nos termos do Art. 94 da Convenção",
      valorMulta: 486.3,
    });
    expect(p).toContain("R$ 486,30 (quatrocentos e oitenta e seis reais e trinta centavos)");
    expect(p).toContain("boleto da taxa condominial");
  });

  it("classifica documentos pelo nome sem restringir apenas a convenção/regimento/ata", () => {
    expect(classificarDocumentoPorNome("Convenção Condominial.pdf")).toBe("convencao");
    expect(classificarDocumentoPorNome("Regimento Interno.docx")).toBe("regimento");
    expect(classificarDocumentoPorNome("Ata AGO 2026.pdf")).toBe("ata");
    expect(classificarDocumentoPorNome("Apolice Tokio Marine.pdf")).toBe("seguro");
    expect(classificarDocumentoPorNome("Contrato Elevadores.docx")).toBe("contrato");
    expect(classificarDocumentoPorNome("Foto Extintores.jpg")).toBe("laudo");
    expect(classificarDocumentoPorNome("Comunicado Piscina.pdf")).toBe("outro");
  });

  it("preserva pastas e subpastas ao importar pasta e aloca avulsos não identificados em Outros Documentos", () => {
    // 1. Arquivo dentro de pasta e subpasta na importação de diretório
    const sub = resolverAlocacaoDocumentoDrive({
      nomeArquivo: "Ata_Maio.pdf",
      caminhoRelativoOrigem: "Santa Cecilia/Atas/2025/Ata_Maio.pdf",
    });
    expect(sub.regra).toBe("subpasta_origem");
    expect(sub.pasta).toBe("Atas/2025");
    expect(sub.caminhoRelativo).toBe("Atas/2025/Ata_Maio.pdf");
    expect(sub.tipo).toBe("ata");

    // 2. Arquivo avulso (fora de pasta) que o sistema identifica automaticamente pelo nome
    const auto = resolverAlocacaoDocumentoDrive({
      nomeArquivo: "Regimento_Interno_Santa_Cecilia.pdf",
      caminhoRelativoOrigem: "Santa Cecilia/Regimento_Interno_Santa_Cecilia.pdf",
    });
    expect(auto.regra).toBe("auto_nome");
    expect(auto.pasta).toBe("Regimento Interno");
    expect(auto.caminhoRelativo).toBe("Regimento Interno/Regimento_Interno_Santa_Cecilia.pdf");
    expect(auto.tipo).toBe("regimento");

    // 3. Arquivo avulso (fora de pasta) que o sistema NÃO identifica automaticamente -> Outros Documentos
    const outros = resolverAlocacaoDocumentoDrive({
      nomeArquivo: "Digitalizacao_00492.pdf",
    });
    expect(outros.regra).toBe("outros_padrao");
    expect(outros.pasta).toBe("Outros Documentos");
    expect(outros.caminhoRelativo).toBe("Outros Documentos/Digitalizacao_00492.pdf");
    expect(outros.tipo).toBe("outro");
  });
});
