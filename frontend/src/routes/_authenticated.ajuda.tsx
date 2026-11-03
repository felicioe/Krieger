import { createFileRoute } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { SectionCard } from "@/components/app/SectionCard";
import { cabecalho } from "@/lib/head";
import { irPara } from "@/lib/utils";

type Busca = { secao?: string };

export const Route = createFileRoute("/_authenticated/ajuda")({
  head: () => cabecalho("Central de Ajuda", "Guias e respostas rápidas para usar o Sistema Krieger."),
  validateSearch: (s: Record<string, unknown>): Busca => {
    const secao = s["secao"];
    return typeof secao === "string" && secao ? { secao } : {};
  },
  component: Ajuda,
});

type ItemIndice = { id: string; titulo: string };

const INDICE: { titulo: string; itens: ItemIndice[] }[] = [
  { titulo: "Primeiros passos", itens: [{ id: "primeiros-passos", titulo: "Visão geral" }, { id: "condominios", titulo: "Condomínios" }] },
  {
    titulo: "Financeiro",
    itens: [
      { id: "prestacao-contas", titulo: "Prestação de contas" },
      { id: "previsao-orcamentaria", titulo: "Previsão orçamentária" },
      { id: "importador", titulo: "Importador" },
    ],
  },
  {
    titulo: "Relatórios",
    itens: [
      { id: "previsto-realizado", titulo: "Previsto × Realizado" },
      { id: "relatorio-mensal", titulo: "Relatório mensal" },
    ],
  },
  {
    titulo: "Assembleias e documentos",
    itens: [
      { id: "editais-atas", titulo: "Editais e Atas" },
      { id: "drive-documentos", titulo: "Drive de Documentos" },
    ],
  },
  { titulo: "Administração", itens: [{ id: "administracao", titulo: "Escritório, usuários e backup" }] },
];

function Ajuda() {
  const busca = Route.useSearch();

  useEffect(() => {
    if (busca.secao) irPara(busca.secao);
  }, [busca.secao]);

  return (
    <>
      <PageHeader titulo="Central de Ajuda" descricao="Guias rápidos de cada tela do sistema, organizados como o menu lateral." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <nav aria-label="Índice da ajuda" className="lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-md border bg-card p-3 text-sm shadow-sm">
            {INDICE.map((grupo) => (
              <div key={grupo.titulo} className="mb-3 last:mb-0">
                <p className="px-2 pb-1 text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">{grupo.titulo}</p>
                <ul>
                  {grupo.itens.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => irPara(item.id)}
                        className="w-full rounded px-2 py-1.5 text-left text-sm text-foreground/85 hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        {item.titulo}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </nav>

        <div className="min-w-0 space-y-6">
          <SectionCard id="primeiros-passos" titulo="Visão geral">
            <Texto>
              <p>
                O Krieger organiza o trabalho por <strong>condomínio</strong> e, dentro dele, por <strong>exercício</strong> (a prestação de
                contas de um ano). A maior parte do que você faz — demonstrativo, previsão, relatório final — está dentro de um exercício
                específico, acessado pela tela <strong>Prestação de contas</strong>.
              </p>
              <p>O menu lateral segue a ordem do trabalho: primeiro Financeiro (lançar e fechar as contas), depois Relatórios (conferir) e por fim Assembleias/Administração.</p>
            </Texto>
          </SectionCard>

          <SectionCard id="condominios" titulo="Condomínios" descricao="Cadastro base: dados, unidades e configurações usadas em todo o resto do sistema.">
            <Texto>
              <p>
                O cadastro do condomínio guarda os dados que outras telas reaproveitam: quantidade de <strong>unidades</strong> (usada para
                dividir o rateio na previsão orçamentária), fração ideal de cada unidade, dados para editais/atas e a regra de dedução usada
                no cálculo da previsão.
              </p>
              <Pergunta titulo="O sistema não calcula o valor por unidade na previsão. Por quê?">
                Confira se o campo <strong>Unidades</strong> está preenchido no cadastro do condomínio — sem ele, o sistema avisa e não tem
                como dividir o total pelo número de unidades.
              </Pergunta>
            </Texto>
          </SectionCard>

          <SectionCard
            id="prestacao-contas"
            titulo="Prestação de contas"
            descricao="O exercício de um condomínio: demonstrativo, previsão e relatório final partem daqui."
          >
            <Texto>
              <p>
                Cada linha da lista é um <strong>exercício</strong> (condomínio + ano). Dentro de um exercício, o <strong>demonstrativo</strong>{" "}
                é o extrato financeiro do ano — receitas, despesas por grupo, saldo anterior e atual. Ele pode ser digitado à mão ou importado
                do PDF do Systemar (ver <em>Importador</em>, abaixo).
              </p>
              <p>
                Com o demonstrativo lançado, a prestação alimenta automaticamente a <strong>previsão orçamentária</strong> (próxima seção) e o{" "}
                <strong>relatório final</strong>, que reúne todas as seções escolhidas num documento só, pronto para PDF/Word.
              </p>
            </Texto>
          </SectionCard>

          <SectionCard
            id="previsao-orcamentaria"
            titulo="Previsão orçamentária"
            descricao="Projeta o orçamento do exercício a partir do realizado do ano anterior."
          >
            <Texto>
              <p>
                Esta tela tem duas abas. <strong>Sugerida pelo Systemar</strong> usa os totais que já vêm prontos no PDF importado (quando o
                relatório traz essa folha). <strong>Calculada pelo demonstrativo</strong> monta a previsão a partir do demonstrativo do
                exercício — é a mais usada e a mais sujeita a dúvida, por isso vale detalhar.
              </p>
              <p>
                <strong>De onde vem a base.</strong> A previsão de um exercício sempre parte do <strong>realizado do exercício anterior</strong>{" "}
                (já fechado) — nunca do demonstrativo do próprio exercício em edição, que ainda está sendo preenchido ao longo do ano. No topo
                da tela, um bloco de referência mostra separadamente:
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li><strong>Realizado anterior</strong> — o total de despesas do exercício anterior, a base da conta.</li>
                <li>
                  <strong>Última previsão aprovada</strong> — o que o exercício anterior já projetou e aprovou para este ano, com os parâmetros
                  que ele mesmo confirmou. É só referência: não é somada nem reaplicada automaticamente.
                </li>
              </ul>
              <p>
                <strong>Sugestão de variação.</strong> Quando o exercício atual já tem despesas lançadas, aparece um aviso comparando a
                última previsão aprovada com o que foi de fato realizado — um <strong>índice sugerido</strong> para o reajuste. Essa sugestão
                nunca é aplicada sozinha: é preciso clicar em "Usar sugestão" (que preenche o campo Variação, ainda editável) ou digitar
                outro percentual à mão. Isso evita que um ano fora da curva vire tendência permanente sem revisão.
              </p>
              <p>
                <strong>Ajustes</strong> são acréscimos/reduções manuais (obras programadas, contrato novo etc.), somados ao anual ajustado e
                sempre específicos da prestação atual — não se misturam com os ajustes do exercício anterior.
              </p>
              <Pergunta titulo="Por que a previsão usa o ano anterior como base, e não o próprio exercício?">
                Porque o exercício em edição ainda está em andamento — seu demonstrativo vai sendo preenchido mês a mês. Usar um
                demonstrativo que muda ao longo do ano como base da previsão faria o valor "andar" sem ninguém mexer em nada. O realizado do
                ano anterior já está fechado e não muda mais, por isso serve de base estável.
              </Pergunta>
              <Pergunta titulo='O que significa "Índice de reajuste" no resumo?'>
                É o quanto o valor por unidade calculado nesta previsão difere do rateio atual (o valor que o condomínio já cobra hoje). Serve
                de referência para decidir o novo valor da taxa condominial — não é aplicado automaticamente em lugar nenhum.
              </Pergunta>
            </Texto>
          </SectionCard>

          <SectionCard id="importador" titulo="Importador" descricao="Lê o PDF do relatório do Systemar e preenche o demonstrativo automaticamente.">
            <Texto>
              <p>
                Importa o relatório mensal ou anual do Systemar (PDF) e reconhece automaticamente demonstrativo, frações de unidades, previsão
                sugerida e a folha de apólice de seguro, quando presentes. Depois de importar, revise os valores antes de salvar — o PDF pode
                trazer linhas que o sistema interpreta de forma diferente do esperado (por isso a tela sempre mostra um comparativo entre o
                que o PDF trouxe e o que foi efetivamente reconhecido).
              </p>
              <p>
                Quando já existe um lançamento para o mesmo mês/exercício, o sistema avisa o conflito e deixa você decidir, item por item, se
                mantém o que já estava ou atualiza com o que veio do PDF novo.
              </p>
            </Texto>
          </SectionCard>

          <SectionCard
            id="previsto-realizado"
            titulo="Previsto × Realizado"
            descricao="Compara a previsão orçamentária aprovada com o que foi de fato gasto, mês a mês."
          >
            <Texto>
              <p>
                Relatório só de leitura: mostra, por rubrica e por grupo, o previsto (anual e acumulado até o mês escolhido) ao lado do
                realizado dos relatórios mensais lançados. Não altera nem compõe a previsão — é só para acompanhar o quanto o condomínio está
                dentro, acima ou abaixo do orçamento aprovado. A versão "Orçado × Realizado mensal" mostra a mesma comparação mês a mês, numa
                tabela com totais por linha e coluna.
              </p>
            </Texto>
          </SectionCard>

          <SectionCard id="relatorio-mensal" titulo="Relatório mensal" descricao="O boletim mensal enviado ao condomínio.">
            <Texto>
              <p>
                Reúne o demonstrativo do mês, inadimplência e notas explicativas num documento pronto para PDF/Word — o relatório de rotina,
                separado do relatório final (que é o fechamento do exercício inteiro).
              </p>
            </Texto>
          </SectionCard>

          <SectionCard id="editais-atas" titulo="Editais e Atas" descricao="Convocação de assembleia e o registro do que foi deliberado.">
            <Texto>
              <p>
                O edital convoca a assembleia (data, pauta, modalidade). A ata, criada a partir de um edital emitido, puxa automaticamente os
                dados da convocação (data, local, pauta) — só o conteúdo da reunião em si (presença, discussão, deliberação por item) é
                digitado. Os modelos de edital guardam blocos de texto reutilizáveis entre convocações.
              </p>
            </Texto>
          </SectionCard>

          <SectionCard id="drive-documentos" titulo="Drive de Documentos" descricao="Arquivos do condomínio e busca inteligente por conteúdo.">
            <Texto>
              <p>
                Guarda documentos do condomínio (atas antigas, contratos, regimentos) e permite buscar por conteúdo, não só pelo nome do
                arquivo — útil para achar uma cláusula ou decisão antiga sem lembrar em qual documento ela está.
              </p>
            </Texto>
          </SectionCard>

          <SectionCard id="administracao" titulo="Escritório, usuários e backup">
            <Texto>
              <p>
                <strong>Escritório</strong> guarda os dados usados em relatórios e editais (nome, cidade, rodapé, assinatura, logo).{" "}
                <strong>Usuários</strong> (visível só para administradores) controla quem acessa o sistema e o que cada um pode fazer — telas
                e ações são liberadas por permissão individual. <strong>Backup</strong> exporta ou restaura todos os dados; só administrador
                restaura.
              </p>
            </Texto>
          </SectionCard>
        </div>
      </div>
    </>
  );
}

function Texto({ children }: { children: ReactNode }) {
  return <div className="space-y-3 text-sm text-foreground/90">{children}</div>;
}

/** Pergunta frequente, dentro do texto corrido de uma seção. */
function Pergunta({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="rounded-md border border-dashed bg-muted/30 px-4 py-3">
      <p className="text-sm font-medium text-primary">{titulo}</p>
      <p className="mt-1 text-sm text-muted-foreground">{children}</p>
    </div>
  );
}
