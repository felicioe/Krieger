import { useState } from "react";
import { Search, X, ChevronRight, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useHotkey } from "@/hooks/use-hotkey";

interface Variavel {
  caminho: string;
  descricao: string;
  categoria: string;
  exemplo?: string;
}

const VARIAVEIS: Variavel[] = [
  // ata
  { caminho: "ata.tipo", descricao: "Tipo da assembleia (Ordinária / Extraordinária)", categoria: "Ata" },
  { caminho: "ata.data", descricao: "Data da assembleia (dd/mm/aaaa)", categoria: "Ata" },
  { caminho: "ata.dataExtenso", descricao: "Data por extenso (ex: 16 de dezembro de 2023)", categoria: "Ata" },
  { caminho: "ata.hora", descricao: "Horário de início", categoria: "Ata" },
  { caminho: "ata.local", descricao: "Local da reunião", categoria: "Ata" },
  { caminho: "ata.modalidade", descricao: "Modalidade (Presencial / On-line / Híbrida)", categoria: "Ata" },
  { caminho: "ata.mesa.presidente", descricao: "Nome do presidente da mesa", categoria: "Ata" },
  { caminho: "ata.mesa.secretario", descricao: "Nome do secretário(a)", categoria: "Ata" },
  { caminho: "ata.quorum.unidadesPresentes", descricao: "Unidades presentes (número)", categoria: "Ata" },
  { caminho: "ata.quorum.totalUnidades", descricao: "Total de unidades do condomínio", categoria: "Ata" },
  { caminho: "ata.quorumTexto", descricao: "Frase pronta do quórum (ex: 24 unidades presentes de 120 unidades (20,00%))", categoria: "Ata" },
  { caminho: "ata.percentualQuorum", descricao: "Percentual do quórum (ex: 20,00)", categoria: "Ata" },
  { caminho: "ata.unidades", descricao: "Unidades presentes separadas por vírgula", categoria: "Ata" },
  { caminho: "ata.itens", descricao: "Títulos dos itens da pauta separados por vírgula", categoria: "Ata" },
  { caminho: "ata.itensTexto", descricao: "Itens numerados com discussão e deliberação, um parágrafo cada", categoria: "Ata" },
  { caminho: "ata.encerramento", descricao: "Texto de encerramento da ata", categoria: "Ata" },
  { caminho: "ata.observacoes", descricao: "Observações da ata", categoria: "Ata" },
  // condominio
  { caminho: "condominio.nome", descricao: "Nome do condomínio", categoria: "Condomínio" },
  { caminho: "condominio.nomeRelatorio", descricao: "Nome para relatórios", categoria: "Condomínio" },
  { caminho: "condominio.cnpj", descricao: "CNPJ do condomínio", categoria: "Condomínio" },
  { caminho: "condominio.enderecoEdital", descricao: "Endereço usado em editais", categoria: "Condomínio" },
  { caminho: "condominio.unidades", descricao: "Total de unidades do condomínio", categoria: "Condomínio" },
  // escritorio
  { caminho: "escritorio.nome", descricao: "Nome do escritório", categoria: "Escritório" },
  { caminho: "escritorio.cidade", descricao: "Cidade do escritório", categoria: "Escritório" },
  { caminho: "escritorio.rodape", descricao: "Rodapé do escritório", categoria: "Escritório" },
  { caminho: "escritorio.assinatura", descricao: "Assinatura padrão do escritório", categoria: "Escritório" },
  // global
  { caminho: "cidade", descricao: "Cidade da assembleia", categoria: "Global" },
];

type Agrupadas = Record<string, Variavel[]>;

function agruparPorCategoria(variaveis: Variavel[]): Agrupadas {
  return variaveis.reduce((acc, v) => {
    if (!acc[v.categoria]) acc[v.categoria] = [];
    acc[v.categoria].push(v);
    return acc;
  }, {} as Agrupadas);
}

const CATEGORIAS_ORDEM = ["Ata", "Condomínio", "Escritório", "Global"];

export function PainelVariaveis() {
  const [termo, setTermo] = useState("");
  const [aberto, setAberto] = useState(false);

  const variaveisFiltradas = VARIAVEIS.filter((v) => {
    const busca = termo.toLowerCase();
    return (
      v.caminho.toLowerCase().includes(busca) ||
      v.descricao.toLowerCase().includes(busca) ||
      v.categoria.toLowerCase().includes(busca)
    );
  });

  const agrupar = agruparPorCategoria(variaveisFiltradas) ?? {};

  useHotkey(["Control", "/"], (e) => {
    e.preventDefault();
    setAberto(true);
  });

  const copiarVariavel = (caminho: string) => {
    navigator.clipboard.writeText(`{{${caminho}}}`);
  };

  return (
    <>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            Variáveis (Ctrl+/)
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-3xl max-h-[85vh] p-0">
          <DialogHeader className="p-4 border-b">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg">Variáveis disponíveis para modelos de ata</DialogTitle>
              <Button variant="ghost" size="icon" onClick={() => setAberto(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="relative mt-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Filtrar variáveis (caminho, descrição, categoria)..."
                value={termo}
                onChange={(e) => setTermo(e.target.value)}
                className="pl-9 w-full"
              />
            </div>
          </DialogHeader>
          <ScrollArea className="h-[60vh] p-4">
            {CATEGORIAS_ORDEM.map((cat) => {
              const vars = VARIAVEIS.filter((v) => v.categoria === cat);
              const filtradas = vars.filter((v) =>
                v.caminho.toLowerCase().includes(termo.toLowerCase()) ||
                v.descricao.toLowerCase().includes(termo.toLowerCase())
              );
              if (filtradas.length === 0) return null;
              return (
                <div key={cat} className="mb-6">
                  <h4 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                    {cat}
                  </h4>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {filtradas.map((v) => (
                      <div
                        key={v.caminho}
                        className="flex items-center gap-2 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <code className="font-mono text-sm text-primary bg-muted px-1.5 py-0.5 rounded">
                              {"{{" + v.caminho + "}}"}
                          </code>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{v.descricao}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => navigator.clipboard.writeText(`{{${v.caminho}}}`)}
                          title="Copiar variável"
                          className="h-7 w-7 opacity-50 hover:opacity-100"
                        >
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                          </svg>
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {termo && VARIAVEIS.every((v) =>
              !v.caminho.toLowerCase().includes(termo.toLowerCase()) &&
              !v.descricao.toLowerCase().includes(termo.toLowerCase())
            ) && (
              <p className="text-center text-muted-foreground py-8">
                Nenhuma variável encontrada para "{termo}"
              </p>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
      <div className="fixed bottom-4 right-4 text-xs text-muted-foreground bg-background/80 backdrop-blur px-3 py-1.5 rounded border">
        Ctrl+/ para abrir variáveis
      </div>
    </>
  );
}