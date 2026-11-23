import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@/components/app/LinkPermitido";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/app/Field";
import { SectionCard } from "@/components/app/SectionCard";
import { DinheiroInput } from "@/components/app/inputs";
import { api, mensagemErro } from "@/lib/api";
import { temPermissao, useUsuario } from "@/lib/auth";
import { chaves } from "@/lib/queries";
import { formatBRL } from "@/lib/format";
import { novoId } from "@/lib/id";
import {
  formatarPercentualCompleto,
  historicoDoAno,
  linhaAnoAnterior,
  linhaRateioAlterada,
  linhaRateioDe,
  parsePercentualCompleto,
  percentualEmUsoDaLinha,
  planejarAnoAnterior,
  validarLinhasRateio,
  variacaoCompleta,
} from "@/domain/historicoRateio";
import type { HistoricoRateio } from "@/domain/types";

/**
 * Histórico de rateios dentro da Previsão Orçamentária (issue #294): o rateio histórico e o % histórico
 * (do ano anterior, base desta previsão) aparecem preenchidos pelo histórico, ou vazios e editáveis
 * quando não há dado anterior, sem sair da tela. O que é salvo aqui vai para o mesmo histórico que o
 * cadastro do condomínio mostra. O % informado vale mais que o calculado.
 */
export function HistoricoRateiosPrevisao({
  condoId,
  condoNome,
  ano,
  historico,
}: {
  condoId: string;
  condoNome: string;
  ano: number;
  historico: HistoricoRateio[];
}) {
  const queryClient = useQueryClient();
  const podeEditar = temPermissao(useUsuario(), "previsao_orcamentaria.editar");
  const gravada = linhaAnoAnterior(historico, condoId, ano);
  const [linha, setLinha] = useState(gravada);
  const mudou = linhaRateioAlterada(gravada, linha);
  const usada = percentualEmUsoDaLinha(linha, !mudou);
  const calculado = variacaoCompleta(linha.rateioAtual, linha.rateioAprovado);
  const informado = parsePercentualCompleto(linha.textoPercentual);
  const validacao = validarLinhasRateio([linha], condoId);
  const erro = validacao.porLinha[0];
  const doAno = historicoDoAno(historico, condoId, ano);
  const doAnoLinha = doAno ? linhaRateioDe(doAno) : null;
  const doAnoUsado = doAnoLinha ? percentualEmUsoDaLinha(doAnoLinha, true) : null;

  const salvar = useMutation({
    mutationFn: async () => {
      const plano = planejarAnoAnterior(historico, linha, {
        condoId,
        condoNome,
        agora: new Date().toISOString(),
        novoId,
      });
      for (const l of plano.salvar) await api.salvar("historico_rateios", l);
      return plano.salvar.length;
    },
    onSuccess: async (qtd) => {
      await queryClient.invalidateQueries({ queryKey: chaves.lista("historico_rateios") });
      toast.success(
        qtd > 0
          ? `Histórico de ${ano - 1} salvo. Ele também aparece no cadastro do condomínio.`
          : "Nada mudou no histórico.",
      );
    },
    onError: (e) => toast.error(mensagemErro(e)),
  });

  const usar = (v: number | null) =>
    v !== null && setLinha((l) => ({ ...l, textoPercentual: formatarPercentualCompleto(v) }));

  return (
    <SectionCard
      className="mb-6"
      titulo="Histórico de rateios"
      descricao={`Base desta previsão: o rateio e o % de ${ano - 1}. O % informado vale mais que o calculado.`}
    >
      {!doAno && !mudou && (
        <p className="mb-3 flex gap-2 text-sm text-muted-foreground" role="status">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning-foreground" />
          Sem histórico de {ano - 1}: informe o rateio histórico e o % abaixo (ou use o rateio atual
          do exercício) para a previsão partir do valor correto.
        </p>
      )}
      <div className="grid min-w-0 gap-4 md:grid-cols-[minmax(0,10rem)_minmax(0,10rem)_minmax(0,1fr)]">
        <Field rotulo={`Rateio histórico (${ano - 1})`} erro={mudou ? (erro ?? null) : null}>
          <DinheiroInput
            value={linha.rateioAprovado}
            onChange={(v) => setLinha((l) => ({ ...l, rateioAprovado: v }))}
            disabled={!podeEditar}
          />
        </Field>
        <Field rotulo="% histórico" dica="Vazio = usar o calculado. Até 6 casas.">
          <Input
            value={linha.textoPercentual}
            onChange={(e) =>
              setLinha((l) => ({ ...l, textoPercentual: e.target.value.replace(/[^\d.,%-]/g, "") }))
            }
            onBlur={() => informado !== null && usar(informado)}
            inputMode="decimal"
            autoComplete="off"
            placeholder="vazio = calculado"
            className="num text-right"
            disabled={!podeEditar}
          />
        </Field>
        <div className="min-w-0 space-y-1 text-sm">
          <p className="flex flex-wrap items-center gap-2">
            % em uso:{" "}
            <strong className="num">
              {usada.valor === null ? "—" : `${formatarPercentualCompleto(usada.valor)}%`}
            </strong>
            <Badge variant={usada.origem === "informado" ? "default" : "secondary"}>
              {usada.origem === "informado" ? "Informado" : "Calculado"}
            </Badge>
          </p>
          {calculado !== null && calculado !== informado && (
            <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              Calculado dos rateios ({formatBRL(linha.rateioAtual ?? 0)} →{" "}
              {formatBRL(linha.rateioAprovado ?? 0)}):{" "}
              <span className="num">{formatarPercentualCompleto(calculado)}%</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => usar(calculado)}
              >
                Usar
              </Button>
            </p>
          )}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          size="sm"
          permissao="previsao_orcamentaria.editar"
          disabled={!mudou || !!erro || salvar.isPending}
          onClick={() => salvar.mutate()}
        >
          {salvar.isPending ? <Loader2 className="animate-spin" /> : <Save />} Salvar histórico de{" "}
          {ano - 1}
        </Button>
        <p className="text-xs text-muted-foreground">
          {doAno ? (
            <>
              {ano} já travado: rateio {formatBRL(doAno.rateioAprovado)} ·{" "}
              {doAnoUsado?.valor == null ? "—" : `${formatarPercentualCompleto(doAnoUsado.valor)}%`}{" "}
              ({doAnoUsado?.origem === "informado" ? "informado" : "calculado"}).{" "}
            </>
          ) : (
            <>Ao travar o rateio de {ano}, o aprovado e o % vão para o histórico. </>
          )}
          <Link to="/condominios/$id" params={{ id: condoId }} className="underline">
            Ver no cadastro do condomínio
          </Link>
        </p>
      </div>
    </SectionCard>
  );
}
