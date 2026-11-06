/** Id do `<main>` que recebe o foco depois de uma navegação (precisa ter tabIndex={-1}). */
export const ID_CONTEUDO = "conteudo";

/**
 * Depois que a navegação terminar (página nova já carregada), leva o foco ao conteúdo principal —
 * em vez de deixá-lo no `<body>` ou num botão que saiu da tela. Não rouba o foco se a pessoa já
 * estiver num controle visível da página nova.
 */
export function focarConteudoApos(navegacao: Promise<unknown>): void {
  void navegacao
    .catch(() => undefined)
    .then(
      () =>
        new Promise<void>((pronto) =>
          requestAnimationFrame(() => {
            const atual = document.activeElement;
            const solto = !atual || atual === document.body || !atual.isConnected;
            if (solto) document.getElementById(ID_CONTEUDO)?.focus({ preventScroll: true });
            pronto();
          }),
        ),
    );
}
