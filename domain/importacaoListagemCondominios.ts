/**
 * Análise da "Listagem Completa de Condomínios" do Systemar (`lerListagemCondominios`,
 * pdfParser.ts) contra o que já está cadastrado: acha o condomínio existente (reaproveitando
 * `encontrarCondominio`), monta os valores propostos (nome/endereço pela Receita Federal quando
 * houver CNPJ, administração substituída pela do PDF) e calcula só os campos que realmente mudaram
 * — pedido explícito do usuário, que também pediu pra nunca travar o cadastro por dado ruim do PDF
 * (CNPJ ausente/duplicado), só sinalizar com um alerta visível (`Condominio.alertaCadastro`).
 */
import { encontrarCondominio } from "./importacao";
import { condominioPadrao } from "./condominio";
import type { CondominioDaListagem, MembroDaListagem } from "./pdfParser";
import type { Condominio, MembroAdministracao } from "./types";

/** CNPJ da própria Krieger Assessoria Contábil (aparece 2× na listagem, cód. 100/999). */
const CNPJ_KRIEGER = "05248266000171";

const digitos = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

/** Dados já resolvidos da Receita Federal pra um CNPJ — decoupled do formato de `DadosCnpjReceita`
 * (frontend/src/lib/receitaCnpj.ts) pra domain/ não depender de código de frontend. */
export interface DadosReceitaResolvidos {
  razaoSocial: string | null;
  endereco: string | null;
}

export interface CondominioAnalisado {
  linha: CondominioDaListagem;
  existente: Condominio | null;
  /** Pronto pra gravar: `{...existente, ...proposto}` (ou `condominioPadrao()` quando não existe). */
  proposto: Partial<Condominio>;
  /** Nomes dos campos de `proposto` que diferem do `existente` (vazio quando `existente` é null — tudo é novo). */
  camposAlterados: string[];
  /** Nunca bloqueia o cadastro — só avisos visíveis (vira `Condominio.alertaCadastro`). */
  alertas: string[];
  /** TESTE */
  excluidoPorPadrao: boolean;
}

function enderecoDoPdf(l: CondominioDaListagem): string {
  const partes = [
    l.endereco,
    l.bairro,
    l.cidade && l.uf ? `${l.cidade}/${l.uf}` : l.cidade || l.uf,
    l.cep ? `CEP ${l.cep}` : "",
  ];
  return partes.filter((p) => p.trim() !== "").join(" - ");
}

function administracaoDoPdf(membros: MembroDaListagem[]): MembroAdministracao[] {
  return membros.map((m) => ({
    cargo: m.cargo,
    nome: m.nome,
    ...(m.identificacao ? { identificacao: m.identificacao } : {}),
    ...(m.telefone ? { telefone: m.telefone } : {}),
  }));
}

function iguais(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

export function analisarListagemCondominios(
  linhas: CondominioDaListagem[],
  existentes: Condominio[],
  receita: Map<string, DadosReceitaResolvidos>,
): CondominioAnalisado[] {
  const cnpjsDoLote = new Map<string, number>();
  for (const l of linhas) {
    const d = digitos(l.cnpj);
    if (d) cnpjsDoLote.set(d, (cnpjsDoLote.get(d) ?? 0) + 1);
  }

  return linhas.map((linha) => {
    const existente = encontrarCondominio(existentes, { codigo: linha.codigo, cnpj: linha.cnpj, nome: linha.nome });
    const cnpjDigitos = digitos(linha.cnpj);
    const dadosReceita = cnpjDigitos ? receita.get(cnpjDigitos) : undefined;

    const alertas: string[] = [];
    if (!linha.cnpj) {
      alertas.push("Sem CNPJ nesta listagem — casado pelo código.");
    } else if ((cnpjsDoLote.get(cnpjDigitos) ?? 0) > 1) {
      alertas.push("CNPJ também aparece em outro condomínio desta importação — verifique.");
    }

    const proposto: Partial<Condominio> = {
      ...(existente ? {} : condominioPadrao()),
      codigo: linha.codigo,
      nome: dadosReceita?.razaoSocial || linha.nome,
      // Se esta listagem não trouxer CNPJ pra um condomínio já cadastrado, preserva o que já tem
      // (não some um CNPJ bom só porque esta execução do relatório não trouxe o campo).
      cnpj: linha.cnpj ?? existente?.cnpj ?? "",
      enderecoEdital: dadosReceita?.endereco || enderecoDoPdf(linha),
      areaTotalM2: linha.areaTotalM2,
      administracao: administracaoDoPdf(linha.administracao),
      alertaCadastro: alertas.length ? alertas.join(" ") : null,
    };

    const camposAlterados = existente
      ? (Object.keys(proposto) as (keyof Condominio)[]).filter((campo) => !iguais(proposto[campo], existente[campo]))
      : Object.keys(proposto);

    const nomeMaiusculo = linha.nome.trim().toUpperCase();
    const excluidoPorPadrao = nomeMaiusculo.startsWith("TESTE") || cnpjDigitos === CNPJ_KRIEGER;

    return { linha, existente, proposto, camposAlterados, alertas, excluidoPorPadrao };
  });
}
