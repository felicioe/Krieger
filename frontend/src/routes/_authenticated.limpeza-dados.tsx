import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AlertTriangle, DatabaseBackup, Loader2, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/app/PageHeader";
import { SectionCard } from "@/components/app/SectionCard";
import { ConfirmDialog } from "@/components/app/ConfirmDialog";
import { Field } from "@/components/app/Field";
import { api, mensagemErro, type AlvoLimpeza, type ContagensLimpeza } from "@/lib/api";
import { useUsuario } from "@/lib/auth";
import { chaves, itemQuery, limpezaContagensQuery } from "@/lib/queries";
import { cabecalho } from "@/lib/head";
import { contagem } from "@/components/app/textos";
import { formatDataHora } from "@/lib/format";
import type { ConfigBackup } from "@/domain/types";

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
  descricao: string;
  rotuloBotao: string;
};

const ITENS_INDIVIDUAIS: ItemLimpeza[] = [
  {
    alvo: "condominios",
    titulo: "Condomínios",
    descricao:
      "Apaga todos os condomínios cadastrados (dados gerais, administração, seguros, prazos e regras).",
    rotuloBotao: "Apagar todos os condomínios",
  },
  {
    alvo: "exercicios",
    titulo: "Prestações de contas (Exercícios)",
    descricao:
      "Apaga todas as prestações de contas anuais, demonstrativos, considerações finais e previsões orçamentárias.",
    rotuloBotao: "Apagar prestações de contas",
  },
  {
    alvo: "mensais",
    titulo: "Relatórios mensais",
    descricao:
      "Apaga todos os relatórios mensais importados ou digitados e contas a receber de cada competência.",
    rotuloBotao: "Apagar relatórios mensais",
  },
  {
    alvo: "assembleias",
    titulo: "Editais e Assembleias",
    descricao: "Apaga todos os editais de convocação de assembleias ordinárias e extraordinárias.",
    rotuloBotao: "Apagar editais",
  },
  {
    alvo: "atas",
    titulo: "Atas de assembleia",
    descricao:
      "Apaga todas as atas de assembleia (rascunhos e atas finalizadas, lista de presença e deliberações).",
    rotuloBotao: "Apagar atas",
  },
  {
    alvo: "modelos_ata",
    titulo: "Modelos de ata",
    descricao: "Apaga os modelos de texto configurados para geração de atas.",
    rotuloBotao: "Apagar modelos de ata",
  },
  {
    alvo: "modelos",
    titulo: "Modelos de edital",
    descricao: "Apaga os modelos de texto e pautas configurados para geração de editais.",
    rotuloBotao: "Apagar modelos de edital",
  },
  {
    alvo: "importacoes",
    titulo: "Importações de PDF pendentes",
    descricao:
      "Apaga os relatórios lidos de PDF que estão aguardando conferência de cadastro ou no histórico de importações.",
    rotuloBotao: "Apagar fila de importações",
  },
  {
    alvo: "anexos_importacao",
    titulo: "Anexos de importação (Comparativos)",
    descricao: "Apaga os arquivos PDF de Comparativo Financeiro anexados às prestações de contas.",
    rotuloBotao: "Apagar anexos de PDF",
  },
  {
    alvo: "decisoes_previsao",
    titulo: "Histórico de divergências da previsão",
    descricao:
      "Apaga o registro histórico de decisões tomadas sobre divergências na previsão orçamentária sugerida.",
    rotuloBotao: "Apagar histórico de divergências",
  },
  {
    alvo: "decisoes_importacao",
    titulo: "Histórico de conflitos de importação",
    descricao:
      "Apaga o registro histórico de decisões tomadas sobre contas divergentes ao reimportar um relatório mensal ou prestação de contas já existente.",
    rotuloBotao: "Apagar histórico de conflitos",
  },
  {
    alvo: "documentos",
    titulo: "Consulta Inteligente e Drive de Documentos",
    descricao:
      "Apaga os documentos indexados (convenções, regimentos e atas), respostas reaproveitadas e histórico de perguntas.",
    rotuloBotao: "Apagar documentos indexados",
  },
  {
    alvo: "backups",
    titulo: "Backups salvos no servidor",
    descricao: "Apaga o histórico de cópias de backup armazenadas no servidor.",
    rotuloBotao: "Apagar backups do servidor",
  },
];

export function totalCadastrosOperacionais(c: ContagensLimpeza | undefined): number {
  if (!c) return 0;
  return (
    c.condominios +
    c.exercicios +
    c.mensais +
    c.assembleias +
    c.atas +
    (c.modelos_ata ?? 0) +
    c.modelos +
    c.importacoes +
    c.anexos_importacao +
    c.decisoes_previsao +
    c.decisoes_importacao +
    c.documentos
  );
}

const FRASE_CONFIRMACAO_TUDO = "APAGAR TUDO";

function PaginaLimpezaDados() {
  const usuario = useUsuario();
  const queryClient = useQueryClient();
  const admin = usuario?.perfil === "admin";
  const contagens = useQuery({ ...limpezaContagensQuery(), enabled: admin });
  const ultimoBackup = useQuery({
    ...itemQuery<ConfigBackup>("config", "backup"),
    enabled: admin,
  });
  const [confirmarAlvo, setConfirmarAlvo] = useState<{
    alvo: Exclude<AlvoLimpeza, "tudo">;
    titulo: string;
    descricao: string;
    rotuloConfirmar: string;
  } | null>(null);
  const [confirmarTudoAberto, setConfirmarTudoAberto] = useState(false);
  const [textoConfirmacaoTudo, setTextoConfirmacaoTudo] = useState("");

  const limpar = useMutation({
    mutationFn: (alvo: AlvoLimpeza) => api.manutencao.limpar(alvo),
    onSuccess: async (_res, alvo) => {
      if (alvo === "tudo") {
        await queryClient.invalidateQueries();
      } else {
        await queryClient.invalidateQueries({ queryKey: chaves.limpezaContagens });
        if (alvo === "backups") {
          await queryClient.invalidateQueries({ queryKey: chaves.backups });
        } else if (alvo === "documentos") {
          await queryClient.invalidateQueries({ queryKey: ["documentos"] });
        } else if (
          alvo === "condominios" ||
          alvo === "exercicios" ||
          alvo === "mensais" ||
          alvo === "assembleias" ||
          alvo === "atas" ||
          alvo === "modelos" ||
          alvo === "modelos_ata" ||
          alvo === "importacoes"
        ) {
          await queryClient.invalidateQueries({ queryKey: chaves.store(alvo) });
        }
      }
      const item = ITENS_INDIVIDUAIS.find((i) => i.alvo === alvo);
      toast.success(
        alvo === "tudo"
          ? "Todos os cadastros operacionais foram apagados com sucesso."
          : `${item?.titulo ?? "Cadastros"} apagados com sucesso.`,
      );
      setConfirmarAlvo(null);
      setConfirmarTudoAberto(false);
      setTextoConfirmacaoTudo("");
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
            Somente usuários com perfil SuperADM têm permissão para visualizar ou executar a limpeza
            de cadastros.
          </AlertDescription>
        </Alert>
      </>
    );
  }

  const totalGeral = totalCadastrosOperacionais(contagens.data);
  const confirmacaoValida = textoConfirmacaoTudo.trim().toUpperCase() === FRASE_CONFIRMACAO_TUDO;

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
          <AlertDescription className="space-y-3">
            <p>
              Os registros apagados nesta tela são removidos definitivamente e não podem ser
              desfeitos sem um backup prévio. Seus usuários de acesso e os dados de identificação do
              escritório nunca são apagados por estas opções.
            </p>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/20 bg-background/80 px-3 py-2 text-xs text-foreground">
              <span>
                Último backup registrado:{" "}
                <strong>
                  {ultimoBackup.data?.em
                    ? formatDataHora(ultimoBackup.data.em)
                    : "nenhum backup registrado"}
                </strong>
              </span>
              <Button variant="outline" size="sm" asChild>
                <Link to="/backup">
                  <DatabaseBackup /> Fazer backup agora
                </Link>
              </Button>
            </div>
          </AlertDescription>
        </Alert>

        <SectionCard
          className="border-2 border-destructive/70 bg-destructive/5"
          titulo="1. Apagar TODOS os cadastros do sistema"
          descricao="Remove de uma só vez todos os condomínios, prestações de contas, relatórios mensais, editais, atas, modelos de ata e edital, importações pendentes, anexos, histórico de divergências e documentos indexados (preservando usuários, configurações do escritório e backups salvos)."
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="text-sm">
              Total acumulado nos cadastros operacionais:{" "}
              <Badge variant="destructive" className="ml-1 num">
                {contagens.isPending ? "…" : contagem(totalGeral, "registro", "registros")}
              </Badge>
            </div>
            <Button
              variant="destructive"
              disabled={contagens.isPending || limpar.isPending || totalGeral === 0}
              onClick={() => {
                setTextoConfirmacaoTudo("");
                setConfirmarTudoAberto(true);
              }}
            >
              {limpar.isPending && confirmarTudoAberto ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Trash2 />
              )}
              Apagar todos os cadastros ({contagens.isPending ? "…" : totalGeral})
            </Button>
          </div>
        </SectionCard>

        <SectionCard
          titulo="2. Apagar cadastros individualmente por categoria"
          descricao="Escolha apenas a categoria específica que deseja esvaziar, mantendo os demais cadastros intactos."
        >
          {contagens.isPending ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Consultando quantidade de registros…
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
                            descricao: `Serão removidos ${contagem(qtd, "registro", "registros")} de ${item.titulo}. Esta ação é definitiva e não pode ser desfeita.`,
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
        titulo={confirmarAlvo?.titulo ?? ""}
        descricao={confirmarAlvo?.descricao}
        rotuloConfirmar={confirmarAlvo?.rotuloConfirmar ?? "Confirmar exclusão"}
        destrutivo
        aoConfirmar={() => (confirmarAlvo ? limpar.mutateAsync(confirmarAlvo.alvo) : undefined)}
      />

      <Dialog
        open={confirmarTudoAberto}
        onOpenChange={(v) => {
          if (!limpar.isPending) {
            setConfirmarTudoAberto(v);
            if (!v) setTextoConfirmacaoTudo("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apagar TODOS os cadastros do sistema?</DialogTitle>
            <DialogDescription>
              Serão apagados definitivamente {contagem(totalGeral, "registro", "registros")} de
              condomínios, prestações de contas, relatórios mensais, editais, atas, modelos,
              importações, anexos e documentos indexados. Apenas usuários, configurações do
              escritório e backups salvos serão mantidos.
            </DialogDescription>
          </DialogHeader>
          <Field
            rotulo={`Digite ${FRASE_CONFIRMACAO_TUDO} para confirmar`}
            dica="Esta confirmação adicional evita exclusões acidentais de toda a base."
          >
            <Input
              value={textoConfirmacaoTudo}
              onChange={(e) => setTextoConfirmacaoTudo(e.target.value)}
              placeholder={FRASE_CONFIRMACAO_TUDO}
              autoComplete="off"
              disabled={limpar.isPending}
            />
          </Field>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setConfirmarTudoAberto(false);
                setTextoConfirmacaoTudo("");
              }}
              disabled={limpar.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={!confirmacaoValida || limpar.isPending}
              onClick={() => limpar.mutate("tudo")}
            >
              {limpar.isPending ? <Loader2 className="animate-spin" /> : <Trash2 />}
              Confirmar exclusão total
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
