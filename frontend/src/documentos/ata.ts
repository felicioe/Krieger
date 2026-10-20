import { formatData, formatNumeroBR } from "@/lib/format";
import { nomeDeArquivo } from "@/lib/documento/baixar";
import type { Bloco, Documento } from "@/lib/documento/tipos";
import { nomeParaRelatorio } from "@/domain/condominio";
import { percentualQuorum } from "@/domain/ata";
import { rotuloModalidade, rotuloTipo } from "@/domain/edital";
import type { Ata, Condominio, ConfigEscritorio } from "@/domain/types";
import { localEData, paragrafos, timbreDoEscritorio } from "./comum";

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** Ata da assembleia, em papel timbrado do escritório; rascunho sai com marca d'água. */
export function documentoAta(o: { ata: Ata; condominio: Condominio | null; cidade: string; escritorio: ConfigEscritorio | null }): Documento {
  const { ata: a, condominio, cidade } = o;
  const nome = condominio ? nomeParaRelatorio(condominio) : "";
  const tipo = rotuloTipo(a.tipo);
  const data = a.data ? formatData(a.data) : "";
  const pct = percentualQuorum(a.quorum);
  const presentes = a.presentes.filter((p) => p.unidade.trim() || p.nome.trim());

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

    ...(localEData(cidade, data) ? [{ tipo: "espaco" as const, altura: 12 }, { tipo: "paragrafo" as const, texto: localEData(cidade, data), alinhamento: "direita" as const }] : []),
    {
      tipo: "assinaturas",
      itens: [
        [a.mesa.presidente.trim() || " ", "Presidente da mesa"],
        [a.mesa.secretario.trim() || " ", "Secretário(a)"],
      ],
    },
  ];

  return {
    titulo: `Ata da assembleia ${tipo.toLowerCase()} — ${nome}`,
    arquivo: nomeDeArquivo("ata", condominio?.codigo || nome, a.data),
    timbre: timbreDoEscritorio(o.escritorio),
    ...(a.status !== "finalizada" ? { marcaDagua: "RASCUNHO" } : {}),
    rodape: [nome, data && `Assembleia de ${data}`].filter(Boolean).join(" · "),
    blocos,
  };
}
