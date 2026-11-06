import { formatData } from "@/lib/format";
import { nomeDeArquivo } from "@/lib/documento/baixar";
import type { Bloco, Documento } from "@/lib/documento/tipos";
import { nomeParaRelatorio } from "@/domain/condominio";
import { rotuloTipo } from "@/domain/edital";
import { montarBlocos } from "@/domain/modeloTexto";
import type { Assembleia, Condominio, ConfigEscritorio, Modelo } from "@/domain/types";
import { timbreDoEscritorio } from "./comum";

/**
 * Edital de convocação: os blocos visíveis do modelo (com variáveis já substituídas por
 * `montarBlocos`), desenhados conforme o tipo do bloco. `assembleia` vem como gravada (data aaaa-mm-dd).
 */
export function documentoEdital(o: {
  assembleia: Assembleia;
  condominio: Condominio;
  modelo: Modelo;
  escritorio: ConfigEscritorio | null;
}): Documento {
  const { assembleia: a, condominio } = o;
  const blocos: Bloco[] = [];
  let itens: string[] = [];
  const fecharItens = () => {
    if (itens.length) blocos.push({ tipo: "lista", itens });
    itens = [];
  };

  for (const b of montarBlocos(o.modelo, { condominio, assembleia: a })) {
    const texto = b.texto.trim();
    if (b.tipo === "item") {
      if (texto) itens.push(texto);
      continue;
    }
    fecharItens();
    switch (b.tipo) {
      case "titulo":
        if (texto) blocos.push({ tipo: "titulo", nivel: 1, alinhamento: "centro", texto });
        break;
      case "subtitulo":
        if (texto) blocos.push({ tipo: "titulo", nivel: 2, alinhamento: "centro", texto });
        break;
      case "texto":
        if (texto) blocos.push({ tipo: "paragrafo", alinhamento: "justificado", texto });
        break;
      case "esquerda":
        if (texto) blocos.push({ tipo: "paragrafo", alinhamento: "esquerda", texto });
        break;
      case "pauta": {
        if (texto) blocos.push({ tipo: "paragrafo", alinhamento: "justificado", texto });
        const pauta = a.pauta.map((p) => p.trim()).filter(Boolean);
        if (pauta.length) blocos.push({ tipo: "lista", numerada: true, itens: pauta });
        break;
      }
    }
  }
  fecharItens();

  const nome = nomeParaRelatorio(condominio);
  return {
    titulo: `Edital de convocação — ${nome}`,
    arquivo: nomeDeArquivo("edital", condominio.codigo || nome, a.data),
    timbre: a.timbrado ? timbreDoEscritorio(o.escritorio) : null,
    rodape: [nome, a.data && `Assembleia ${rotuloTipo(a.tipo).toLowerCase()} de ${formatData(a.data)}`].filter(Boolean).join(" · "),
    blocos: blocos.length ? blocos : [{ tipo: "paragrafo", texto: "O modelo escolhido não tem blocos visíveis para este edital.", suave: true }],
  };
}
