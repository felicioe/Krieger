import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AlertTriangle, Loader2, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageHeader } from "@/components/app/PageHeader";
import { SectionCard } from "@/components/app/SectionCard";
import { ConfirmDialog } from "@/components/app/ConfirmDialog";
import { api, mensagemErro, type AlvoLimpeza, type ContagensLimpeza } from "@/lib/api";
import { useUsuario } from "@/lib/auth";
import { chaves, limpezaContagensQuery } from "@/lib/queries";
import { cabecalho } from "@/lib/head";
import { contagem } from "@/components/app/textos";

export const Route = createFileRoute("/_authenticated/limpeza-dados")({
  head: () =>
    cabecalho(
      "Limpeza de Dados",
      "Área restrita a administradores para exclusão em massa de cadastros do sistema.",
    ),
  component: PaginaLimpezaDados,
});

type ItemLimpeza = {
  alvo: Exclude<AlvoLimpeza, "tudo">;
  titulo: string;
  tabela: string;
  descricao: string;
  rotuloBotao: string;
};

const ITENS_INDIVIDUAIS: ItemLimpeza[] = [
  {
    alvo: "condominios",
    titulo: "Condomínios",
    tabela: "kr_condominios",
    descricao: "Apaga todos os condomínios cadastrados (dados gerais, administração, seguros, prazos e regras).",
    rotuloBotao: "Apagar todos os condomínios",
  },
  {
    alvo: "exercicios",
    titulo: "Prestações de contas (Exercícios)",
    tabela: "kr_exercicios",
    descricao: "Apaga todas as prestações de contas anuais, demonstrativos, considerações finais e previsões orçamentárias.",
    rotuloBotao: "Apagar prestações de contas",
  },
  {
    alvo: "mensais",
    titulo: "Relatórios mensais",
    tabela: "kr_mensais",
    descricao: "Apaga todos os relatórios mensais importados ou digitados e contas a receber de cada competência.",
    rotuloBotao: "Apagar relatórios mensais",
  },
  {
    alvo: "assembleias",
    titulo: "Editais e Assembleias",
    tabela: "kr_assembleias",
    descricao: "Apaga todos os editais de convocação de assembleias ordinárias e extraordinárias.",
    rotuloBotao: "Apagar editais",
  },
  {
    alvo: "atas",
    titulo: "Atas de assembleia",
    tabela: "kr_atas",
    descricao: "Apaga todas as atas de assembleia (rascunhos e atas finalizadas, lista de presença e deliberações).",
    rotuloBotao: "Apagar atas",
  },
  {
    alvo: "modelos",
    titulo: "Modelos de edital",
    tabela: "kr_modelos",
    descricao: "Apaga os modelos de texto e pautas configurados para geração de editais.",
    rotuloBotao: "Apagar modelos de edital",
  },
  {
    alvo: "importacoes",
    titulo: "Importações de PDF pendentes",
    tabela: "kr_importacoes",
    descricao: "Apaga os relatórios lidos de PDF que estão aguardando conferência de cadastro ou no histórico de staging.",
    rotuloBotao: "Apagar fila de importações",
  },
  {
    alvo: "anexos_importacao",
    titulo: "Anexos de importação (Comparativos)",
    tabela: "kr_anexos_importacao",
    descricao: "Apaga os arquivos PDF de Comparativo Financeiro anexados às prestações de contas.",
    rotuloBotao: "Apagar anexos de PDF",
  },
  {
    alvo: "decisoes_previsao",
    titulo: "Histórico de divergências da previsão",
    tabela: "kr_decisoes_previsao",
    descricao: "Apaga o registro histórico de decisões tomadas sobre divergências na previsão orçamentária sugerida.",
    rotuloBotao: "Apagar histórico de divergências",
  },
  {
    alvo: "documentos",
    titulo: "Consulta Inteligente de Documentos (Índices e Cache)",
    tabela: "kr_documentos / kr_documento_trechos / kr_consulta_*",
    descricao: "Apaga os textos indexados de convenções, regimentos e atas, além do cache e histórico de perguntas à IA.",
    rotuloBotao: "Apagar documentos indexados",
  },
  {
    alvo: "backups",
    titulo: "Backups salvos no servidor",
    tabela: "kr_backups",
    descricao: "Apaga o histórico de cópias de backup armazenadas no banco de dados do servidor.",
    rotuloBotao: "Apagar backups do servidor",
  },
];

function totalCadastrosOperacionais(c: ContagensLimpeza | undefined): number {
  if (!c) return 0;
  return (
    c.condominios +
    c.exercicios +
    c.mensais +
    c.assembleias +
    c.atas +
    c.modelos +
    c.importacoes +
    c.anexos_importacao +
    c.decisoes_previsao +
    c.documentos
  );
}

function PaginaLimpezaDados() {
  const usuario = useUsuario();
  const queryClient = useQueryClient();
  const admin = usuario?.perfil === "admin";
  const contagens = useQuery({ ...limpezaContagensQuery(), enabled: admin });
  const [confirmarAlvo, setConfirmarAlvo] = useState<{
    alvo: AlvoLimpeza;
    titulo: string;
    descricao: string;
    rotuloConfirmar: string;
  } | null>(null);

  const limpar = useMutation({
    mutationFn: (alvo: AlvoLimpeza) => api.manutencao.limpar(alvo),
    onSuccess: async (_res, alvo) => {
      await queryClient.invalidateQueries();
      const item = ITENS_INDIVIDUAIS.find((i) => i.alvo === alvo);
      toast.success(
        alvo === "tudo"
          ? "Todos os cadastros operacionais foram apagados com sucesso."
          : `${item?.titulo ?? "Cadastros"} apagados com sucesso.`,
      );
      setConfirmarAlvo(null);
    },
    onError: (e) => {
      toast.error(mensagemErro(e));
    },
  });

  if (!admin) {
    return (
      <>
        <PageHeader
          titulo="Limpeza de Dados"
          descricao="Área restrita a administradores do sistema."
        />
        <Alert variant="destructive">
          <ShieldAlert />
          <AlertTitle>Acesso restrito a administradores</AlertTitle>
          <AlertDescription>
            Somente usuários com perfil Administrador têm permissão para visualizar ou executar a limpeza de cadastros.
          </AlertDescription>
        </Alert>
      </>
    );
  }

  const totalGeral = totalCadastrosOperacionais(contagens.data);

  return (
    <>
      <PageHeader
        titulo="Limpeza de Dados (Zona de Perigo)"
        descricao="Exclusão definitiva de cadastros em massa. Exclusivo para administradores — gere um backup antes de apagar."
      />

      <div className="space-y-6">
        <Alert variant="destructive" className="border-destructive/60 bg-destructive/5">
          <AlertTriangle />
          <AlertTitle>Atenção: operação irreversível</AlertTitle>
          <AlertDescription>
            Os registros apagados nesta tela são removidos diretamente do banco de dados e não podem ser desfeitos sem um
            backup prévio. Seus usuários de acesso (<code>kr_usuarios</code>) e os dados de identificação do escritório (
            <code>kr_config</code>) nunca são apagados por estas opções.
          </AlertDescription>
        </Alert>

        <SectionCard
          className="border-2 border-destructive/70 bg-destructive/5"
          titulo="1. Apagar TODOS os cadastros do sistema"
          descricao="Remove de uma só vez todos os condomínios, prestações de contas, relatórios mensais, editais, atas, modelos, importações pendentes, anexos, histórico de divergências e índices de documentos (preservando usuários, configurações do escritório e backups salvos)."
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="text-sm">
              Total acumulado nas tabelas operacionais:{" "}
              <Badge variant="destructive" className="ml-1 num">
                {contagens.isPending ? "…" : contagem(totalGeral, "registro", "registros")}
              </Badge>
            </div>
            <Button
              variant="destructive"
              disabled={contagens.isPending || limpar.isPending || totalGeral === 0}
              onClick={() =>
                setConfirmarAlvo({
                  alvo: "tudo",
                  titulo: "Apagar TODOS os cadastros do sistema?",
                  descricao:
                    "Todos os condomínios, prestações de contas, relatórios mensais, editais, atas, modelos, importações, anexos e documentos indexados serão apagados definitivamente do banco de dados. Apenas usuários e configurações do escritório serão mantidos. Esta ação não pode ser desfeita.",
                  rotuloConfirmar: "Sim, apagar todos os cadastros",
                })
              }
            >
              {limpar.isPending && confirmarAlvo?.alvo === "tudo" ? <Loader2 className="animate-spin" /> : <Trash2 />}
              Apagar todos os cadastros ({contagens.isPending ? "…" : totalGeral})
            </Button>
          </div>
        </SectionCard>

        <SectionCard
          titulo="2. Apagar cadastros individualmente por categoria"
          descricao="Escolha apenas a tabela específica que deseja esvaziar, mantendo os demais cadastros intactos."
        >
          {contagens.isPending ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Consultando quantidade de registros no banco…
            </div>
          ) : contagens.isError ? (
            <Alert variant="destructive">
              <AlertDescription>
                Não foi possível carregar as contagens: {mensagemErro(contagens.error)}
              </AlertDescription>
            </Alert>
          ) : (
            <div className="divide-y rounded-md border">
              {ITENS_INDIVIDUAIS.map((item) => {
                const qtd = contagens.data?.[item.alvo] ?? 0;
                return (
                  <div
                    key={item.alvo}
                    className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-foreground">{item.titulo}</span>
                        <Badge variant={qtd > 0 ? "destructive" : "secondary"} className="num">
                          {contagem(qtd, "registro", "registros")}
                        </Badge>
                        <code className="text-xs text-muted-foreground">({item.tabela})</code>
                      </div>
                      <p className="text-xs text-muted-foreground">{item.descricao}</p>
                    </div>
                    <div className="shrink-0">
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={limpar.isPending || qtd === 0}
                        onClick={() =>
                          setConfirmarAlvo({
                            alvo: item.alvo,
                            titulo: `Apagar todos os registros de ${item.titulo}?`,
                            descricao: `Serão removidos ${contagem(qtd, "registro", "registros")} da tabela ${item.tabela}. Esta ação é definitiva e não pode ser desfeita.`,
                            rotuloConfirmar: item.rotuloBotao,
                          })
                        }
                      >
                        <Trash2 />
                        {item.rotuloBotao}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>

      <ConfirmDialog
        aberto={!!confirmarAlvo}
        aoMudar={(v) => !v && setConfirmarAlvo(null)}
        titulo={confirmarAlvo?.titulo ?? "Confirmar exclusão?"}
        descricao={confirmarAlvo?.descricao}
        rotuloConfirmar={confirmarAlvo?.rotuloConfirmar ?? "Apagar"}
        destrutivo
        aoConfirmar={async () => {
          if (!confirmarAlvo) return;
          await limpar.mutateAsync(confirmarAlvo.alvo);
        }}
      />
    </>
  );
}
