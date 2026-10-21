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
import type { ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Marca } from "./Marca";
import { sair, useUsuario } from "@/lib/auth";
import { cn } from "@/lib/utils";

type Item = { titulo: string; to: string; icone: LucideIcon };

export const ITENS_MENU: Item[] = [
  { titulo: "Painel", to: "/painel", icone: LayoutDashboard },
  { titulo: "Condomínios", to: "/condominios", icone: Building2 },
  { titulo: "Prestação de contas", to: "/prestacao-contas", icone: FileSpreadsheet },
  { titulo: "Previsão orçamentária", to: "/previsao-orcamentaria", icone: Calculator },
  { titulo: "Previsto × Realizado", to: "/previsto-realizado", icone: GitCompareArrows },
  { titulo: "Relatório mensal", to: "/relatorio-mensal", icone: CalendarRange },
  { titulo: "Editais", to: "/editais", icone: Megaphone },
  { titulo: "Atas", to: "/atas", icone: ScrollText },
  { titulo: "Modelos de edital", to: "/modelos", icone: FileText },
  { titulo: "Escritório", to: "/escritorio", icone: Briefcase },
  { titulo: "Backup", to: "/backup", icone: DatabaseBackup },
];

const classeItem =
  "flex w-full items-center gap-3 border-l-4 border-transparent px-4 py-2 text-sm text-sidebar-foreground/85 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sidebar-ring";
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
      <span className="truncate">{item.titulo}</span>
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
      <nav className="flex-1 overflow-y-auto py-2" aria-label="Menu principal">
        {ITENS_MENU.map((item) => (
          <ItemMenu key={item.to} item={item} aoNavegar={aoNavegar} />
        ))}
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
