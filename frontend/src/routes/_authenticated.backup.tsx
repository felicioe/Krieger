import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useId, useRef, useState } from "react";
import { Download, FileUp, Loader2, RotateCcw, Server, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader } from "@/components/app/PageHeader";
import { SectionCard } from "@/components/app/SectionCard";
import { ConfirmDialog } from "@/components/app/ConfirmDialog";
import { DataTable, type Coluna } from "@/components/app/DataTable";
import { api, mensagemErro } from "@/lib/api";
import { useUsuario } from "@/lib/auth";
import { backupsQuery, chaves, itemQuery } from "@/lib/queries";
import { formatDataHora, formatBytes } from "@/lib/format";
import { cabecalho } from "@/lib/head";
import { nomeArquivoBackup, resumoBackup, ROTULO_STORE } from "@/domain/backup";
import { diasDesdeBackup } from "@/domain/painel";
import type { BackupRegistro, Backup as DadosBackup, ConfigBackup } from "@/domain/types";

export const Route = createFileRoute("/_authenticated/backup")({
  head: () => cabecalho("Backup", "Gerar, baixar e restaurar backups dos dados do Sistema Krieger."),
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(itemQuery<ConfigBackup>("config", "backup")),
  component: PaginaBackup,
});

/** Baixa o conteúdo do backup como arquivo .json (para guardar em mídia externa). */
function baixarComoArquivo(dados: DadosBackup, nome: string) {
  const blob = new Blob([JSON.stringify(dados, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function PaginaBackup() {
  const usuario = useUsuario();
  const queryClient = useQueryClient();
  const { data: ultimo } = useSuspenseQuery(itemQuery<ConfigBackup>("config", "backup"));
  // Histórico sem suspense: se o servidor ainda não tiver o histórico, o restante da tela continua funcionando.
  const historico = useQuery(backupsQuery());
  const [gerando, setGerando] = useState(false);
  const [baixandoId, setBaixandoId] = useState<string | null>(null);
  const [abrindoId, setAbrindoId] = useState<string | null>(null);
  const [doServidor, setDoServidor] = useState<{ reg: BackupRegistro; dados: DadosBackup } | null>(null);
  const [excluir, setExcluir] = useState<BackupRegistro | null>(null);
  const [arquivo, setArquivo] = useState<{ nome: string; dados: DadosBackup } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const admin = usuario?.perfil === "admin";
  const dias = diasDesdeBackup(ultimo?.em);

  async function gerar() {
    setGerando(true);
    try {
      const reg = await api.backup.criar();
      const cfg = await api.salvar<ConfigBackup>("config", { id: "backup", em: reg.criadoEm || new Date().toISOString() });
      queryClient.setQueryData(chaves.item("config", "backup"), cfg);
      await queryClient.invalidateQueries({ queryKey: chaves.backups });
      toast.success("Backup gerado e salvo no servidor.");
    } catch (e) {
      toast.error(mensagemErro(e));
    } finally {
      setGerando(false);
    }
  }

  async function baixar(reg: BackupRegistro) {
    setBaixandoId(reg.id);
    try {
      const dados = await api.backup.baixar(reg.id);
      baixarComoArquivo(dados, nomeArquivoBackup(new Date(reg.criadoEm)));
    } catch (e) {
      toast.error(mensagemErro(e));
    } finally {
      setBaixandoId(null);
    }
  }

  async function abrirRestauracao(reg: BackupRegistro) {
    setAbrindoId(reg.id);
    try {
      const dados = await api.backup.baixar(reg.id);
      if (!resumoBackup(dados)) throw new Error("Este backup está vazio ou não pôde ser lido.");
      setDoServidor({ reg, dados });
    } catch (e) {
      toast.error(mensagemErro(e));
    } finally {
      setAbrindoId(null);
    }
  }

  async function restaurarDoServidor(substituir: boolean) {
    if (!doServidor) return;
    try {
      await api.backup.restaurar(doServidor.reg.id, substituir);
      await queryClient.invalidateQueries();
      toast.success(substituir ? "Dados substituídos pelo backup." : "Backup mesclado aos dados atuais.");
      setDoServidor(null);
    } catch (e) {
      toast.error(mensagemErro(e));
      throw e;
    }
  }

  async function confirmarExclusao() {
    if (!excluir) return;
    try {
      await api.backup.excluir(excluir.id);
      await queryClient.invalidateQueries({ queryKey: chaves.backups });
      toast.success("Backup excluído do servidor.");
    } catch (e) {
      toast.error(mensagemErro(e));
      throw e;
    }
  }

  async function lerArquivo(f: File | undefined) {
    if (!f) return;
    try {
      const dados = JSON.parse(await f.text());
      if (!resumoBackup(dados)) throw new Error("O arquivo não parece ser um backup do Sistema Krieger.");
      setArquivo({ nome: f.name, dados });
    } catch (e) {
      setArquivo(null);
      toast.error(e instanceof SyntaxError ? "Arquivo inválido: não é um JSON." : mensagemErro(e));
    } finally {
      if (input.current) input.current.value = "";
    }
  }

  async function restaurarArquivo(substituir: boolean) {
    if (!arquivo) return;
    try {
      await api.importar(arquivo.dados, substituir);
      await queryClient.invalidateQueries();
      toast.success(substituir ? "Dados substituídos pelo backup." : "Backup mesclado aos dados atuais.");
      setArquivo(null);
    } catch (e) {
      toast.error(mensagemErro(e));
      throw e;
    }
  }

  const colunas: Coluna<BackupRegistro>[] = [
    { chave: "criadoEm", titulo: "Data e hora", render: (r) => <span className="num">{formatDataHora(r.criadoEm)}</span> },
    { chave: "geradoPorNome", titulo: "Gerado por", render: (r) => r.geradoPorNome || "—" },
    {
      chave: "tamanho",
      titulo: "Tamanho",
      alinhar: "direita",
      render: (r) => <span className="num">{formatBytes(r.tamanhoBytes)}</span>,
    },
    {
      chave: "acoes",
      titulo: "Ações",
      alinhar: "direita",
      render: (r) => (
        <div className="flex flex-wrap justify-end gap-2">
          <Button size="sm" variant="outline" onClick={() => baixar(r)} disabled={baixandoId === r.id}>
            {baixandoId === r.id ? <Loader2 className="animate-spin" /> : <Download />}
            Baixar
          </Button>
          {admin && (
            <>
              <Button size="sm" variant="outline" onClick={() => abrirRestauracao(r)} disabled={abrindoId === r.id}>
                {abrindoId === r.id ? <Loader2 className="animate-spin" /> : <RotateCcw />}
                Restaurar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => setExcluir(r)}
                aria-label={`Excluir backup de ${formatDataHora(r.criadoEm)}`}
              >
                <Trash2 /> Excluir
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader titulo="Backup" descricao="Guarde uma cópia dos dados com frequência — recomendamos ao menos uma vez por mês." />
      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard titulo="Exportar">
          <p className="text-sm text-muted-foreground">
            Último backup:{" "}
            <strong className="text-foreground">
              {ultimo?.em ? `${formatDataHora(ultimo.em)}${dias !== null ? ` (há ${dias} dia(s))` : ""}` : "nunca realizado"}
            </strong>
          </p>
          <Button className="mt-4" onClick={gerar} disabled={gerando}>
            {gerando ? <Loader2 className="animate-spin" /> : <Server />}
            Gerar backup no servidor
          </Button>
          <p className="mt-3 text-xs text-muted-foreground">
            O backup fica guardado no servidor, em nome de quem gerou. Para levar uma cópia para um pen drive ou HD externo, use
            “Baixar” no histórico abaixo.
          </p>
        </SectionCard>

        <SectionCard titulo="Restaurar de um arquivo">
          {!admin ? (
            <p className="text-sm text-muted-foreground">Somente administradores podem restaurar backups.</p>
          ) : (
            <div className="grid gap-4">
              <input
                ref={input}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => lerArquivo(e.target.files?.[0])}
              />
              <div>
                <Button variant="outline" onClick={() => input.current?.click()}>
                  <FileUp /> Escolher arquivo de backup
                </Button>
              </div>
              {arquivo && (
                <ConferenciaRestauracao
                  key={arquivo.nome}
                  titulo={arquivo.nome}
                  dados={arquivo.dados}
                  origem="do arquivo"
                  aoRestaurar={restaurarArquivo}
                />
              )}
            </div>
          )}
        </SectionCard>

        <SectionCard
          className="lg:col-span-2"
          titulo="Backups no servidor"
          descricao="Do mais recente para o mais antigo."
        >
          {historico.isPending ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Carregando histórico…
            </div>
          ) : historico.isError ? (
            <Alert variant="destructive">
              <AlertDescription>
                Não foi possível carregar o histórico de backups: {mensagemErro(historico.error)}
              </AlertDescription>
            </Alert>
          ) : (
            <DataTable
              colunas={colunas}
              dados={historico.data}
              chaveLinha={(r) => r.id}
              vazio="Nenhum backup salvo no servidor ainda. Use “Gerar backup no servidor”."
            />
          )}
        </SectionCard>
      </div>

      <Dialog open={!!doServidor} onOpenChange={(v) => !v && setDoServidor(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Restaurar backup do servidor</DialogTitle>
            <DialogDescription>
              {doServidor &&
                `Gerado em ${formatDataHora(doServidor.reg.criadoEm)} por ${doServidor.reg.geradoPorNome || "—"} · ${formatBytes(doServidor.reg.tamanhoBytes)}`}
            </DialogDescription>
          </DialogHeader>
          {doServidor && (
            <ConferenciaRestauracao
              key={doServidor.reg.id}
              titulo="Conteúdo do backup"
              dados={doServidor.dados}
              origem={`do backup de ${formatDataHora(doServidor.reg.criadoEm)}`}
              aoRestaurar={restaurarDoServidor}
            />
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        aberto={!!excluir}
        aoMudar={(v) => !v && setExcluir(null)}
        titulo="Excluir este backup do servidor?"
        descricao={
          excluir
            ? `O backup de ${formatDataHora(excluir.criadoEm)}, gerado por ${excluir.geradoPorNome || "—"}, será apagado do servidor. Esta ação não pode ser desfeita.`
            : undefined
        }
        rotuloConfirmar="Excluir backup"
        destrutivo
        aoConfirmar={confirmarExclusao}
      />
    </>
  );
}

/** Conferência antes de restaurar: registros por tipo, Mesclar × Substituir e confirmação no modo destrutivo. */
function ConferenciaRestauracao({
  titulo,
  dados,
  origem,
  aoRestaurar,
}: {
  titulo: string;
  dados: DadosBackup;
  /** Complemento da frase de confirmação, ex.: "do arquivo". */
  origem: string;
  aoRestaurar: (substituir: boolean) => Promise<void>;
}) {
  const id = useId();
  const [modo, setModo] = useState<"mesclar" | "substituir">("mesclar");
  const [confirmar, setConfirmar] = useState(false);
  const [restaurando, setRestaurando] = useState(false);
  const resumo = resumoBackup(dados);

  async function restaurar() {
    setRestaurando(true);
    try {
      await aoRestaurar(modo === "substituir");
    } finally {
      setRestaurando(false);
    }
  }

  if (!resumo) return null;

  return (
    <div className="grid gap-4">
      <div className="rounded-md border bg-muted/40 p-3 text-sm">
        <div className="mb-2 font-medium text-foreground">{titulo}</div>
        <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {resumo.map((r) => (
            <li key={r.store} className="flex justify-between">
              <span>{ROTULO_STORE[r.store]}</span>
              <span className="num text-foreground">{r.total}</span>
            </li>
          ))}
        </ul>
      </div>
      <RadioGroup value={modo} onValueChange={(v) => setModo(v as typeof modo)} className="gap-3">
        <div className="flex items-start gap-2">
          <RadioGroupItem value="mesclar" id={`${id}-mesclar`} className="mt-0.5" />
          <Label htmlFor={`${id}-mesclar`} className="grid gap-0.5 font-normal">
            <span className="font-medium">Mesclar</span>
            <span className="text-xs text-muted-foreground">Adiciona e atualiza registros, mantendo os demais.</span>
          </Label>
        </div>
        <div className="flex items-start gap-2">
          <RadioGroupItem value="substituir" id={`${id}-substituir`} className="mt-0.5" />
          <Label htmlFor={`${id}-substituir`} className="grid gap-0.5 font-normal">
            <span className="font-medium">Substituir</span>
            <span className="text-xs text-muted-foreground">Apaga todos os dados atuais e usa somente os do backup.</span>
          </Label>
        </div>
      </RadioGroup>
      {modo === "substituir" && (
        <Alert variant="destructive">
          <AlertDescription>Os dados atuais serão apagados. Gere um backup antes, se necessário.</AlertDescription>
        </Alert>
      )}
      <div>
        <Button
          variant={modo === "substituir" ? "destructive" : "default"}
          disabled={restaurando}
          onClick={() => (modo === "substituir" ? setConfirmar(true) : restaurar().catch(() => undefined))}
        >
          {restaurando ? <Loader2 className="animate-spin" /> : <Upload />}
          Restaurar backup
        </Button>
      </div>

      <ConfirmDialog
        aberto={confirmar}
        aoMudar={setConfirmar}
        titulo="Substituir todos os dados?"
        descricao={`Todos os condomínios, prestações de contas, editais, atas e configurações atuais serão apagados e substituídos pelo conteúdo ${origem}. Esta ação não pode ser desfeita.`}
        rotuloConfirmar="Substituir dados"
        destrutivo
        aoConfirmar={restaurar}
      />
    </div>
  );
}
