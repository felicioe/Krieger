import { Link } from "@/components/app/LinkPermitido";
import { useNavigate } from "@tanstack/react-router";
import {
  Briefcase,
  Building2,
  Calculator,
  CalendarRange,
  ChevronDown,
  DatabaseBackup,
  FileSearch,
  FileSpreadsheet,
  FileText,
  FileUp,
  FolderOpen,
  GitCompareArrows,
  History,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Megaphone,
  ScrollText,
  Trash2,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAbrirRegistroAlteracoes } from "@/components/versoes/RegistroAlteracoes";
import { Marca } from "./Marca";
import { sair, temPermissao, useUsuario } from "@/lib/auth";
import { cn } from "@/lib/utils";

type Item = { titulo: string; to: string; icone: LucideIcon; permissao?: string; apenasAdmin?: boolean; perigoso?: boolean };

/**
 * Menu agrupado por rotina do escritório. Painel e Condomínios ficam soltos no topo (uso diário);
 * os demais em três grupos. Todos os itens continuam a um clique — os grupos são só títulos.
 */
export const GRUPOS_MENU: { titulo: string | null; itens: Item[] }[] = [
  {
    titulo: null,
    itens: [
      { titulo: "Painel", to: "/painel", icone: LayoutDashboard, permissao: "painel.visualizar" },
      { titulo: "Condomínios", to: "/condominios", icone: Building2, permissao: "condominios.visualizar" },
    ],
  },
  {
    titulo: "Financeiro",
    itens: [
      { titulo: "Prestação de contas", to: "/prestacao-contas", icone: FileSpreadsheet, permissao: "prestacao_contas.visualizar" },
      { titulo: "Previsão orçamentária", to: "/previsao-orcamentaria", icone: Calculator, permissao: "previsao_orcamentaria.visualizar" },
      { titulo: "Previsto × Realizado", to: "/previsto-realizado", icone: GitCompareArrows, permissao: "previsto_realizado.visualizar" },
      { titulo: "Relatório mensal", to: "/relatorio-mensal", icone: CalendarRange, permissao: "relatorio_mensal.visualizar" },
      { titulo: "Importador", to: "/importador", icone: FileUp, permissao: "importador.visualizar" },
    ],
  },
  {
    titulo: "Assembleias e documentos",
    itens: [
      { titulo: "Editais", to: "/editais", icone: Megaphone, permissao: "editais.visualizar" },
      { titulo: "Atas", to: "/atas", icone: ScrollText, permissao: "atas.visualizar" },
      { titulo: "Modelos de edital", to: "/modelos", icone: FileText, permissao: "modelos.visualizar" },
      { titulo: "Drive de Documentos", to: "/drive-documentos", icone: FolderOpen, permissao: "drive_documentos.visualizar" },
      { titulo: "Consulta Inteligente", to: "/consulta-documentos", icone: FileSearch, permissao: "consulta_documentos.visualizar" },
    ],
  },
  {
    titulo: "Administração",
    itens: [
      { titulo: "Escritório", to: "/escritorio", icone: Briefcase, permissao: "escritorio.visualizar" },
      { titulo: "Backup", to: "/backup", icone: DatabaseBackup, permissao: "backup.visualizar" },
      { titulo: "Limpeza de Dados", to: "/limpeza-dados", icone: Trash2, apenasAdmin: true, perigoso: true },
    ],
  },
];

/** Lista plana (mesma ordem do menu), para quem precisa percorrer todos os módulos. */
export const ITENS_MENU: Item[] = GRUPOS_MENU.flatMap((g) => g.itens);

const classeItem =
  "flex w-full items-center gap-3 border-l-4 border-transparent px-4 py-2 text-sm max-md:min-h-11 pointer-coarse:min-h-11 text-sidebar-foreground/85 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sidebar-ring";
const classeAtivo = "bg-sidebar-accent border-sidebar-indicator text-sidebar-accent-foreground font-medium";

function ItemMenu({ item, aoNavegar }: { item: Item; aoNavegar?: (() => void) | undefined }) {
  const Icone = item.icone;
  return (
    <Link
      to={item.to}
      onClick={aoNavegar}
      className={cn(
        classeItem,
        item.perigoso && "text-red-400 hover:bg-red-950/60 hover:text-red-300 font-medium",
      )}
      activeProps={{
        className: item.perigoso
          ? "bg-red-950/80 border-red-500 text-red-200 font-semibold"
          : classeAtivo,
      }}
    >
      <Icone className={cn("size-4 shrink-0 opacity-90", item.perigoso && "text-red-400 opacity-100")} />
      <span className="min-w-0 break-words">{item.titulo}</span>
    </Link>
  );
}

function BotaoMenu({ icone: Icone, children, onClick }: { icone: LucideIcon; children: ReactNode; onClick: () => void }) {
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
      <nav className="min-h-28 flex-1 overflow-y-auto overflow-x-hidden pb-2" aria-label="Menu principal">
        {GRUPOS_MENU.map((g, i) => {
          const idTitulo = `${idMenu}-grupo-${i}`;
          return (
            <div key={g.titulo ?? "inicio"} className={cn(i > 0 && "mt-3")}>
              {g.titulo && (
                <p id={idTitulo} className="px-5 pb-1 pt-1 text-[0.6875rem] font-semibold uppercase tracking-wider text-sidebar-muted">
                  {g.titulo}
                </p>
              )}
              <ul aria-labelledby={g.titulo ? idTitulo : undefined}>
                {g.itens
                  .filter((item) => (!item.apenasAdmin || usuario?.perfil === "admin") && (!item.permissao || temPermissao(usuario, item.permissao)))
                  .map((item) => (
                    <li key={item.to}>
                      <ItemMenu item={item} aoNavegar={aoNavegar} />
                    </li>
                  ))}
              </ul>
            </div>
          );
        })}
      </nav>
      <Collapsible open={contaAberta} onOpenChange={setContaAberta} className="shrink-0 border-t border-sidebar-border">
        <CollapsibleTrigger className={cn(classeItem, "py-3 text-left")}>
          <UserRound className="size-4 shrink-0 text-sidebar-muted" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="sr-only">Conta: </span>
            <span className="block text-sm font-medium wrap-anywhere">{usuario?.nome || usuario?.login}</span>
            <span className="block text-xs text-sidebar-muted">
              {usuario?.perfil === "admin" ? "Administrador" : "Usuário"}
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
                <ItemMenu item={{ titulo: "Usuários", to: "/usuarios", icone: Users }} aoNavegar={aoNavegar} />
              </li>
            )}
            <li>
              <ItemMenu item={{ titulo: "Minha senha", to: "/minha-senha", icone: KeyRound }} aoNavegar={aoNavegar} />
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
