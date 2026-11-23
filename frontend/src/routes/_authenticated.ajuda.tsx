import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useState, useEffect, type ReactNode } from "react";
import { Search, X, CircleHelp } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { SectionCard } from "@/components/app/SectionCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ARTIGOS, CATEGORIAS, ArtigoAjuda } from "@/lib/ajuda-conteudo";
import { irPara, cn } from "@/lib/utils";
import { cabecalho } from "@/lib/head";

type Busca = { secao?: string; artigo?: string };

export const Route = createFileRoute("/_authenticated/ajuda")({
  head: () =>
    cabecalho(
      "Central de Ajuda",
      "Guias e respostas rápidas para usar o Sistema Krieger."
    ),
  validateSearch: (s: Record<string, unknown>): Busca => {
    const secao = typeof s.secao === "string" ? s.secao : undefined;
    const artigo = typeof s.artigo === "string" ? s.artigo : undefined;
    return { secao, artigo };
  },
  component: Ajuda,
});

function Ajuda() {
  const { secao, artigo } = useSearch({ from: "/_authenticated/ajuda" });
  const [buscaTexto, setBuscaTexto] = useState("");
  const [categoriaSelecionada, setCategoriaSelecionada] = useState<string | null>(
    artigo ? ARTIGOS.find((a) => a.id === artigo)?.categoria ?? null : null
  );

  // Deep-link: ?artigo=...
  useEffect(() => {
    if (!artigo) return;
    const timer = window.setTimeout(() => {
      irPara(artigo);
    }, 50);
    return () => window.clearTimeout(timer);
  }, [artigo]);

  // Deep-link: ?secao=...
  useEffect(() => {
    if (!secao) return;
    const timer = window.setTimeout(() => {
      irPara(secao);
    }, 50);
    return () => window.clearTimeout(timer);
  }, [secao]);

  // Filtro de texto livre
  const artigosFiltrados = ARTIGOS.filter((a) => {
    const matchCategoria = !categoriaSelecionada || a.categoria === categoriaSelecionada;
    if (!matchCategoria) return false;
    if (!buscaTexto.trim()) return true;
    const q = buscaTexto.toLowerCase();
    return (
      a.titulo.toLowerCase().includes(q) ||
      a.resumo.toLowerCase().includes(q) ||
      a.palavrasChave.some((k) => k.toLowerCase().includes(q))
    );
  });

  return (
    <>
      <PageHeader
        titulo="Central de Ajuda"
        descricao="Guias, tutoriais e respostas rápidas para usar o Krieger."
      />

      {/* Busca livre */}
      <div className="mb-6 flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar por tópico, palavra-chave..."
            value={buscaTexto}
            onChange={(e) => setBuscaTexto(e.target.value)}
            className="pl-9"
            aria-label="Buscar na Central de Ajuda"
          />
        </div>
        {buscaTexto && (
          <Button variant="ghost" size="icon" onClick={() => setBuscaTexto("")} aria-label="Limpar busca">
            <X className="size-4" />
          </Button>
        )}
      </div>

      {/* Cards de categorias */}
      {CATEGORIAS.map((cat) => {
        const artigosCat = artigosFiltrados.filter((a) => a.categoria === cat.id);
        if (artigosCat.length === 0) return null;
        const estaSelecionada = categoriaSelecionada === cat.id;
        return (
          <section
            key={cat.id}
            id={cat.id}
            className={cn(
              "mb-6 rounded-lg border bg-card p-4 transition-colors sm:p-5",
              estaSelecionada && "ring-2 ring-primary/40"
            )}
          >
            <div className="mb-3 flex items-center gap-2">
              {cat.icone}
              <div>
                <h2 className="text-sm font-semibold text-foreground">{cat.nome}</h2>
                <p className="text-xs text-muted-foreground">{cat.descricao}</p>
              </div>
            </div>
            <div className="space-y-4">
              {artigosCat.map((artigo) => (
                <div
                  key={artigo.id}
                  id={artigo.id}
                  className="scroll-mt-24"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-medium text-foreground">
                      {artigo.titulo}
                    </h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(
                          `${window.location.origin}/ajuda?artigo=${artigo.id}`
                        );
                        const el = document.getElementById(artigo.id);
                        if (el) {
                          el.setAttribute("data-copiado", "1");
                          setTimeout(() => el.removeAttribute("data-copiado"), 1500);
                        }
                      }}
                      aria-label={`Copiar link para ${artigo.titulo}`}
                    >
                      🔗
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">{artigo.resumo}</p>
                  <p className="mt-2 text-sm text-foreground whitespace-pre-line">
                    {artigo.corpo}
                  </p>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      {artigosFiltrados.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nenhum artigo encontrado. Tente outros termos ou{" "}
          <Button variant="link" size="sm" onClick={() => {
            setBuscaTexto("");
            setCategoriaSelecionada(null);
          }}>
            ver todos
          </Button>.
        </p>
      )}
    </>
  );
}
