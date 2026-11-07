/**
 * Declarações mínimas de `fontkit` para a conferência de larguras dos documentos.
 * O pacote não publica tipos próprios; aqui só o necessário para medir texto
 * (`openSync`, `layout` e `unitsPerEm`). Se algum dia entrar `@types/fontkit`,
 * apagar este arquivo.
 */
declare module "fontkit" {
  export interface Glifo {
    id: number;
    advanceWidth: number;
  }
  export interface Fonte {
    unitsPerEm: number;
    layout(texto: string): { advanceWidth: number };
    glyphForCodePoint(codigo: number): Glifo | null;
  }
  export function openSync(caminho: string): Fonte;
}
