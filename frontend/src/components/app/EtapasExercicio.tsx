import { CircleCheck, CircleDot, Circle } from "lucide-react";
import { Link } from "@/components/app/LinkPermitido";
import type { EtapaExercicio } from "@/domain/etapasExercicio";
import { cn } from "@/lib/utils";

const ROTULO_ESTADO: Record<EtapaExercicio["estado"], string> = {
  concluida: "concluída",
  em_andamento: "próximo passo",
  pendente: "pendente",
};

/**
 * Fluxo guiado do exercício (#309): mostra as seis etapas em ordem, com o estado calculado dos
 * dados que já existem e um atalho para a tela de cada etapa. Só orienta; não bloqueia nada.
 */
export function EtapasExercicio({
  etapas,
  exercicioId,
}: {
  etapas: EtapaExercicio[];
  exercicioId: string;
}) {
  return (
    <nav aria-label="Etapas do exercício" className="mb-6">
      <ol className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {etapas.map((etapa, i) => {
          const Icone =
            etapa.estado === "concluida"
              ? CircleCheck
              : etapa.estado === "em_andamento"
                ? CircleDot
                : Circle;
          return (
            <li
              key={etapa.chave}
              aria-current={etapa.estado === "em_andamento" ? "step" : undefined}
              className={cn(
                "rounded-md border px-3 py-2 text-sm",
                etapa.estado === "em_andamento" && "border-primary bg-primary/5",
                etapa.estado === "concluida" && "text-muted-foreground",
              )}
            >
              <div className="flex items-center gap-2 font-medium">
                <Icone
                  aria-hidden
                  className={cn(
                    "size-4 shrink-0",
                    etapa.estado === "concluida" && "text-success",
                    etapa.estado === "em_andamento" && "text-primary",
                  )}
                />
                <span>
                  {i + 1}. {etapa.titulo}
                </span>
                <span className="sr-only">({ROTULO_ESTADO[etapa.estado]})</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{etapa.detalhe}</p>
              <AtalhoEtapa etapa={etapa} exercicioId={exercicioId} />
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function AtalhoEtapa({ etapa, exercicioId }: { etapa: EtapaExercicio; exercicioId: string }) {
  const classe = "mt-1 inline-block text-xs underline underline-offset-2";
  if (etapa.chave === "previsao")
    return (
      <Link
        to="/previsao-orcamentaria"
        search={{ exercicio: exercicioId, modo: "rateio" }}
        className={classe}
      >
        Abrir a previsão
      </Link>
    );
  if (etapa.chave === "edital")
    return etapa.registroId ? (
      <Link to="/editais/$id" params={{ id: etapa.registroId }} className={classe}>
        Abrir o edital
      </Link>
    ) : (
      <Link to="/editais" className={classe}>
        Ir para editais
      </Link>
    );
  if (etapa.chave === "ata")
    return etapa.registroId ? (
      <Link to="/atas/$id" params={{ id: etapa.registroId }} className={classe}>
        Abrir a ata
      </Link>
    ) : (
      <Link to="/atas" className={classe}>
        Ir para atas
      </Link>
    );
  return null;
}
