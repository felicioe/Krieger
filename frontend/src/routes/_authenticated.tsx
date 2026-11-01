import { Outlet, createFileRoute, redirect, useRouterState } from "@tanstack/react-router";
import { ConteudoMenu } from "@/components/app/AppSidebar";
import { Marca } from "@/components/app/Marca";
import { MenuMovel } from "@/components/app/MenuMovel";
import { Carregando } from "@/components/app/Carregando";
import { ID_CONTEUDO } from "@/components/app/foco";
import { ProvedorRegistroAlteracoes } from "@/components/versoes/RegistroAlteracoes";
import { garantirSessao, temPermissao } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
    const usuario = await garantirSessao();
    if (!usuario) throw redirect({ to: "/login" });
    if (usuario.trocarSenha) throw redirect({ to: "/trocar-senha" });

    const permissoesPorRota: Array<[string, string]> = [
      ["/painel", "painel.visualizar"],
      ["/condominios", "condominios.visualizar"],
      ["/prestacao-contas", "prestacao_contas.visualizar"],
      ["/previsao-orcamentaria", "previsao_orcamentaria.visualizar"],
      ["/previsto-realizado", "previsto_realizado.visualizar"],
      ["/relatorio-mensal", "relatorio_mensal.visualizar"],
      ["/importador", "importador.visualizar"],
      ["/importacoes", "importador.visualizar"],
      ["/importador-condominios", "importador.visualizar"],
      ["/relatorio-final", "prestacao_contas.visualizar"],
      ["/editais", "editais.visualizar"],
      ["/atas", "atas.visualizar"],
      ["/modelos", "modelos.visualizar"],
      ["/drive-documentos", "drive_documentos.visualizar"],
      ["/consulta-documentos", "consulta_documentos.visualizar"],
      ["/escritorio", "escritorio.visualizar"],
      ["/backup", "backup.visualizar"],
      ["/usuarios", "usuarios.visualizar"],
    ];
    const regra = permissoesPorRota.find(([prefixo]) => location.pathname === prefixo || location.pathname.startsWith(prefixo + "/"));
    if (regra && !temPermissao(usuario, regra[1])) {
      const destino = permissoesPorRota.find(([, chave]) => temPermissao(usuario, chave))?.[0] ?? "/minha-senha";
      throw redirect({ to: destino as never });
    }
    return { usuario };
  },
  pendingComponent: () => <Carregando />,
  component: LayoutSistema,
});

function LayoutSistema() {
  const caminho = useRouterState({ select: (s) => s.location.pathname });
  const carregando = useRouterState({ select: (s) => s.status === "pending" });

  return (
    <ProvedorRegistroAlteracoes>
      <div className="min-h-screen bg-background">
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 md:block">
          <ConteudoMenu />
        </aside>

        <div className="md:pl-64">
          <MenuMovel
            caminho={caminho}
            carregando={carregando}
            topo={<Marca compacta />}
            destinoFoco={() => document.getElementById(ID_CONTEUDO)}
          >
            {(aoNavegar, depoisDeFechar) => (
              <ConteudoMenu aoNavegar={aoNavegar} depoisDeFechar={depoisDeFechar} />
            )}
          </MenuMovel>
          <main
            id={ID_CONTEUDO}
            tabIndex={-1}
            className="mx-auto w-full max-w-6xl px-4 py-6 focus:outline-none sm:px-6 lg:px-10 lg:py-8"
          >
            <Outlet />
          </main>
        </div>
      </div>
    </ProvedorRegistroAlteracoes>
  );
}
