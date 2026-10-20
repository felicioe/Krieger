import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Download, FileUp, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageHeader } from "@/components/app/PageHeader";
import { SectionCard } from "@/components/app/SectionCard";
import { ConfirmDialog } from "@/components/app/ConfirmDialog";
import { api, mensagemErro } from "@/lib/api";
import { useUsuario } from "@/lib/auth";
import { chaves, itemQuery } from "@/lib/queries";
import { formatDataHora } from "@/lib/format";
import { cabecalho } from "@/lib/head";
import { nomeArquivoBackup, resumoBackup, ROTULO_STORE } from "@/domain/backup";
import { diasDesdeBackup } from "@/domain/painel";
import type { Backup as DadosBackup, ConfigBackup } from "@/domain/types";

export const Route = createFileRoute("/_authenticated/backup")({
  head: () => cabecalho("Backup", "Exportar e restaurar os dados do Sistema Krieger."),
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(itemQuery<ConfigBackup>("config", "backup")),
  component: PaginaBackup,
});

function PaginaBackup() {
  const usuario = useUsuario();
  const queryClient = useQueryClient();
  const { data: ultimo } = useSuspenseQuery(itemQuery<ConfigBackup>("config", "backup"));
  const [exportando, setExportando] = useState(false);
  const [arquivo, setArquivo] = useState<{ nome: string; dados: DadosBackup } | null>(null);
  const [modo, setModo] = useState<"mesclar" | "substituir">("mesclar");
  const [confirmar, setConfirmar] = useState(false);
  const [restaurando, setRestaurando] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const admin = usuario?.perfil === "admin";
  const dias = diasDesdeBackup(ultimo?.em);

  async function exportar() {
    setExportando(true);
    try {
      const dados = await api.exportar();
      const blob = new Blob([JSON.stringify(dados, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nomeArquivoBackup();
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      const reg = await api.salvar<ConfigBackup>("config", { id: "backup", em: new Date().toISOString() });
      queryClient.setQueryData(chaves.item("config", "backup"), reg);
      toast.success("Backup exportado.");
    } catch (e) {
      toast.error(mensagemErro(e));
    } finally {
      setExportando(false);
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

  async function restaurar() {
    if (!arquivo) return;
    setRestaurando(true);
    try {
      await api.importar(arquivo.dados, modo === "substituir");
      await queryClient.invalidateQueries();
      toast.success(modo === "substituir" ? "Dados substituídos pelo backup." : "Backup mesclado aos dados atuais.");
      setArquivo(null);
    } catch (e) {
      toast.error(mensagemErro(e));
      throw e;
    } finally {
      setRestaurando(false);
    }
  }

  const resumo = arquivo ? resumoBackup(arquivo.dados) : null;

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
          <Button className="mt-4" onClick={exportar} disabled={exportando}>
            {exportando ? <Loader2 className="animate-spin" /> : <Download />}
            Exportar backup
          </Button>
          <p className="mt-3 text-xs text-muted-foreground">
            Gera o arquivo <span className="font-mono">{nomeArquivoBackup()}</span>.
          </p>
        </SectionCard>

        <SectionCard titulo="Restaurar">
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

              {arquivo && resumo && (
                <>
                  <div className="rounded-md border bg-muted/40 p-3 text-sm">
                    <div className="mb-2 font-medium text-foreground">{arquivo.nome}</div>
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
                      <RadioGroupItem value="mesclar" id="modo-mesclar" className="mt-0.5" />
                      <Label htmlFor="modo-mesclar" className="grid gap-0.5 font-normal">
                        <span className="font-medium">Mesclar</span>
                        <span className="text-xs text-muted-foreground">Adiciona e atualiza registros, mantendo os demais.</span>
                      </Label>
                    </div>
                    <div className="flex items-start gap-2">
                      <RadioGroupItem value="substituir" id="modo-substituir" className="mt-0.5" />
                      <Label htmlFor="modo-substituir" className="grid gap-0.5 font-normal">
                        <span className="font-medium">Substituir</span>
                        <span className="text-xs text-muted-foreground">Apaga todos os dados atuais e usa somente os do arquivo.</span>
                      </Label>
                    </div>
                  </RadioGroup>
                  {modo === "substituir" && (
                    <Alert variant="destructive">
                      <AlertDescription>Os dados atuais serão apagados. Faça um backup antes, se necessário.</AlertDescription>
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
                </>
              )}
            </div>
          )}
        </SectionCard>
      </div>

      <ConfirmDialog
        aberto={confirmar}
        aoMudar={setConfirmar}
        titulo="Substituir todos os dados?"
        descricao="Todos os condomínios, prestações de contas, editais, atas e configurações atuais serão apagados e substituídos pelo conteúdo do arquivo. Esta ação não pode ser desfeita."
        rotuloConfirmar="Substituir dados"
        destrutivo
        aoConfirmar={restaurar}
      />
    </>
  );
}
