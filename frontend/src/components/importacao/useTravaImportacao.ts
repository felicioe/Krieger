import { useEffect, useState } from "react";
import { divergenciasImportacao, type DivergenciaImportacao } from "@/domain/importacao";
import type { Demonstrativo, DestinoImportacao } from "@/domain/types";
import { esquecerCriadoPorPdf, foiCriadoPorPdf } from "./criadoPorPdf";

export type DivergenciaPendente = {
  divergencias: DivergenciaImportacao[];
  importado: Demonstrativo;
  atual: Demonstrativo;
};

/**
 * Trava de divergência do PDF importado (só fluxo de tela; a comparação é `divergenciasImportacao`).
 * - Guarda o demonstrativo como veio do PDF (`marcarImportado`), ou o do registro recém-criado por PDF.
 * - No Salvar seguinte, se algum dos quatro totais mudou, abre a confirmação em vez de gravar.
 * - A referência só é esquecida quando a gravação dá certo; numa falha ela continua valendo.
 * - Depois disso, edições futuras do registro salvo não são mais conferidas.
 */
export function useTravaImportacao(
  destino: DestinoImportacao,
  id: string,
  demonstrativoInicial: Demonstrativo | null,
) {
  const [importado, setImportado] = useState<Demonstrativo | null>(() =>
    foiCriadoPorPdf(destino, id) ? demonstrativoInicial : null,
  );
  useEffect(() => esquecerCriadoPorPdf(destino, id), [destino, id]);

  const [pendente, setPendente] = useState<
    (DivergenciaPendente & { gravar: () => Promise<unknown> }) | null
  >(null);
  const [aberto, setAberto] = useState(false);

  async function gravarEEsquecer(referencia: Demonstrativo | null, gravar: () => Promise<unknown>) {
    await gravar();
    // Se outro PDF foi importado enquanto gravava, a referência nova continua.
    setImportado((atual) => (atual === referencia ? null : atual));
  }

  /** Chame depois de validar o formulário, no lugar da gravação direta. */
  function salvar(atual: Demonstrativo, gravar: () => Promise<unknown>) {
    if (importado) {
      const divergencias = divergenciasImportacao(importado, atual);
      if (divergencias.length > 0) {
        setPendente({ divergencias, importado, atual, gravar });
        setAberto(true);
        return;
      }
    }
    gravarEEsquecer(importado, gravar).catch(() => {
      /* o erro aparece no aviso global; a referência do PDF continua */
    });
  }

  return {
    marcarImportado: (d: Demonstrativo) => setImportado(d),
    salvar,
    dialogo: {
      aberto,
      aoMudar: setAberto,
      pendente,
      // Rejeita na falha: a janela continua aberta para tentar de novo ou voltar e revisar.
      aoConfirmar: () =>
        pendente ? gravarEEsquecer(pendente.importado, pendente.gravar) : Promise.resolve(),
    },
  };
}
