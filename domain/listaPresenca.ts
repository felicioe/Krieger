import { formatData } from "../lib/format";
import { nomeParaRelatorio } from "./condominio";
import { rotuloModalidade, rotuloTipo } from "./edital";
import type { Assembleia, Condominio } from "./types";

/**
 * Lista de presença impressa para assinatura na entrada da assembleia. O sistema não tem
 * cadastro de condôminos (só a contagem de unidades), então as linhas saem em branco — quem
 * assina preenche unidade, nome e assinatura na hora.
 */

export interface LinhaPresenca {
  numero: number;
}

export interface ListaPresenca {
  titulo: string;
  subtitulo: string;
  linhas: LinhaPresenca[];
}

/** Quantidade de linhas: a escolhida no edital (`linhasLista`) ou, na falta dela, o nº de unidades do condomínio. */
export function montarListaPresenca(condo: Condominio, assembleia: Assembleia): ListaPresenca {
  const total = assembleia.linhasLista ?? condo.unidades ?? 0;
  const linhas: LinhaPresenca[] = Array.from({ length: Math.max(total, 0) }, (_, i) => ({ numero: i + 1 }));
  return {
    titulo: `Lista de Presença — ${nomeParaRelatorio(condo)}`,
    subtitulo: `Assembleia ${rotuloTipo(assembleia.tipo)} (${rotuloModalidade(assembleia.modalidade)}) de ${formatData(assembleia.data)}`,
    linhas,
  };
}
