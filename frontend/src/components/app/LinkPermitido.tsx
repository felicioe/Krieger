import { Link as LinkRouter } from "@tanstack/react-router";
import { forwardRef, type ComponentProps } from "react";
import { useUsuario } from "@/lib/auth";
import { podeAcessarRota } from "@/lib/permissoes";

/** Oculta a navegação quando o usuário não pode abrir a tela de destino. */
export const Link = forwardRef<HTMLAnchorElement, ComponentProps<typeof LinkRouter>>(
  (props, ref) => {
    const usuario = useUsuario();
    const parametros = props.params as Record<string, unknown> | undefined;
    if (
      usuario &&
      typeof props.to === "string" &&
      props.to.startsWith("/") &&
      !podeAcessarRota(usuario, props.to)
    )
      return null;
    if (
      usuario &&
      parametros &&
      typeof parametros === "object" &&
      parametros['id'] === "novo"
    ) {
      const rota = typeof props.to === "string" ? props.to : "";
      const modulo = rota.split("/")[1]?.replaceAll("-", "_");
      if (
        modulo &&
        usuario.perfil !== "admin" &&
        !usuario.permissoes.includes("*") &&
        !usuario.permissoes.includes(modulo + ".editar")
      )
        return null;
    }
    return <LinkRouter {...props} ref={ref} />;
  },
) as typeof LinkRouter;
