export interface Trecho {
  paginaInicial: number;
  paginaFinal: number;
  texto: string;
}

/**
 * Agrupa páginas consecutivas em trechos de até `tamanhoAlvoCaracteres`, preservando os
 * números de página de início/fim de cada trecho (é o que vira contexto pro Claude e a
 * referência de fonte mostrada ao usuário). Páginas vazias (comuns em digitalizações com
 * falha de OCR) são ignoradas, não viram trecho em branco.
 */
export function chunkPorPagina(paginas: string[], tamanhoAlvoCaracteres = 4000): Trecho[] {
  const trechos: Trecho[] = [];
  let acumulado: string[] = [];
  let inicio = 0;
  let fim = 0;
  let tamanho = 0;

  const fechar = () => {
    if (acumulado.length === 0) return;
    trechos.push({ paginaInicial: inicio, paginaFinal: fim, texto: acumulado.join("\n\n") });
    acumulado = [];
    tamanho = 0;
  };

  paginas.forEach((textoBruto, idx) => {
    const pagina = idx + 1;
    const texto = textoBruto.trim();
    if (texto === "") return;
    if (acumulado.length === 0) inicio = pagina;
    acumulado.push(texto);
    fim = pagina;
    tamanho += texto.length;
    if (tamanho >= tamanhoAlvoCaracteres) fechar();
  });
  fechar();

  return trechos;
}
