import { Link } from "@/components/app/LinkPermitido";
import { PERFIL_ROTULO } from "@/domain/usuario";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Briefcase,
  Building2,
  Calculator,
  CalendarRange,
  ChartColumn,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  TrendingDown,
  Layers,
  DatabaseBackup,
  FileSearch,
  FileSpreadsheet,
  FileText,
  FileUp,
  FolderOpen,
  FolderTree,
  GitCompareArrows,
  History,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Megaphone,
  ScrollText,
  Settings2,
  Trash2,
  UserRound,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAbrirRegistroAlteracoes } from "@/components/versoes/RegistroAlteracoes";
import { Marca } from "./Marca";
import { sair, temPermissao, useUsuario } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Star } from "lucide-react";

type Item = {
  titulo: string;
  to: string;
  icone: LucideIcon;
  permissao?: string;
  apenasAdmin?: boolean;
  perigoso?: boolean;
};

type Grupo = {
  /** `null` = itens soltos no topo, sem nó de árvore (uso diário). */
  titulo: string | null;
  icone?: LucideIcon;
  itens: Item[];
};

/**
 * Menu em árvore, agrupado por rotina do escritório. Painel e Condomínios ficam soltos no topo
 * (uso diário); os demais viram nós que abrem e fecham. O grupo da página atual abre sozinho e a
 * escolha de cada grupo fica guardada no navegador.
 */
export const GRUPOS_MENU: Grupo[] = [
  {
    titulo: null,
    itens: [
      { titulo: "Painel", to: "/painel", icone: LayoutDashboard, permissao: "painel.visualizar" },
      {
        titulo: "Condomínios",
        to: "/condominios",
        icone: Building2,
        permissao: "condominios.visualizar",
      },
    ],
  },
  {
    titulo: "Apuração do rateio",
    icone: Wallet,
    itens: [
      {
        titulo: "Prestação de contas",
        to: "/prestacao-contas",
        icone: FileSpreadsheet,
        permissao: "prestacao_contas.visualizar",
      },
      {
        titulo: "Previsão orçamentária",
        to: "/previsao-orcamentaria",
        icone: Calculator,
        permissao: "previsao_orcamentaria.visualizar",
      },
      {
        titulo: "Previsão para relatórios",
        to: "/previsao-orcamentaria?modo=relatorios",
        icone: Calculator,
        permissao: "previsao_orcamentaria.visualizar",
      },
    ],
  },
  {
    titulo: "Relatórios",
    icone: ChartColumn,
    itens: [
      {
        titulo: "Previsto × Realizado",
        to: "/previsto-realizado",
        icone: GitCompareArrows,
        permissao: "previsto_realizado.visualizar",
      },
      {
        titulo: "Previsto × Realizado mensal",
        to: "/relatorios/orcado-realizado-mensal",
        icone: CalendarRange,
        permissao: "previsto_realizado.visualizar",
      },
      {
        titulo: "Acompanhamento de carga de dados mensais",
        to: "/relatorio-mensal",
        icone: CalendarRange,
        permissao: "relatorio_mensal.visualizar",
      },
      {
        titulo: "Evolução da inadimplência",
        to: "/relatorios/inadimplencia",
        icone: TrendingDown,
        permissao: "relatorio_mensal.visualizar",
      },
      {
        titulo: "Comparativo de despesas",
        to: "/relatorios/comparativo-despesas",
        icone: Layers,
        permissao: "prestacao_contas.visualizar",
      },
    ],
  },
  {
    titulo: "Assembleias e documentos",
    icone: FolderTree,
    itens: [
      { titulo: "Editais", to: "/editais", icone: Megaphone, permissao: "editais.visualizar" },
      { titulo: "Atas", to: "/atas", icone: ScrollText, permissao: "atas.visualizar" },
      {
        titulo: "Drive de Documentos",
        to: "/drive-documentos",
        icone: FolderOpen,
        permissao: "drive_documentos.visualizar",
      },
      {
        titulo: "Consulta Inteligente",
        to: "/consulta-documentos",
        icone: FileSearch,
        permissao: "consulta_documentos.visualizar",
      },
    ],
  },
  {
    // Cadastros e modelos que só o ADM configura. O Usuário vê o item apenas se a matriz de
    // permissões liberar (kr_perfil_permissoes); nenhuma permissão nova é criada aqui.
    titulo: "Cadastro e configuração",
    icone: FileUp,
    itens: [
      {
        titulo: "Importador",
        to: "/importador",
        icone: FileUp,
        permissao: "importador.visualizar",
      },
      {
        titulo: "Modelos de edital",
        to: "/modelos",
        icone: FileText,
        permissao: "modelos.visualizar",
      },
      {
        titulo: "Modelos de ata",
        to: "/modelos-ata",
        icone: ScrollText,
        permissao: "modelos_ata.visualizar",
      },
    ],
  },
  {
    titulo: "Administração",
    icone: Settings2,
    itens: [
      {
        titulo: "Escritório",
        to: "/escritorio",
        icone: Briefcase,
        permissao: "escritorio.visualizar",
      },
      { titulo: "Backup", to: "/backup", icone: DatabaseBackup, permissao: "backup.visualizar" },
      {
        titulo: "Limpeza de Dados",
        to: "/limpeza-dados",
        icone: Trash2,
        apenasAdmin: true,
        perigoso: true,
      },
    ],
  },
];

/** Lista plana (mesma ordem do menu), para quem precisa percorrer todos os módulos. */
export const ITENS_MENU: Item[] = GRUPOS_MENU.flatMap((g) => g.itens);

const classeItem =
  "flex w-full items-center gap-3 border-l-4 border-transparent px-4 py-2 text-sm max-md:min-h-11 pointer-coarse:min-h-11 text-sidebar-foreground/85 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sidebar-ring";
const classeAtivo =
  "bg-sidebar-accent border-sidebar-indicator text-sidebar-accent-foreground font-medium";

/** Chave do navegador com os grupos fechados pela pessoa (só os fechados, para o padrão ser aberto). */
const CHAVE_GRUPOS_FECHADOS = "krieger.menu.grupos-fechados";

/** Chave base para favoritos por usuário. */
const CHAVE_FAVORITOS_BASE = "krieger.favoritos";

function lerFavoritos(userId: string | undefined): string[] {
  if (!userId) return [];
  try {
    const bruto = localStorage.getItem(`${CHAVE_FAVORITOS_BASE}.${userId}`);
    if (!bruto) return [];
    const valor: unknown = JSON.parse(bruto);
    return Array.isArray(valor) ? valor.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function gravarFavoritos(userId: string | undefined, favoritos: string[]) {
  if (!userId) return;
  try {
    localStorage.setItem(`${CHAVE_FAVORITOS_BASE}.${userId}`, JSON.stringify(favoritos));
  } catch {
    // Navegador sem armazenamento: favoritos só não lembram entre visitas.
  }
}

/** Preferência por usuário (#257); sem a do usuário, aproveita a chave antiga, que era única. */
function lerGruposFechados(userId: string | undefined): string[] {
  try {
    const bruto =
      (userId ? localStorage.getItem(`${CHAVE_GRUPOS_FECHADOS}.${userId}`) : null) ??
      localStorage.getItem(CHAVE_GRUPOS_FECHADOS);
    if (!bruto) return [];
    const valor: unknown = JSON.parse(bruto);
    return Array.isArray(valor) ? valor.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function gravarGruposFechados(userId: string | undefined, fechados: string[]) {
  try {
    const chave = userId ? `${CHAVE_GRUPOS_FECHADOS}.${userId}` : CHAVE_GRUPOS_FECHADOS;
    localStorage.setItem(chave, JSON.stringify(fechados));
  } catch {
    // Navegador sem armazenamento (modo privado): a árvore só não lembra entre visitas.
  }
}

/** Grupo que contém a página atual, para abri-lo sozinho ao navegar. */
function grupoDaRota(pathname: string): string | null {
  const grupo = GRUPOS_MENU.find(
    (g) => g.titulo && g.itens.some((item) => item.to.split("?")[0] === pathname),
  );
  return grupo?.titulo ?? null;
}

function itemMenuAtivo(to: string, pathname: string, searchStr: string) {
  const [itemPath, itemSearch = ""] = to.split("?");
  if (itemPath !== pathname) return false;

  const itemParams = new URLSearchParams(itemSearch);
  const currentParams = new URLSearchParams(searchStr);
  if (itemParams.size === 0) {
    return !currentParams.has("modo") || currentParams.get("modo") !== "relatorios";
  }

  return Array.from(itemParams.entries()).every(([key, value]) => currentParams.get(key) === value);
}

function ItemMenu({
  item,
  aoNavegar,
  favorito,
  onToggleFavorito,
}: {
  item: Item;
  aoNavegar?: (() => void) | undefined;
  favorito?: boolean;
  onToggleFavorito?: (to: string) => void;
}) {
  const Icone = item.icone;
  const location = useRouterState({ select: (state) => state.location });
  const ativo = itemMenuAtivo(item.to, location.pathname, location.searchStr);
  const [caminho] = item.to.split("?");
  const modo =
    caminho === "/previsao-orcamentaria"
      ? item.to.includes("modo=relatorios")
        ? ("relatorios" as const)
        : ("rateio" as const)
      : undefined;
  // A seleção de exercício pode acrescentar parâmetros sem trocar o modo da previsão.
  return (
    <div className="group relative flex items-center">
      <Link
        to={caminho!}
        {...(modo ? { search: { modo } } : {})}
        activeOptions={{ exact: !modo, includeSearch: true }}
        onClick={aoNavegar}
        className={cn(
          classeItem,
          "flex-1",
          item.perigoso && "text-red-400 hover:bg-red-950/60 hover:text-red-300 font-medium",
          ativo &&
            (item.perigoso
              ? "bg-red-950/80 border-red-500 text-red-200 font-semibold"
              : classeAtivo),
        )}
      >
        <Icone
          className={cn("size-4 shrink-0 opacity-90", item.perigoso && "text-red-400 opacity-100")}
        />
        <span className="min-w-0 break-words">{item.titulo}</span>
      </Link>
      {onToggleFavorito && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleFavorito(item.to);
          }}
          aria-label={
            favorito
              ? `Remover ${item.titulo} dos favoritos`
              : `Adicionar ${item.titulo} aos favoritos`
          }
          title={favorito ? "Remover dos favoritos" : "Adicionar aos favoritos"}
          className={cn(
            "mr-2 shrink-0 rounded p-1 transition-colors",
            favorito
              ? "text-yellow-400 hover:text-yellow-300"
              : "text-sidebar-muted opacity-0 group-hover:opacity-100 hover:text-yellow-400 focus:opacity-100",
          )}
        >
          <Star className="size-3.5" fill={favorito ? "currentColor" : "none"} />
        </button>
      )}
    </div>
  );
}

function BotaoMenu({
  icone: Icone,
  children,
  onClick,
}: {
  icone: LucideIcon;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className={cn(classeItem, "text-left")}>
      <Icone className="size-4 shrink-0 opacity-90" />
      <span className="min-w-0 break-words">{children}</span>
    </button>
  );
}

/**
 * Conteúdo do menu lateral (usado fixo no desktop e em gaveta no celular).
 * O bloco da conta, embaixo, começa recolhido: um botão com nome, perfil e seta abre/fecha
 * (Radix Collapsible: `aria-expanded`/`aria-controls`; recolhido, as opções nem estão na página,
 * então não recebem foco). Expandir só mostra as opções — não navega nem sai.
 */
export function ConteudoMenu({
  aoNavegar,
  depoisDeFechar,
}: {
  aoNavegar?: () => void;
  /** Na gaveta do celular: fecha a gaveta antes de rodar a ação (ex.: abrir uma janela). */
  depoisDeFechar?: (acao: () => void) => void;
}) {
  const usuario = useUsuario();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const idMenu = useId();
  const abrirRegistro = useAbrirRegistroAlteracoes();
  const [contaAberta, setContaAberta] = useState(false);
  const [fechados, setFechados] = useState<string[]>(() => lerGruposFechados(usuario?.id));
  const [favoritos, setFavoritos] = useState<string[]>(() => lerFavoritos(usuario?.id));
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Recarrega favoritos quando o usuário muda.
  useEffect(() => {
    setFavoritos(lerFavoritos(usuario?.id));
  }, [usuario?.id]);

  const toggleFavorito = useCallback(
    (to: string) => {
      setFavoritos((prev) => {
        const proximo = prev.includes(to) ? prev.filter((t) => t !== to) : [...prev, to];
        gravarFavoritos(usuario?.id, proximo);
        return proximo;
      });
    },
    [usuario?.id],
  );

  // Mesmo filtro dos grupos: um favorito de módulo sem permissão não aparece (#296).
  const itemVisivel = (item: Item) =>
    (!item.apenasAdmin || usuario?.perfil === "admin") &&
    (!item.permissao || temPermissao(usuario, item.permissao));
  const itensFavoritos = ITENS_MENU.filter(
    (item) => favoritos.includes(item.to) && itemVisivel(item),
  );

  // Grupo aberto por causa da página atual. Some quando a pessoa recolhe esse grupo na mão, para ela
  // poder ver o menu recolhido mesmo estando dentro da página; volta a abrir na próxima navegação.
  const [abertoDaRota, setAbertoDaRota] = useState<string | null>(() => grupoDaRota(pathname));
  useEffect(() => {
    setAbertoDaRota(grupoDaRota(pathname));
  }, [pathname]);

  function alternarGrupo(titulo: string, aberto: boolean) {
    if (!aberto && abertoDaRota === titulo) setAbertoDaRota(null);
    setFechados((atual) => {
      const proximo = aberto ? atual.filter((t) => t !== titulo) : [...new Set([...atual, titulo])];
      gravarGruposFechados(usuario?.id, proximo);
      return proximo;
    });
  }

  function alternarTodos(abrir: boolean) {
    const proximo = abrir ? [] : GRUPOS_MENU.flatMap((g) => (g.titulo ? [g.titulo] : []));
    gravarGruposFechados(usuario?.id, proximo);
    setFechados(proximo);
    setAbertoDaRota(null);
  }

  const gruposComTitulo = GRUPOS_MENU.filter((g) => g.titulo);
  const todosAbertos = gruposComTitulo.every((g) => !fechados.includes(g.titulo!));

  const visiveis = (g: Grupo) => g.itens.filter(itemVisivel);

  async function encerrar() {
    aoNavegar?.();
    await sair().catch(() => undefined);
    queryClient.clear();
    navigate({ to: "/login" });
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto overflow-x-hidden bg-sidebar text-sidebar-foreground">
      <div className="shrink-0 px-6 pb-5 pt-7">
        <Marca className="max-w-[min(12rem,100%)]" />
      </div>
      <nav
        className="min-h-28 flex-1 overflow-y-auto overflow-x-hidden pb-2"
        aria-label="Menu principal"
      >
        {/* Seção Favoritos (#296): aparece apenas quando há itens favoritados. */}
        {itensFavoritos.length > 0 && (
          <div className="mb-2 border-b border-sidebar-border/60 pb-2">
            <p className="px-4 py-1.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-sidebar-muted">
              Favoritos
            </p>
            <ul>
              {itensFavoritos.map((item) => (
                <li key={item.to}>
                  <ItemMenu
                    item={item}
                    aoNavegar={aoNavegar}
                    favorito
                    onToggleFavorito={toggleFavorito}
                  />
                </li>
              ))}
            </ul>
          </div>
        )}

        {GRUPOS_MENU.map((g, i) => {
          const itens = visiveis(g);
          if (itens.length === 0) return null;
          const idTitulo = `${idMenu}-grupo-${i}`;

          // Itens soltos no topo (Painel, Condomínios): sem nó de árvore.
          if (!g.titulo) {
            return (
              <ul key={idTitulo} className="pb-1">
                {itens.map((item) => (
                  <li key={item.to}>
                    <ItemMenu
                      item={item}
                      aoNavegar={aoNavegar}
                      favorito={favoritos.includes(item.to)}
                      onToggleFavorito={toggleFavorito}
                    />
                  </li>
                ))}
              </ul>
            );
          }

          const aberto = !fechados.includes(g.titulo) || g.titulo === abertoDaRota;
          const IconeGrupo = g.icone;
          return (
            <Collapsible
              key={g.titulo}
              open={aberto}
              onOpenChange={(v) => alternarGrupo(g.titulo!, v)}
              className="mt-1"
            >
              <CollapsibleTrigger
                className={cn(
                  classeItem,
                  "group gap-2 py-2.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-sidebar-muted hover:text-sidebar-accent-foreground",
                )}
              >
                {IconeGrupo && (
                  <IconeGrupo className="size-4 shrink-0 opacity-80" aria-hidden="true" />
                )}
                <span id={idTitulo} className="min-w-0 flex-1 text-left break-words">
                  {g.titulo}
                </span>
                <ChevronRight
                  aria-hidden="true"
                  className={cn(
                    "size-4 shrink-0 transition-transform duration-200",
                    aberto && "rotate-90",
                  )}
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                {/* Guia vertical: mostra que os itens pertencem ao grupo acima. */}
                <ul
                  aria-labelledby={idTitulo}
                  className="ml-5 border-l border-sidebar-border/70 pl-1"
                >
                  {itens.map((item) => (
                    <li key={item.to}>
                      <ItemMenu
                        item={item}
                        aoNavegar={aoNavegar}
                        favorito={favoritos.includes(item.to)}
                        onToggleFavorito={toggleFavorito}
                      />
                    </li>
                  ))}
                </ul>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
        <div className="mt-2 border-t border-sidebar-border/60 px-2 pt-2">
          <button
            type="button"
            onClick={() => alternarTodos(!todosAbertos)}
            className="flex w-full items-center gap-2 rounded px-3 py-2 text-xs text-sidebar-muted transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sidebar-ring max-md:min-h-11 pointer-coarse:min-h-11"
          >
            {todosAbertos ? (
              <ChevronRight className="size-3.5 shrink-0" aria-hidden="true" />
            ) : (
              <ChevronDown className="size-3.5 shrink-0" aria-hidden="true" />
            )}
            {todosAbertos ? "Recolher todos os grupos" : "Expandir todos os grupos"}
          </button>
        </div>
      </nav>
      <Collapsible
        open={contaAberta}
        onOpenChange={setContaAberta}
        className="shrink-0 border-t border-sidebar-border"
      >
        <CollapsibleTrigger className={cn(classeItem, "py-3 text-left")}>
          <UserRound className="size-4 shrink-0 text-sidebar-muted" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="sr-only">Conta: </span>
            <span className="block text-sm font-medium wrap-anywhere">
              {usuario?.nome || usuario?.login}
            </span>
            <span className="block text-xs text-sidebar-muted">
              {PERFIL_ROTULO[usuario?.perfil ?? "user"] ?? "Usuário"}
            </span>
          </span>
          <ChevronDown
            aria-hidden="true"
            className={cn("size-4 shrink-0 transition-transform", contaAberta && "rotate-180")}
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ul aria-label="Opções da conta" className="pb-2">
            {usuario?.perfil === "admin" && (
              <li>
                <ItemMenu
                  item={{ titulo: "Usuários", to: "/usuarios", icone: Users }}
                  aoNavegar={aoNavegar}
                />
              </li>
            )}
            <li>
              <ItemMenu
                item={{ titulo: "Minha senha", to: "/minha-senha", icone: KeyRound }}
                aoNavegar={aoNavegar}
              />
            </li>
            <li>
              <ItemMenu
                item={{ titulo: "Central de ajuda", to: "/ajuda", icone: CircleHelp }}
                aoNavegar={aoNavegar}
              />
            </li>
            {abrirRegistro && (
              <li>
                <BotaoMenu
                  icone={History}
                  onClick={() => (depoisDeFechar ? depoisDeFechar(abrirRegistro) : abrirRegistro())}
                >
                  Registro de Alterações
                </BotaoMenu>
              </li>
            )}
            <li>
              <BotaoMenu icone={LogOut} onClick={encerrar}>
                Sair
              </BotaoMenu>
            </li>
          </ul>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
