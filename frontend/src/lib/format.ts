/** Formatação e máscaras no padrão brasileiro. Funções puras. */

const fmt2 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 1234.56 -> "1.234,56" (vazio para null/undefined/NaN). */
export function formatNumeroBR(n: number | null | undefined, casas = 2): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "";
  if (casas === 2) return fmt2.format(n);
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  }).format(n);
}

/** 1234.56 -> "R$ 1.234,56" */
export function formatBRL(n: number | null | undefined): string {
  const s = formatNumeroBR(n);
  return s ? `R$ ${s}` : "—";
}

/**
 * Converte texto digitado em número. Aceita vírgula decimal e ponto de milhar:
 * "1.234,56" -> 1234.56; "1234,5" -> 1234.5; "1234.56" -> 1234.56; "" -> null.
 */
export function parseNumeroBR(texto: string | number | null | undefined): number | null {
  if (texto === null || texto === undefined) return null;
  if (typeof texto === "number") return Number.isFinite(texto) ? texto : null;
  let s = texto.replace(/R\$|\s|%/g, "").trim();
  if (!s) return null;
  if (s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if ((s.match(/\./g) || []).length > 1) {
    s = s.replace(/\./g, "");
  } else if (/^-?\d{1,3}\.\d{3}$/.test(s)) {
    // "1.234" no padrão brasileiro é milhar
    s = s.replace(".", "");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Date -> "dd/mm/aaaa" */
export function dataParaBR(d: Date): string {
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** Date -> "aaaa-mm-dd" no fuso local */
export function dataParaISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Interpreta datas em "dd/mm/aaaa", "aaaa-mm-dd" (ou ISO completo) e "mm/aaaa"
 * (neste caso, o último dia do mês). Retorna null se inválida.
 */
export function parseData(texto: string | null | undefined): Date | null {
  if (!texto) return null;
  const s = String(texto).trim();
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return valida(Number(m[3]), Number(m[2]), Number(m[1]));
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return valida(Number(m[1]), Number(m[2]), Number(m[3]));
  m = s.match(/^(\d{1,2})\/(\d{4})$/);
  if (m) {
    const mes = Number(m[1]);
    if (mes < 1 || mes > 12) return null;
    return new Date(Number(m[2]), mes, 0); // último dia do mês
  }
  return null;
}

function valida(a: number, m: number, d: number): Date | null {
  const dt = new Date(a, m - 1, d);
  if (dt.getFullYear() !== a || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return dt;
}

/** Qualquer formato aceito por parseData -> "dd/mm/aaaa" (ou o texto original). */
export function formatData(texto: string | null | undefined): string {
  if (!texto) return "—";
  const d = parseData(texto);
  return d ? dataParaBR(d) : String(texto);
}

/** ISO completo -> "dd/mm/aaaa hh:mm" */
export function formatDataHora(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(String(iso).replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return String(iso);
  return `${dataParaBR(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Máscara progressiva "dd/mm/aaaa" */
export function mascaraData(texto: string): string {
  const d = texto.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

/** Máscara progressiva "mm/aaaa" */
export function mascaraMesAno(texto: string): string {
  const d = texto.replace(/\D/g, "").slice(0, 6);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}/${d.slice(2)}`;
}

/** Máscara progressiva de horário "hh:mm" */
export function mascaraHora(texto: string): string {
  const d = texto.replace(/\D/g, "").slice(0, 4);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}:${d.slice(2)}`;
}

/** Máscara progressiva de CNPJ "00.000.000/0000-00" */
export function mascaraCNPJ(texto: string): string {
  const d = texto.replace(/\D/g, "").slice(0, 14);
  let r = d.slice(0, 2);
  if (d.length > 2) r += "." + d.slice(2, 5);
  if (d.length > 5) r += "." + d.slice(5, 8);
  if (d.length > 8) r += "/" + d.slice(8, 12);
  if (d.length > 12) r += "-" + d.slice(12, 14);
  return r;
}
