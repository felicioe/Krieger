import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import {
  ArrowUpRight,
  Building2,
  ChevronRight,
  FileBarChart,
  Gavel,
  LifeBuoy,
  Lightbulb,
  Link2,
  Search,
  SearchX,
  ShieldCheck,
  TriangleAlert,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  ALIASES,
  ARTIGOS,
  CATEGORIAS,
  buscarArtigos,
  type AjudaCategoria,
  type ArtigoAjuda,
  type Bloco,
} from "@/lib/ajuda-conteudo";
import { cabecalho } from "@/lib/head";
import { cn, irPara } from "@/lib/utils";

type Busca = { secao?: string; artigo?: string };

export const Route = createFileRoute("/_authenticated/ajuda")({
  head: () => cabecalho("Central de Ajuda", "Guias e respostas rápidas para usar o Sistema Krieger."),
  validateSearch: (s: Record<string, unknown>): Busca => {
    const secao = typeof s["secao"] === "string" && s["secao"] ? s["secao"] : undefined;
    const artigo = typeof s["artigo"] === "string" && s["artigo"] ? s["artigo"] : undefined;
    return { ...(secao ? { secao } : {}), ...(artigo ? { artigo } : {}) };
  },
  component: Ajuda,
});

const ICONES: Record<AjudaCategoria, ComponentType<{ className?: string }>> = {
  inicio: Building2,
  rateio: Wallet,
  relatorios: FileBarChart,
  assembleias: Gavel,
  administracao: ShieldCheck,
};

const MAIS_ACESSADOS = ["previsao-orcamentaria", "importador", "prestacao-contas", "consolidado-escritorio"];

const porId = (id: string) => ARTIGOS.find((a) => a.id === id);

function Ajuda() {
  const busca = Route.useSearch();
  const alvo = busca.artigo ?? busca.secao;
  const destino = alvo ? (ALIASES[alvo] ?? alvo) : undefined;

  const [texto, setTexto] = useState("");
  const [categoria, setCategoria] = useState<AjudaCategoria | null>(null);

  // Deep-link (?secao= ou ?artigo=): espera o artigo renderizar antes de rolar.
  useEffect(() => {
    if (!destino) return;
    const t = window.setTimeout(() => irPara(destino), 50);
    return () => window.clearTimeout(t);
  }, [destino]);

  const encontrados = useMemo(() => buscarArtigos(texto), [texto]);
  const visiveis = categoria ? encontrados.filter((a) => a.categoria === categoria) : encontrados;
  const filtrando = texto.trim() !== "" || categoria !== null;

  const limpar = () => {
    setTexto("");
    setCategoria(null);
  };

  const abrir = (id: string) => {
    limpar();
    window.setTimeout(() => irPara(id), 0);
  };

  return (
    <div className="space-y-8">
      {/* Cabeçalho com busca */}
      <section className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-5 py-8 sm:px-8 sm:py-10">
        <LifeBuoy
          aria-hidden
          className="pointer-events-none absolute -right-6 -top-6 size-40 text-primary/10 sm:size-52"
        />
        <div className="relative max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary/80">Suporte</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
            Central de Ajuda
          </h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            Guias de cada tela, passo a passo e respostas para as dúvidas mais comuns.
          </p>

          <div className="relative mt-6">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Buscar na ajuda (ex.: reajuste, inadimplência)"
              aria-label="Buscar na Central de Ajuda"
              className="h-12 rounded-lg bg-background pl-12 pr-12 text-base shadow-sm"
            />
            {texto && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setTexto("")}
                aria-label="Limpar busca"
                className="absolute right-1.5 top-1/2 -translate-y-1/2"
              >
                <X className="size-4" />
              </Button>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Mais acessados:</span>
            {MAIS_ACESSADOS.map((id) => {
              const a = porId(id);
              return a ? (
                <button
                  key={id}
                  type="button"
                  onClick={() => abrir(id)}
                  className="rounded-full border bg-background px-3 py-1 text-foreground/85 transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {a.titulo}
                </button>
              ) : null;
            })}
          </div>
        </div>
      </section>

      {/* Categorias */}
      <section aria-label="Categorias">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {CATEGORIAS.map((cat) => {
            const Icone = ICONES[cat.id];
            const ativa = categoria === cat.id;
            const total = encontrados.filter((a) => a.categoria === cat.id).length;
            return (
              <button
                key={cat.id}
                type="button"
                aria-pressed={ativa}
                onClick={() => setCategoria(ativa ? null : cat.id)}
                className={cn(
                  "group flex items-center gap-3 rounded-lg border bg-card p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:flex-col lg:items-start",
                  ativa && "border-primary bg-primary/5 ring-1 ring-primary",
                  total === 0 && "opacity-50",
                )}
              >
                <span
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground",
                    ativa && "bg-primary text-primary-foreground",
                  )}
                >
                  <Icone className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-foreground">{cat.nome}</span>
                  <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{cat.descricao}</span>
                </span>
                <span className="shrink-0 text-xs font-medium text-primary lg:mt-auto">
                  {total} {total === 1 ? "artigo" : "artigos"}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Índice + artigos */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <nav aria-label="Índice da ajuda" className="hidden lg:sticky lg:top-6 lg:block lg:self-start">
          <div className="rounded-lg border bg-card p-3 text-sm shadow-sm">
            {CATEGORIAS.map((cat) => {
              const itens = visiveis.filter((a) => a.categoria === cat.id);
              if (itens.length === 0) return null;
              return (
                <div key={cat.id} className="mb-3 last:mb-0">
                  <p className="px-2 pb-1 text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">
                    {cat.nome}
                  </p>
                  <ul>
                    {itens.map((a) => (
                      <li key={a.id}>
                        <button
                          type="button"
                          onClick={() => irPara(a.id)}
                          className="w-full rounded px-2 py-1.5 text-left text-foreground/85 hover:bg-muted hover:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                          {a.titulo}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </nav>

        <div className="min-w-0 space-y-4">
          {filtrando && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground" aria-live="polite">
              <span>
                {visiveis.length} {visiveis.length === 1 ? "artigo encontrado" : "artigos encontrados"}
              </span>
              <Button variant="ghost" size="sm" onClick={limpar}>
                <X className="size-4" /> Limpar filtros
              </Button>
            </div>
          )}

          {visiveis.map((a) => (
            <CartaoArtigo key={a.id} artigo={a} destacado={a.id === destino} />
          ))}

          {visiveis.length === 0 && (
            <div className="flex flex-col items-center rounded-lg border border-dashed bg-card px-6 py-12 text-center">
              <SearchX className="size-10 text-muted-foreground/60" />
              <p className="mt-3 font-medium text-foreground">Nenhum artigo encontrado</p>
              <p className="mt-1 text-sm text-muted-foreground">Tente outra palavra ou veja todos os guias.</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={limpar}>
                Ver todos os artigos
              </Button>
            </div>
          )}

          <div className="flex flex-col gap-3 rounded-lg border bg-muted/40 p-5 sm:flex-row sm:items-center">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-background text-primary shadow-sm">
              <LifeBuoy className="size-5" />
            </span>
            <div className="text-sm">
              <p className="font-medium text-foreground">Não encontrou o que procurava?</p>
              <p className="text-muted-foreground">
                Fale com o SuperADM do escritório. Ele também libera acesso a telas que não aparecem no seu menu.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CartaoArtigo({ artigo, destacado }: { artigo: ArtigoAjuda; destacado: boolean }) {
  const cat = CATEGORIAS.find((c) => c.id === artigo.categoria);
  const Icone = ICONES[artigo.categoria];

  const copiarLink = async () => {
    const url = `${window.location.origin}${window.location.pathname}#/ajuda?artigo=${artigo.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link do artigo copiado.");
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  };

  return (
    <article
      id={artigo.id}
      aria-labelledby={`${artigo.id}-titulo`}
      className={cn(
        "scroll-mt-24 overflow-hidden rounded-lg border bg-card shadow-sm transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        destacado && "ring-2 ring-primary/40",
      )}
    >
      <header className="flex items-start gap-4 border-b bg-muted/30 px-5 py-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icone className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
            {cat?.nome} <ChevronRight className="size-3" />
          </p>
          <h2 id={`${artigo.id}-titulo`} className="text-base font-semibold text-foreground">
            {artigo.titulo}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{artigo.resumo}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => void copiarLink()}
          aria-label={`Copiar link do artigo ${artigo.titulo}`}
          title="Copiar link"
          className="shrink-0 text-muted-foreground"
        >
          <Link2 className="size-4" />
        </Button>
      </header>

      <div className="space-y-4 px-5 py-5 text-sm leading-relaxed text-foreground/90">
        {artigo.blocos.map((b, i) => (
          <BlocoAjuda key={i} bloco={b} />
        ))}

        {artigo.perguntas && artigo.perguntas.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Perguntas frequentes
            </p>
            <Accordion type="multiple" className="rounded-md border px-4">
              {artigo.perguntas.map((p, i) => (
                <AccordionItem key={i} value={String(i)} className="last:border-b-0">
                  <AccordionTrigger className="text-left text-sm font-medium">{p.pergunta}</AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground">
                    <Rico texto={p.resposta} />
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        )}
      </div>

      {artigo.rota && (
        <footer className="flex justify-end border-t px-5 py-3">
          <Button asChild variant="outline" size="sm">
            <a href={`#${artigo.rota}`}>
              Abrir a tela <ArrowUpRight className="size-4" />
            </a>
          </Button>
        </footer>
      )}
    </article>
  );
}

function BlocoAjuda({ bloco }: { bloco: Bloco }) {
  switch (bloco.tipo) {
    case "p":
      return (
        <p>
          <Rico texto={bloco.texto} />
        </p>
      );
    case "passos":
      return (
        <ol className="space-y-2">
          {bloco.itens.map((item, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                {i + 1}
              </span>
              <span className="pt-0.5">
                <Rico texto={item} />
              </span>
            </li>
          ))}
        </ol>
      );
    case "dica":
      return (
        <Destaque icone={<Lightbulb className="size-4" />} titulo="Dica" className="border-primary/20 bg-primary/5 text-primary">
          <Rico texto={bloco.texto} />
        </Destaque>
      );
    case "atencao":
      return (
        <Destaque
          icone={<TriangleAlert className="size-4" />}
          titulo="Atenção"
          className="border-warning/60 bg-warning/10 text-warning-foreground"
        >
          <Rico texto={bloco.texto} />
        </Destaque>
      );
  }
}

function Destaque({
  icone,
  titulo,
  className,
  children,
}: {
  icone: ReactNode;
  titulo: string;
  className: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex gap-3 rounded-md border px-4 py-3", className)}>
      <span className="mt-0.5 shrink-0">{icone}</span>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider">{titulo}</p>
        <p className="mt-0.5 text-foreground/90">{children}</p>
      </div>
    </div>
  );
}

/** Converte **trecho** em negrito; o resto sai como texto puro (sem HTML). */
function Rico({ texto }: { texto: string }) {
  return (
    <>
      {texto.split(/(\*\*[^*]+\*\*)/g).map((parte, i) =>
        parte.startsWith("**") && parte.endsWith("**") ? (
          <strong key={i} className="font-semibold text-foreground">
            {parte.slice(2, -2)}
          </strong>
        ) : (
          parte
        ),
      )}
    </>
  );
}
