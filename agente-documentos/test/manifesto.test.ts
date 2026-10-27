import { describe, expect, it } from "vitest";
import { precisaReenviar, type ItemManifesto, type CandidatoLocal } from "../src/manifesto.js";

describe("precisaReenviar", () => {
  const remoto: ItemManifesto[] = [
    { id: "doc-1", caminho_relativo: "convencao.pdf", hash: "hash-a", tamanho: 100 },
    { id: "doc-2", caminho_relativo: "regimento.pdf", hash: "hash-b", tamanho: 200 },
  ];

  it("não reenvia arquivo já indexado com o mesmo hash", () => {
    const candidatos: CandidatoLocal[] = [{ caminhoRelativo: "convencao.pdf", hash: "hash-a", tamanho: 100 }];
    expect(precisaReenviar(candidatos, remoto)).toEqual([]);
  });

  it("reenvia arquivo novo, que ainda não está no manifesto remoto", () => {
    const candidatos: CandidatoLocal[] = [{ caminhoRelativo: "ata-2024.pdf", hash: "hash-c", tamanho: 50 }];
    expect(precisaReenviar(candidatos, remoto)).toEqual(candidatos);
  });

  it("reenvia arquivo existente cujo hash mudou", () => {
    const candidatos: CandidatoLocal[] = [{ caminhoRelativo: "convencao.pdf", hash: "hash-nova", tamanho: 110 }];
    expect(precisaReenviar(candidatos, remoto)).toEqual(candidatos);
  });
});
