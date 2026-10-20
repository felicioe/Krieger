import { formatData } from "@/lib/format";
import { nomeDeArquivo } from "@/lib/documento/baixar";
import type { Bloco, Documento } from "@/lib/documento/tipos";
import { nomeParaRelatorio } from "@/domain/condominio";
import { montarListaPresenca } from "@/domain/listaPresenca";
import { montarProcuracao } from "@/domain/procuracao";
import type { Assembleia, Condominio, ConfigEscritorio } from "@/domain/types";
import { timbreDoEscritorio } from "./comum";

/** Lista de presença e procuração: só desenham o que o domínio já montou. `assembleia.data` em aaaa-mm-dd. */

type Entrada = { assembleia: Assembleia; condominio: Condominio; escritorio: ConfigEscritorio | null };

const rodapeDe = (a: Assembleia, nome: string) => [nome, a.data && `Assembleia de ${formatData(a.data)}`].filter(Boolean).join(" · ");

export function documentoListaPresenca({ assembleia: a, condominio, escritorio }: Entrada): Documento {
  const lista = montarListaPresenca(condominio, a);
  const nome = nomeParaRelatorio(condominio);
  const blocos: Bloco[] = [
    { tipo: "titulo", nivel: 1, alinhamento: "centro", texto: lista.titulo },
    { tipo: "paragrafo", alinhamento: "centro", suave: true, texto: lista.subtitulo },
    { tipo: "espaco", altura: 6 },
  ];
  if (lista.linhas.length === 0) {
    blocos.push({ tipo: "paragrafo", suave: true, texto: "Sem linhas: informe as linhas da lista no edital ou as unidades no cadastro do condomínio." });
  } else {
    blocos.push({
      tipo: "tabela",
      grade: true,
      alturaLinha: 26,
      colunas: [
        { titulo: "Nº", largura: 28, alinhamento: "centro" },
        { titulo: "Unidade", largura: 70 },
        { titulo: "Nome", largura: "*" },
        { titulo: "Assinatura", largura: 170 },
      ],
      linhas: lista.linhas.map((l) => ({ celulas: [String(l.numero), "", "", ""] })),
    });
  }
  return {
    titulo: lista.titulo,
    arquivo: nomeDeArquivo("lista-de-presenca", condominio.codigo || nome, a.data),
    timbre: a.timbrado ? timbreDoEscritorio(escritorio) : null,
    rodape: rodapeDe(a, nome),
    blocos,
  };
}

export function documentoProcuracao({ assembleia: a, condominio, escritorio }: Entrada): Documento {
  const nome = nomeParaRelatorio(condominio);
  // Texto corrido do domínio: linhas em branco separam parágrafos; quebras simples ficam dentro do parágrafo.
  const partes = montarProcuracao({ condominio, assembleia: a })
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const blocos: Bloco[] = partes.map((p, i) =>
    i === 0
      ? { tipo: "titulo", nivel: 1, alinhamento: "centro", texto: p }
      : i === partes.length - 1 && partes.length > 2
        ? { tipo: "paragrafo", alinhamento: "centro", texto: p }
        : { tipo: "paragrafo", alinhamento: "justificado", texto: p },
  );
  if (blocos.length > 2) blocos.splice(blocos.length - 1, 0, { tipo: "espaco", altura: 36 });
  return {
    titulo: `Procuração — ${nome}`,
    arquivo: nomeDeArquivo("procuracao", condominio.codigo || nome, a.data),
    timbre: a.timbrado ? timbreDoEscritorio(escritorio) : null,
    rodape: rodapeDe(a, nome),
    blocos,
  };
}
