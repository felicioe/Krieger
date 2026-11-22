import { recalcularDemonstrativo } from "./demonstrativo";
import type { Assembleia, Ata, Exercicio } from "./types";

/**
 * Fluxo guiado do exercício (#309): importar → conferir → previsão → edital → ata → fechar.
 *
 * O estado de cada etapa sai só dos dados que já existem; nada é gravado e nenhuma etapa é
 * bloqueada. A primeira etapa ainda não concluída é marcada como "em andamento", para orientar
 * o próximo passo.
 */
export type ChaveEtapa = "importar" | "conferir" | "previsao" | "edital" | "ata" | "fechar";
export type EstadoEtapa = "pendente" | "em_andamento" | "concluida";
export interface EtapaExercicio {
  chave: ChaveEtapa;
  titulo: string;
  estado: EstadoEtapa;
  /** Explicação curta do estado, para a pessoa saber o que falta. */
  detalhe: string;
  /** Edital ou ata encontrados, para a tela montar o link direto. */
  registroId?: string;
}

type ExercicioEtapas = Pick<
  Exercicio,
  "condoId" | "ano" | "demonstrativo" | "rateioAprovado" | "fechado"
>;

function temLancamentos(e: ExercicioEtapas): boolean {
  const d = e.demonstrativo;
  if (!d) return false;
  const despesas = d.despesas?.grupos?.some((g) => g.itens?.length) ?? false;
  const receitas = (d.receitas?.itens?.length ?? 0) > 0;
  return despesas || receitas;
}

/** Edital do exercício: mesmo condomínio e campo "exercício" igual ao ano da prestação. */
export function editalDoExercicio(
  e: Pick<Exercicio, "condoId" | "ano">,
  editais: Pick<Assembleia, "id" | "condoId" | "exercicio" | "data">[],
): Pick<Assembleia, "id" | "condoId" | "exercicio" | "data"> | null {
  const doExercicio = editais.filter(
    (a) => a.condoId === e.condoId && String(a.exercicio).trim() === String(e.ano),
  );
  // Havendo mais de um (ordinária e extraordinária), usa o mais recente pela data.
  return doExercicio.sort((a, b) => String(b.data).localeCompare(String(a.data)))[0] ?? null;
}

export function etapasDoExercicio(
  e: ExercicioEtapas,
  editais: Pick<Assembleia, "id" | "condoId" | "exercicio" | "data">[],
  atas: Pick<Ata, "id" | "assembleiaId">[],
): EtapaExercicio[] {
  const importado = temLancamentos(e);
  const conferido =
    importado && e.demonstrativo ? recalcularDemonstrativo(e.demonstrativo).avisos.length === 0 : false;
  const previsao = e.rateioAprovado !== null && e.rateioAprovado !== undefined;
  const edital = editalDoExercicio(e, editais);
  const ata = edital ? (atas.find((a) => a.assembleiaId === edital.id) ?? null) : null;

  const lista: Omit<EtapaExercicio, "estado">[] = [
    {
      chave: "importar",
      titulo: "Importar",
      detalhe: importado ? "Demonstrativo com lançamentos." : "Importe ou lance o demonstrativo.",
    },
    {
      chave: "conferir",
      titulo: "Conferir",
      detalhe: conferido
        ? "Saldos fecham."
        : importado
          ? "Os saldos não fecham: confira o demonstrativo."
          : "Depende do demonstrativo.",
    },
    {
      chave: "previsao",
      titulo: "Previsão",
      detalhe: previsao ? "Rateio aprovado informado." : "Apure o reajuste e informe o rateio aprovado.",
    },
    {
      chave: "edital",
      titulo: "Edital",
      detalhe: edital ? "Edital criado para este exercício." : "Crie o edital da assembleia.",
      ...(edital ? { registroId: edital.id } : {}),
    },
    {
      chave: "ata",
      titulo: "Ata",
      detalhe: ata ? "Ata registrada." : edital ? "Registre a ata da assembleia." : "Depende do edital.",
      ...(ata ? { registroId: ata.id } : {}),
    },
    {
      chave: "fechar",
      titulo: "Fechar",
      detalhe: e.fechado ? "Exercício fechado." : "Feche o exercício ao concluir.",
    },
  ];
  const concluidas: Record<ChaveEtapa, boolean> = {
    importar: importado,
    conferir: conferido,
    previsao,
    edital: edital !== null,
    ata: ata !== null,
    fechar: !!e.fechado,
  };
  const proxima = lista.find((etapa) => !concluidas[etapa.chave])?.chave;
  return lista.map((etapa) => ({
    ...etapa,
    estado: concluidas[etapa.chave]
      ? "concluida"
      : etapa.chave === proxima
        ? "em_andamento"
        : "pendente",
  }));
}
