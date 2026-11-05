type TabelaImpressao = {
  titulo: string;
  subtitulo?: string;
  cabecalhos: string[];
  linhas: string[][];
  totais: string[];
};

/** Dados do cadastro permanecem texto mesmo quando contêm marcação HTML. */
function textoHtml(texto: string): string {
  const entidades: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return texto.replace(/[&<>"']/g, (caractere) => entidades[caractere]!);
}

export function htmlTabelaImpressao(tabela: TabelaImpressao): string {
  const linha = (valores: string[], tag = "td") => `<tr>${valores.map((valor) => `<${tag}>${textoHtml(valor)}</${tag}>`).join("")}</tr>`;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${textoHtml(tabela.titulo)}</title><style>
    body{font:14px Arial,sans-serif;color:#123b60;margin:24px}h1{font-size:20px}p{line-height:1.45}
    table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums}th,td{border:1px solid #ccd6df;padding:8px;text-align:right}
    th:first-child,td:first-child,td:nth-child(2){text-align:left}thead,tfoot{background:#edf2f6}thead{display:table-header-group}tr{break-inside:avoid}
    @page{size:A4 landscape;margin:14mm}@media print{body{margin:0}}
    </style></head><body><h1>${textoHtml(tabela.titulo)}</h1>${tabela.subtitulo ? `<p>${textoHtml(tabela.subtitulo)}</p>` : ""}
    <table><thead>${linha(tabela.cabecalhos, "th")}</thead><tbody>${tabela.linhas.map((valores) => linha(valores)).join("")}</tbody><tfoot>${linha(tabela.totais, "th")}</tfoot></table></body></html>`;
}

/** Abre uma página própria e remove seu acesso à origem antes de inserir o relatório. */
export function imprimirTabela(tabela: TabelaImpressao): boolean {
  // noopener em window.open devolve null mesmo quando a janela abre. A página inicial é
  // about:blank, sob nosso controle; isolamos opener imediatamente, antes de escrever dados.
  const janela = window.open("", "_blank", "width=1100,height=800");
  if (!janela) return false;
  try {
    janela.opener = null;
    janela.addEventListener("load", () => {
      janela.focus();
      janela.print();
    }, { once: true });
    janela.document.open();
    janela.document.write(htmlTabelaImpressao(tabela));
    janela.document.close();
    return true;
  } catch (erro) {
    janela.close();
    throw erro;
  }
}
