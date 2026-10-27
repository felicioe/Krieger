import { stat } from "node:fs/promises";
import { carregarConfig } from "./config.js";
import { ClienteApi } from "./api.js";
import { varrerPastaDocumentos } from "./varrer.js";
import { hashArquivo } from "./hash.js";
import { precisaReenviar, type CandidatoLocal } from "./manifesto.js";
import { extrairTexto } from "./extrairTexto.js";
import { chunkPorPagina } from "./chunk.js";

async function indexarCondominio(api: ClienteApi, condoId: string, nome: string, pastaDocumentos: string): Promise<void> {
  console.log(`\n[${nome}] varrendo ${pastaDocumentos}...`);
  const encontrados = await varrerPastaDocumentos(pastaDocumentos);
  console.log(`[${nome}] ${encontrados.length} arquivo(s) de convenção/regimento/ata encontrados pelo nome.`);
  if (encontrados.length === 0) return;

  const comHash = await Promise.all(
    encontrados.map(async (arquivo) => ({ arquivo, ...(await hashArquivo(arquivo.caminhoAbsoluto)) }))
  );
  const candidatos: CandidatoLocal[] = comHash.map((c) => ({
    caminhoRelativo: c.arquivo.caminhoRelativo,
    hash: c.hash,
    tamanho: c.tamanho,
  }));

  const manifestoRemoto = await api.manifesto(condoId);
  const paraReenviar = precisaReenviar(candidatos, manifestoRemoto);
  console.log(`[${nome}] ${paraReenviar.length} arquivo(s) novo(s) ou alterado(s) a indexar.`);

  for (const candidato of paraReenviar) {
    const item = comHash.find((c) => c.arquivo.caminhoRelativo === candidato.caminhoRelativo);
    if (!item) continue;
    const { arquivo } = item;
    try {
      const info = await stat(arquivo.caminhoAbsoluto);
      const { paginas, viaOcr } = await extrairTexto(arquivo.caminhoAbsoluto);
      const trechos = chunkPorPagina(paginas);
      if (trechos.length === 0) {
        console.warn(`[${nome}] ${arquivo.nomeArquivo}: nenhum texto extraído (mesmo após OCR). Pulado.`);
        await api.registrar({
          condoId,
          tipo: arquivo.tipo,
          nomeArquivo: arquivo.nomeArquivo,
          caminhoRelativo: arquivo.caminhoRelativo,
          hash: candidato.hash,
          tamanho: candidato.tamanho,
          mtimeOrigem: info.mtime.toISOString(),
          status: "erro",
          erro: "Nenhum texto extraído (mesmo após OCR).",
          trechos: [],
        });
        continue;
      }
      await api.registrar({
        condoId,
        tipo: arquivo.tipo,
        nomeArquivo: arquivo.nomeArquivo,
        caminhoRelativo: arquivo.caminhoRelativo,
        hash: candidato.hash,
        tamanho: candidato.tamanho,
        paginas: paginas.length,
        mtimeOrigem: info.mtime.toISOString(),
        status: "ok",
        trechos,
      });
      console.log(`[${nome}] ${arquivo.nomeArquivo}: indexado (${paginas.length} página(s)${viaOcr ? ", via OCR" : ""}).`);
    } catch (e) {
      console.error(`[${nome}] ${arquivo.nomeArquivo}: falhou — ${(e as Error).message}`);
    }
  }
}

async function main(): Promise<void> {
  const config = await carregarConfig();
  const api = await ClienteApi.autenticar(config.apiBaseUrl, config.login, config.senha);
  const condominios = await api.listarCondominios();
  const comPasta = condominios.filter((c) => typeof c.pastaDocumentos === "string" && c.pastaDocumentos.trim() !== "");

  if (comPasta.length === 0) {
    console.log("Nenhum condomínio com pastaDocumentos cadastrada. Nada a indexar.");
    return;
  }

  for (const condo of comPasta) {
    try {
      await indexarCondominio(api, condo.id, condo.nome, condo.pastaDocumentos as string);
    } catch (e) {
      console.error(`[${condo.nome}] falhou: ${(e as Error).message}`);
    }
  }
}

main().catch((e) => {
  console.error("Erro fatal:", e);
  process.exitCode = 1;
});
