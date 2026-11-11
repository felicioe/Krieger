import { formatData, formatNumeroBR } from "@/lib/format";
import { nomeDeArquivo } from "@/lib/documento/baixar";
import type { Bloco, Documento } from "@/lib/documento/tipos";
import { nomeParaRelatorio } from "@/domain/condominio";
import { percentualQuorum } from "@/domain/ata";
import { dataPorExtenso } from "@/domain/notificacao";
import { renderizarTextoModeloAta } from "@/domain/modeloAta";
import { rotuloModalidade, rotuloTipo } from "@/domain/edital";
import type { Ata, Condominio, ConfigEscritorio } from "@/domain/types";
import { localEData, paragrafos, timbreDoEscritorio } from "./comum";

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** Converte o texto do modelo em blocos visuais: títulos (#, ##, ###), listas (- item) e parágrafos. */
function blocosDoModelo(texto: string): Bloco[] {
  const linhas = texto.split(/\r?\n/);
  const blocos: Bloco[] = [];
  let buffer: string[] = [];

  const flush = () => {
    if (!buffer.length) return;
    const p = buffer.join(" ").trim();
    if (p) blocos.push({ tipo: "paragrafo", texto: p, alinhamento: "justificado" });
    buffer = [];
  };

  for (const linha of linhas) {
    const t = linha.trimEnd();
    const titulo3 = t.match(/^###\s+(.+)$/);
    const titulo2 = !titulo3 && t.match(/^##\s+(.+)$/);
    const titulo1 = !titulo3 && !titulo2 && t.match(/^#\s+(.+)$/);
    const lista = !titulo3 && !titulo2 && !titulo1 && t.match(/^[-•]\s+(.+)$/);

    if (titulo1 || titulo2 || titulo3 || lista || t.trim() === "") {
      flush();
    }

    if (titulo1 && titulo1[1]) {
      blocos.push({ tipo: "titulo", nivel: 1, texto: titulo1[1].trim() });
    } else if (titulo2 && titulo2[1]) {
      blocos.push({ tipo: "titulo", nivel: 2, texto: titulo2[1].trim() });
    } else if (titulo3 && titulo3[1]) {
      blocos.push({ tipo: "titulo", nivel: 3, texto: titulo3[1].trim() });
    } else if (lista && lista[1]) {
      blocos.push({ tipo: "lista", itens: [lista[1].trim()] });
    } else if (t.trim() === "") {
      // quebra de parágrafo já foi tratada pelo flush acima
    } else {
      buffer.push(t.trim());
    }
  }
  flush();

  // Junta listas consecutivas em um único bloco de lista.
  const consolidado: Bloco[] = [];
  for (const b of blocos) {
    const anterior = consolidado[consolidado.length - 1];
    if (b.tipo === "lista" && anterior?.tipo === "lista") {
      anterior.itens = [...anterior.itens, ...b.itens];
    } else {
      consolidado.push(b);
    }
  }
  return consolidado;
}

/** Ata da assembleia, em papel timbrado do escritório; rascunho sai com marca d'água. */
export function documentoAta(o: {
  ata: Ata;
  condominio: Condominio | null;
  cidade: string;
  escritorio: ConfigEscritorio | null;
  modelo?: { texto: string; logoEscritorio?: boolean; bordaPagina?: boolean } | null;
}): Documento {
  const { ata: a, condominio, cidade, modelo } = o;
  const nome = condominio ? nomeParaRelatorio(condominio) : "";
  const tipo = rotuloTipo(a.tipo);
  const data = a.data ? formatData(a.data) : "";
  const pct = percentualQuorum(a.quorum);
  const presentes = a.presentes.filter((p) => p.unidade.trim() || p.nome.trim());

  // Quando há modelo de ata escolhido, o corpo do documento vem do texto do modelo com variáveis substituídas;
  // o layout padrão (blocos fixos) só é usado como fallback.
  if (modelo?.texto?.trim()) {
    const unidadesPresentes = presentes.map((p) => p.unidade.trim() || p.nome.trim()).filter(Boolean);
    const itensPauta = a.itens.map((item) => item.titulo.trim()).filter(Boolean);
    const dataExtenso = a.data ? dataPorExtenso(formatData(a.data)) : "";
    const quorumTexto = a.quorum.totalUnidades
      ? `${plural(a.quorum.unidadesPresentes, "unidade presente", "unidades presentes")} de ${plural(a.quorum.totalUnidades, "unidade", "unidades")}${pct === null ? "" : ` (${formatNumeroBR(pct, 2)}%)`}`
      : plural(a.quorum.unidadesPresentes, "unidade presente", "unidades presentes");
    /** Itens da pauta com discussão/deliberação, numerados e separados por linha em branco (viram parágrafos). */
    const itensTexto = a.itens
      .map((item, i) => {
        const linhas = [`${i + 1} — ${item.titulo.trim() || "Item da pauta"}.`];
        if (item.discussao.trim()) linhas.push(`Discussão: ${item.discussao.trim()}`);
        if (item.deliberacao.trim()) linhas.push(`Deliberação: ${item.deliberacao.trim()}`);
        return linhas.join("\n");
      })
      .filter(Boolean)
      .join("\n\n");
    const ctx: Record<string, unknown> = {
      ata: {
        tipo,
        data,
        dataExtenso,
        hora: a.hora || "",
        local: a.local || "",
        modalidade: rotuloModalidade(a.modalidade),
        mesa: a.mesa,
        quorum: a.quorum,
        quorumTexto,
        percentualQuorum: pct === null ? "" : formatNumeroBR(pct, 2),
        unidades: unidadesPresentes,
        itens: itensPauta,
        itensTexto,
        encerramento: a.encerramento || "",
        observacoes: a.observacoes || "",
      },
      condominio: condominio ?? {},
      escritorio: o.escritorio ?? {},
      cidade,
    };
    const textoRenderizado = renderizarTextoModeloAta(modelo.texto, ctx);
    const blocosModelo = blocosDoModelo(textoRenderizado);
    return {
      titulo: `Ata da assembleia ${tipo.toLowerCase()} — ${nome}`,
      arquivo: nomeDeArquivo("ata", condominio?.codigo || nome, a.data),
      timbre: modelo.logoEscritorio === false ? null : timbreDoEscritorio(o.escritorio),
      ...(modelo.bordaPagina ? { bordaPagina: true } : {}),
      // Decisão (docs/DECISOES.md): ata de cartório não leva identificação do escritório no
      // rodapé. Só a ata desliga o texto — o edital com "Papel timbrado" desmarcado continua
      // mostrando o rodapé de identificação do condomínio, como sempre mostrou.
      ...(modelo.logoEscritorio === false ? { rodapeEscritorio: false } : {}),
      fonte: "documento" as const,
      tamanhoCorpo: 12,
      ...(a.status !== "finalizada" ? { marcaDagua: "RASCUNHO" } : {}),
      rodape: [nome, data && `Assembleia de ${data}`].filter(Boolean).join(" · "),
      blocos: blocosModelo.length ? blocosModelo : [{ tipo: "paragrafo", texto: "Modelo de ata sem conteúdo.", suave: true }],
    };
  }

  const blocos: Bloco[] = [
    { tipo: "titulo", nivel: 1, alinhamento: "centro", texto: `ATA DA ASSEMBLEIA GERAL ${tipo.toUpperCase()}` },
    ...(nome ? [{ tipo: "paragrafo" as const, texto: nome, alinhamento: "centro" as const, negrito: true, tamanho: "grande" as const }] : []),
    ...(condominio?.cnpj ? [{ tipo: "paragrafo" as const, texto: `CNPJ ${condominio.cnpj}`, alinhamento: "centro" as const, suave: true }] : []),

    { tipo: "titulo", nivel: 2, texto: "Dados da reunião" },
    {
      tipo: "pares",
      itens: [
        { rotulo: "Data", valor: data || "—" },
        { rotulo: "Horário", valor: a.hora || "—" },
        { rotulo: "Modalidade", valor: rotuloModalidade(a.modalidade) },
        ...(a.local.trim() ? [{ rotulo: "Local", valor: a.local.trim() }] : []),
        ...(cidade ? [{ rotulo: "Cidade", valor: cidade }] : []),
        { rotulo: "Presidente da mesa", valor: a.mesa.presidente.trim() || "—" },
        { rotulo: "Secretário(a)", valor: a.mesa.secretario.trim() || "—" },
        {
          rotulo: "Quórum",
          valor: a.quorum.totalUnidades
            ? `${a.quorum.unidadesPresentes} de ${plural(a.quorum.totalUnidades, "unidade", "unidades")}${pct === null ? "" : ` (${formatNumeroBR(pct, 2)}%)`}`
            : plural(a.quorum.unidadesPresentes, "unidade presente", "unidades presentes"),
        },
      ],
    },

    { tipo: "titulo", nivel: 2, texto: "Presentes" },
    presentes.length
      ? {
          tipo: "tabela",
          colunas: [
            { titulo: "Unidade", largura: 70 },
            { titulo: "Nome", largura: "*" },
            { titulo: "Procurador", largura: 70, alinhamento: "centro" },
          ],
          linhas: presentes.map((p) => ({ celulas: [p.unidade || "—", p.nome || "—", p.procurador ? "Sim" : "—"] })),
        }
      : { tipo: "paragrafo", texto: "Lista de presentes não informada.", suave: true },

    { tipo: "titulo", nivel: 2, texto: "Ordem do dia" },
    ...(a.itens.length
      ? a.itens.flatMap((item, i): Bloco[] => {
          const v = item.votos;
          const votou = v.favor + v.contra + v.abstencao > 0;
          return [
            { tipo: "titulo", nivel: 3, texto: `${i + 1}. ${item.titulo.trim() || "Item sem título"}` },
            ...(item.discussao.trim()
              ? [{ tipo: "paragrafo" as const, alinhamento: "justificado" as const, texto: [{ texto: "Discussão: ", negrito: true }, { texto: item.discussao.trim() }] }]
              : []),
            ...(item.deliberacao.trim()
              ? [{ tipo: "paragrafo" as const, alinhamento: "justificado" as const, texto: [{ texto: "Deliberação: ", negrito: true }, { texto: item.deliberacao.trim() }] }]
              : []),
            ...(votou
              ? [
                  {
                    tipo: "paragrafo" as const,
                    suave: true,
                    texto: `Votação: ${plural(v.favor, "voto a favor", "votos a favor")} · ${plural(v.contra, "contra", "contra")} · ${plural(v.abstencao, "abstenção", "abstenções")}.`,
                  },
                ]
              : []),
          ];
        })
      : [{ tipo: "paragrafo" as const, texto: "Nenhum item registrado.", suave: true }]),

    ...(a.encerramento.trim() ? [{ tipo: "titulo" as const, nivel: 2 as const, texto: "Encerramento" }, ...paragrafos(a.encerramento)] : []),
    ...(a.observacoes.trim() ? [{ tipo: "titulo" as const, nivel: 2 as const, texto: "Observações" }, ...paragrafos(a.observacoes)] : []),

    ...(localEData(cidade, data) ? [{ tipo: "espaco" as const, altura: 12 }] : []),
    {
      tipo: "assinaturas" as const,
      itens: [
        [a.mesa.presidente.trim() || " ", "Presidente da mesa"],
        [a.mesa.secretario.trim() || " ", "Secretário(a)"],
      ],
      ...(localEData(cidade, data) ? { localData: localEData(cidade, data), localDataAlinhamento: "direita" as const } : {}),
    },
  ];

  return {
    titulo: `Ata da assembleia ${tipo.toLowerCase()} — ${nome}`,
    arquivo: nomeDeArquivo("ata", condominio?.codigo || nome, a.data),
    timbre: timbreDoEscritorio(o.escritorio),
    fonte: "documento" as const,
    tamanhoCorpo: 12,
    ...(a.status !== "finalizada" ? { marcaDagua: "RASCUNHO" } : {}),
    rodape: [nome, data && `Assembleia de ${data}`].filter(Boolean).join(" · "),
    blocos,
  };
}
