# Importação de PDF — regras

- The PDF divergence lock lives in `useTravaImportacao` (components/importacao): its baseline is only the demonstrativo applied from a PDF in this session or a record just created from a PDF (in-memory `criadoPorPdf`, never inferred from stored data), it is compared with the domain's `divergenciasImportacao`, and it is cleared only after a successful save, so later legitimate edits are never flagged.
- The PDF self-check (`ConferenciaPdf` in ResumoImportacao) only presents the domain's `resumoConferencia` state and coverage; it never claims the totals match unless the domain says `verificado`.
