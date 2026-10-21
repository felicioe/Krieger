import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { forwardRef, useEffect, useRef, useState, type ComponentPropsWithoutRef, type InputHTMLAttributes } from "react";
import { Input } from "@/components/ui/input";
import { formatNumeroBR, mascaraData, mascaraHora, mascaraMesAno, parseNumeroBR } from "@/lib/format";
import { cn } from "@/lib/utils";

type BaseProps = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "defaultValue">;

interface NumeroProps extends BaseProps {
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  casas?: number;
  prefixo?: string;
  sufixo?: string;
}

/**
 * Campo numérico no padrão brasileiro: aceita vírgula decimal e ponto de milhar,
 * mostra o valor formatado (1.234,56) ao sair do campo.
 */
export const NumeroInput = forwardRef<HTMLInputElement, NumeroProps>(function NumeroInput(
  { value, onChange, casas = 2, prefixo, sufixo, className, onBlur, onFocus, ...props },
  ref,
) {
  const [texto, setTexto] = useState(() => formatNumeroBR(value ?? null, casas));
  const focado = useRef(false);

  useEffect(() => {
    if (!focado.current) setTexto(formatNumeroBR(value ?? null, casas));
  }, [value, casas]);

  return (
    <div className="relative">
      {prefixo && (
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
          {prefixo}
        </span>
      )}
      <Input
        ref={ref}
        inputMode="decimal"
        autoComplete="off"
        {...props}
        className={cn("num text-right", prefixo && "pl-10", sufixo && "pr-8", className)}
        value={texto}
        onFocus={(e) => {
          focado.current = true;
          onFocus?.(e);
        }}
        onChange={(e) => {
          const t = e.target.value.replace(/[^\d.,-]/g, "");
          setTexto(t);
          onChange(parseNumeroBR(t));
        }}
        onBlur={(e) => {
          focado.current = false;
          const n = parseNumeroBR(texto);
          setTexto(formatNumeroBR(n, casas));
          onBlur?.(e);
        }}
      />
      {sufixo && (
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
          {sufixo}
        </span>
      )}
    </div>
  );
});

/** Campo de dinheiro em R$. */
export const DinheiroInput = forwardRef<HTMLInputElement, Omit<NumeroProps, "casas" | "prefixo">>(
  function DinheiroInput(props, ref) {
    return <NumeroInput ref={ref} casas={2} prefixo="R$" placeholder="0,00" {...props} />;
  },
);

/** Campo de percentual. */
export const PercentualInput = forwardRef<HTMLInputElement, Omit<NumeroProps, "sufixo">>(
  function PercentualInput({ casas = 2, ...props }, ref) {
    return <NumeroInput ref={ref} casas={casas} sufixo="%" placeholder="0,00" {...props} />;
  },
);

/** Campo de número inteiro (unidades, dias, ano...). */
export const InteiroInput = forwardRef<HTMLInputElement, NumeroProps>(function InteiroInput(
  { value, onChange, className, ...props },
  ref,
) {
  return (
    <Input
      ref={ref}
      inputMode="numeric"
      autoComplete="off"
      {...props}
      className={cn("num", className)}
      value={value ?? ""}
      onChange={(e) => {
        const d = e.target.value.replace(/\D/g, "");
        onChange(d ? Number(d) : null);
      }}
    />
  );
});

interface TextoMascaraProps extends BaseProps {
  value: string | null | undefined;
  onChange: (v: string) => void;
}

function criarMascara(mascara: (s: string) => string, placeholder: string, nome: string) {
  const C = forwardRef<HTMLInputElement, TextoMascaraProps>(({ value, onChange, className, ...props }, ref) => (
    <Input
      ref={ref}
      inputMode="numeric"
      autoComplete="off"
      placeholder={placeholder}
      {...props}
      className={cn("num", className)}
      value={value ?? ""}
      onChange={(e) => onChange(mascara(e.target.value))}
    />
  ));
  C.displayName = nome;
  return C;
}

/** Data dd/mm/aaaa */
export const DataInput = criarMascara(mascaraData, "dd/mm/aaaa", "DataInput");
/** Mês/ano mm/aaaa */
export const MesAnoInput = criarMascara(mascaraMesAno, "mm/aaaa", "MesAnoInput");
/** Horário hh:mm */
export const HoraInput = criarMascara(mascaraHora, "hh:mm", "HoraInput");

// ---- Seleção simples (shadcn Select) ----

type AtributosTrigger = Pick<
  ComponentPropsWithoutRef<typeof SelectTrigger>,
  "aria-invalid" | "aria-describedby" | "aria-required" | "aria-label" | "aria-labelledby" | "disabled" | "name" | "title"
>;

/**
 * Seleção simples. Os atributos de acessibilidade (id, aria-invalid, aria-describedby,
 * aria-required, aria-label…) vão para o botão que abre a lista, que é o controle focado —
 * assim o `Field` consegue ligar rótulo, dica, erro e obrigatoriedade a ele.
 */
export function Selecao<V extends string>({
  id,
  value,
  onChange,
  opcoes,
  placeholder = "Selecione",
  className,
  ...atributos
}: {
  id?: string;
  value: V | "" | null | undefined;
  onChange: (v: V) => void;
  opcoes: { valor: V; rotulo: string }[];
  placeholder?: string;
  className?: string;
} & AtributosTrigger) {
  return (
    <Select {...(value ? { value } : {})} onValueChange={(v) => onChange(v as V)} {...(atributos.disabled ? { disabled: true } : {})}>
      <SelectTrigger id={id} className={className} {...atributos}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {opcoes.map((o) => (
          <SelectItem key={o.valor} value={o.valor}>
            {o.rotulo}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
