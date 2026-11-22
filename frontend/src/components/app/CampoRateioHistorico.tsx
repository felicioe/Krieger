import type { ComponentProps } from "react";
import { Field } from "@/components/app/Field";
import { DinheiroInput } from "@/components/app/inputs";

/**
 * Campo de rateio que tem o histórico de rateios como fonte (#308, #327). Quando o histórico tem
 * o valor, o campo é só leitura e mostra de onde ele vem; sem histórico, é um campo editável.
 */
export function CampoRateioHistorico({
  rotulo,
  valor,
  onChange,
  disabled,
  className,
  dica,
  doHistorico,
}: {
  rotulo: string;
  valor: number | null | undefined;
  onChange: ComponentProps<typeof DinheiroInput>["onChange"];
  disabled?: boolean | undefined;
  className?: string;
  /** Dica do campo editável. */
  dica?: string;
  /** Valor vindo do histórico e a explicação da origem; `null` deixa o campo editável. */
  doHistorico: { valor: number; dica: string } | null;
}) {
  if (doHistorico)
    return (
      <Field rotulo={rotulo} dica={doHistorico.dica} {...(className ? { className } : {})}>
        <DinheiroInput value={doHistorico.valor} onChange={() => {}} disabled />
      </Field>
    );
  return (
    <Field rotulo={rotulo} {...(className ? { className } : {})} {...(dica ? { dica } : {})}>
      <DinheiroInput value={valor ?? null} onChange={onChange} disabled={!!disabled} />
    </Field>
  );
}
