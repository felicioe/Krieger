/** Metadados padrão de página (título, descrição e Open Graph). */
export function cabecalho(titulo: string, descricao: string) {
  const t = `${titulo} · Sistema Krieger`;
  return {
    meta: [
      { title: t },
      { name: "description", content: descricao },
      { property: "og:title", content: t },
      { property: "og:description", content: descricao },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  };
}
