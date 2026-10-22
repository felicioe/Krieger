import { Link, useNavigate } from "@tanstack/react-router";
import {
  Briefcase,
  Building2,
  Calculator,
  CalendarRange,
  DatabaseBackup,
  FileSpreadsheet,
  FileText,
  GitCompareArrows,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Megaphone,
  ScrollText,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useId, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Marca } from "./Marca";
import { sair, useUsuario } from "@/lib/auth";
import { cn } from "@/lib/utils";

type Item = { titulo: string; to: string; icone: LucideIcon };

/**
 * Menu agrupado por rotina do escritório. Painel e Condomínios ficam soltos no topo (uso diário);
 * os demais em três grupos. Todos os itens continuam a um clique — os grupos são só títulos.
 */
export const GRUPOS_MENU: { titulo: string | null; itens: Item[] }[] = [
  {
    titulo: null,
    itens: [
  { titulo: "Painel", to: "/painel", icone: LayoutDashboard },
  { titulo: "Condomínios", to: "/condominios", icone: Building2 },
    ],
  },
  {
    titulo: "Financeiro",
    itens: [
  { titulo: "Prestação de contas", to: "/prestacao-contas", icone: FileSpreadsheet },
  { titulo: "Previsão orçamentária", to: "/previsao-orcamentaria", icone: Calculator },
  { titulo: "Previsto × Realizado", to: "/previsto-realizado", icone: GitCompareArrows },
  { titulo: "Relatório mensal", to: "/relatorio-mensal", icone: CalendarRange },
    ],
  },
  {
    titulo: "Assembleias e documentos",
    itens: [
  { titulo: "Editais", to: "/editais", icone: Megaphone },
  { titulo: "Atas", to: "/atas", icone: ScrollText },
  { titulo: "Modelos de edital", to: "/modelos", icone: FileText },
    ],
  },
  {
    titulo: "Administração",
    itens: [
  { titulo: "Escritório", to: "/escritorio", icone: Briefcase },
  { titulo: "Backup", to: "/backup", icone: DatabaseBackup },
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
      className={classeItem}
      activeProps={{ className: classeAtivo }}
    >
      <Icone className="size-4 shrink-0 opacity-90" />
      <span className="min-w-0 break-words">{item.titulo}</span>
    </Link>
  );
}

function BotaoMenu({ icone: Icone, children, onClick }: { icone: LucideIcon; children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cn(classeItem, "text-left")}>
      <Icone className="size-4 shrink-0 opacity-90" />
      <span>{children}</span>
    </button>
  );
}

/** Conteúdo do menu lateral (usado fixo no desktop e em gaveta no celular). */
export function ConteudoMenu({ aoNavegar }: { aoNavegar?: () => void }) {
  const usuario = useUsuario();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const idMenu = useId();

  async function encerrar() {
    aoNavegar?.();
    await sair().catch(() => undefined);
    queryClient.clear();
    navigate({ to: "/login" });
  }

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="px-6 pb-5 pt-7">
        <Marca className="max-w-[12rem]" />
      </div>
      <nav className="flex-1 overflow-y-auto pb-2" aria-label="Menu principal">
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
                {g.itens.map((item) => (
                  <li key={item.to}>
                    <ItemMenu item={item} aoNavegar={aoNavegar} />
                  </li>
        ))}
              </ul>
            </div>
          );
        })}
      </nav>
      <div className="border-t border-sidebar-border py-3">
        <div className="flex items-center gap-3 px-5 pb-3 pt-1">
          <UserRound className="size-4 shrink-0 text-sidebar-muted" />
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{usuario?.nome || usuario?.login}</div>
            <div className="text-xs text-sidebar-muted">
              {usuario?.perfil === "admin" ? "Administrador" : "Usuário"}
            </div>
          </div>
        </div>
        {usuario?.perfil === "admin" && (
          <ItemMenu item={{ titulo: "Usuários", to: "/usuarios", icone: Users }} aoNavegar={aoNavegar} />
        )}
        <ItemMenu item={{ titulo: "Minha senha", to: "/minha-senha", icone: KeyRound }} aoNavegar={aoNavegar} />
        <BotaoMenu icone={LogOut} onClick={encerrar}>
          Sair
        </BotaoMenu>
      </div>
    </div>
  );
}
