import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileClock } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { listaQuery } from "@/lib/queries";
import type { Importacao } from "@/domain/types";

/** Lembrete de PDFs importados de condomínios não cadastrados que aguardam conferência. */
export function AvisoImportacoesPendentes() {
  const { data = [] } = useQuery(listaQuery<Importacao>("importacoes"));
  const n = data.filter((i) => i.status === "pendente").length;
  if (!n) return null;
  return (
    <Alert variant="warning" className="mb-4">
      <FileClock />
      <AlertDescription>
        {n === 1 ? "Há 1 importação de PDF aguardando" : `Há ${n} importações de PDF aguardando`} a conferência do cadastro do condomínio.{" "}
        <Link to="/importacoes" className="font-medium underline">
          Ver importações
        </Link>
      </AlertDescription>
    </Alert>
  );
}
