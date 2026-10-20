import { formatData } from "../lib/format";
import { nomeParaRelatorio } from "./condominio";
import { rotuloModalidade, rotuloTipo } from "./edital";
import type { Assembleia, Condominio } from "./types";

export interface LinhaPresenca {
  numero: number;
}

export interface ListaPresenca {
  titulo: string;
  subtitulo: string;
  linhas: LinhaPresenca[];
}

export function montarListaPresenca(condo: Condominio, assembleia: Assembleia): ListaPresenca {
  const total = assembleia.linhasLista ?? condo.unidades ?? 0;
  const linhas: LinhaPresenca[] = Array.from({ length: Math.max(total, 0) }, (_, i) => ({ numero: i + 1 }));
  return {
    titulo: `Lista de Presença — ${nomeParaRelatorio(condo)}`,
    subtitulo: `Assembleia ${rotuloTipo(assembleia.tipo)} (${rotuloModalidade(assembleia.modalidade)}) de ${formatData(assembleia.data)}`,
    linhas,
  };
}
