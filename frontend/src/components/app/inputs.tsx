import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { forwardRef, useEffect, useMemo, useRef, useState, type ComponentPropsWithoutRef, type InputHTMLAttributes } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatNumeroBR, mascaraData, mascaraHora, mascaraMesAno, parseNumeroBR } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Condominio } from "@/domain/types";

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

// ---- Seleção com pesquisa inline (Combobox) ----

export interface OpcaoBusca<V extends string = string> {
  valor: V;
  rotulo: string;
  /** Texto adicional considerado na pesquisa (ex.: código, razão social, CNPJ). */
  busca?: string | undefined;
  /** Etiqueta curta exibida ao lado do rótulo (ex.: código do condomínio). */
  detalhe?: string | undefined;
}

function normalizarTextoBusca(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Monta as opções de condomínio já ordenadas e prontas para pesquisa inline
 * por código, nome, nome no relatório ou CNPJ.
 */
export function opcoesCondominio(
  condominios: Condominio[],
  usarNomeRelatorio = false,
): OpcaoBusca<string>[] {
  const obterRotulo = (c: Condominio) => (usarNomeRelatorio ? c.nomeRelatorio || c.nome : c.nome);
  return [...condominios]
    .sort((a, b) => obterRotulo(a).localeCompare(obterRotulo(b), "pt-BR"))
    .map((c) => ({
      valor: c.id,
      rotulo: obterRotulo(c),
      detalhe: c.codigo?.trim() || undefined,
      busca: [c.codigo, c.nome, c.nomeRelatorio, c.cnpj].filter(Boolean).join(" "),
    }));
}

/**
 * Seleção com pesquisa inline para listas extensas (como condomínios).
 * Ao clicar ou digitar no campo, abre a lista com campo de busca imediato
 * por nome, código ou CNPJ (ignorando acentos e maiúsculas/minúsculas).
 */
export function SelecaoBusca<V extends string>({
  id,
  value,
  onChange,
  opcoes,
  placeholder = "Selecione",
  placeholderBusca = "Pesquisar por nome, código ou CNPJ...",
  textoVazio = "Nenhum resultado encontrado.",
  className,
  ...atributos
}: {
  id?: string;
  value: V | "" | null | undefined;
  onChange: (v: V) => void;
  opcoes: OpcaoBusca<V>[];
  placeholder?: string;
  placeholderBusca?: string;
  textoVazio?: string;
  className?: string;
} & AtributosTrigger) {
  const [aberto, setAberto] = useState(false);
  const [termo, setTermo] = useState("");
  const [indiceAtivo, setIndiceAtivo] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listaRef = useRef<HTMLDivElement>(null);

  const selecionada = useMemo(() => opcoes.find((o) => o.valor === value), [opcoes, value]);

  const filtradas = useMemo(() => {
    const palavras = normalizarTextoBusca(termo).split(/\s+/).filter(Boolean);
    if (palavras.length === 0) return opcoes;
    return opcoes.filter((o) => {
      const alvo = normalizarTextoBusca([o.rotulo, o.detalhe, o.busca].filter(Boolean).join(" "));
      const apenasDigitos = alvo.replace(/\D/g, "");
      return palavras.every((p) => {
        const pDigitos = p.replace(/\D/g, "");
        return alvo.includes(p) || (pDigitos.length >= 2 && apenasDigitos.includes(pDigitos));
      });
    });
  }, [opcoes, termo]);

  useEffect(() => {
    if (!aberto) {
      setTermo("");
      return;
    }
    const idxAtual = filtradas.findIndex((o) => o.valor === value);
    setIndiceAtivo(idxAtual >= 0 ? idxAtual : 0);
  }, [aberto]);

  useEffect(() => {
    setIndiceAtivo(0);
  }, [termo]);

  useEffect(() => {
    if (!aberto || !listaRef.current) return;
    const item = listaRef.current.querySelector<HTMLElement>(`[data-indice="${indiceAtivo}"]`);
    item?.scrollIntoView?.({ block: "nearest" });
  }, [aberto, indiceAtivo]);

  function escolher(valor: V) {
    onChange(valor);
    setAberto(false);
    triggerRef.current?.focus();
  }

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <button
          ref={triggerRef}
          id={id}
          type="button"
          role="combobox"
          aria-expanded={aberto}
          aria-haspopup="listbox"
          data-placeholder={selecionada ? undefined : ""}
          onKeyDown={(e) => {
            if (atributos.disabled) return;
            if (!aberto && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
              e.preventDefault();
              setTermo(e.key);
              setAberto(true);
            } else if (!aberto && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
              e.preventDefault();
              setAberto(true);
            }
          }}
          className={cn(
            "flex min-h-9 max-md:min-h-11 pointer-coarse:min-h-11 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-control bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background cursor-pointer data-[placeholder]:text-muted-foreground focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring aria-[invalid=true]:border-destructive aria-[invalid=true]:focus:ring-destructive disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
          {...atributos}
        >
          {selecionada ? (
            <span className="flex min-w-0 items-center gap-2 text-left">
              {selecionada.detalhe && (
                <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                  {selecionada.detalhe}
                </span>
              )}
              <span className="min-w-0 break-words">{selecionada.rotulo}</span>
            </span>
          ) : (
            <span className="min-w-0 break-words text-left text-muted-foreground">{placeholder}</span>
          )}
          <span className="flex shrink-0 items-center gap-1 text-muted-foreground">
            <Search className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          inputRef.current?.focus();
        }}
        className="w-(--radix-popover-trigger-width) min-w-[18rem] max-w-[calc(100vw-2rem)] p-0"
      >
        <div className="flex items-center border-b px-3 py-1.5">
          <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder={placeholderBusca}
            aria-label={placeholderBusca}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                if (filtradas.length > 0) {
                  setIndiceAtivo((atual) => (atual + 1) % filtradas.length);
                }
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                if (filtradas.length > 0) {
                  setIndiceAtivo((atual) => (atual - 1 + filtradas.length) % filtradas.length);
                }
              } else if (e.key === "Enter") {
                e.preventDefault();
                const item = filtradas[indiceAtivo];
                if (item) escolher(item.valor);
              } else if (e.key === "Escape") {
                e.preventDefault();
                setAberto(false);
                triggerRef.current?.focus();
              }
            }}
            className="flex h-8 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {termo && (
            <button
              type="button"
              onClick={() => {
                setTermo("");
                inputRef.current?.focus();
              }}
              aria-label="Limpar pesquisa"
              className="ml-1 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
        <div
          ref={listaRef}
          role="listbox"
          aria-label="Opções disponíveis"
          className="max-h-72 overflow-y-auto overflow-x-hidden p-1"
        >
          {filtradas.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">{textoVazio}</p>
          ) : (
            filtradas.map((o, i) => {
              const selecionado = o.valor === value;
              return (
                <button
                  key={o.valor}
                  type="button"
                  role="option"
                  data-indice={i}
                  aria-selected={selecionado}
                  onClick={() => escolher(o.valor)}
                  onMouseMove={() => setIndiceAtivo(i)}
                  className={cn(
                    "relative flex w-full cursor-pointer select-none items-center gap-2 rounded-sm py-1.5 pl-2 pr-8 text-left text-sm outline-none",
                    i === indiceAtivo ? "bg-accent text-accent-foreground" : "hover:bg-accent/60",
                  )}
                >
                  {o.detalhe && (
                    <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                      {o.detalhe}
                    </span>
                  )}
                  <span className="min-w-0 flex-1 break-words">{o.rotulo}</span>
                  {selecionado && (
                    <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
                      <Check className="h-4 w-4" aria-hidden="true" />
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
