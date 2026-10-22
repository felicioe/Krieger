import type { ReactNode } from "react";
import { Info } from "lucide-react";

/** Caixa de explicação em linguagem do escritório (sem termos técnicos), com exemplos. */
function Ajuda({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <aside
      className="rounded-md border bg-secondary/60 p-4 text-sm text-foreground"
      aria-label={titulo}
    >
      <p className="flex items-center gap-2 font-medium text-primary">
        <Info className="size-4 shrink-0" aria-hidden="true" />
        {titulo}
      </p>
      <div className="mt-2 space-y-2 text-xs leading-relaxed">{children}</div>
    </aside>
  );
}

function Cod({ children }: { children: ReactNode }) {
  return (
    <code className="rounded-sm bg-card px-1 py-0.5 font-mono text-[0.7rem] text-foreground ring-1 ring-border">
      {children}
    </code>
  );
}

/** Como escrever os campos "rubrica de dedução" e "rubrica de água" (expressões de busca). */
export function AjudaExpressoes() {
  return (
    <Ajuda titulo="Como preencher os campos de rubrica">
      <p>
        O sistema procura este texto <strong>dentro</strong> do nome de cada despesa do
        demonstrativo, sem diferenciar maiúsculas de minúsculas. Basta escrever um pedaço do nome:{" "}
        <Cod>fundo de caixa p/ obras</Cod> pega “Fundo de caixa p/ obras 2025”.
      </p>
      <ul className="list-disc space-y-1 pl-4">
        <li>
          <Cod>^</Cod> no começo: o nome tem que <strong>começar</strong> assim. <Cod>^[áa]gua</Cod>{" "}
          pega “Água e esgoto”, mas não “Consumo de água”.
        </li>
        <li>
          <Cod>[áa]</Cod>: aceita qualquer uma das letras entre colchetes — útil para nomes escritos
          com ou sem acento.
        </li>
        <li>
          <Cod>|</Cod>: uma coisa <strong>ou</strong> outra. <Cod>água|esgoto</Cod> pega “Água” e
          também “Taxa de esgoto”.
        </li>
        <li>
          Ponto <Cod>.</Cod> vale qualquer letra. Para procurar um ponto de verdade, escreva{" "}
          <Cod>\.</Cod> (ex.: <Cod>manut\.</Cod>).
        </li>
      </ul>
      <p>
        Se o texto tiver um sinal mal colocado (por exemplo um colchete sem fechar), ele é procurado
        ao pé da letra. Estes valores são o padrão das próximas prestações de contas deste
        condomínio; cada prestação pode ajustar os seus.
      </p>
    </Ajuda>
  );
}

/** Como funciona o de-para de rótulos. */
export function AjudaDePara() {
  return (
    <Ajuda titulo="Como funciona o de-para">
      <p>
        Serve para o Previsto × Realizado juntar a mesma despesa quando ela vem com nomes
        diferentes. Quando o nome de uma despesa ou de um grupo é <strong>igual</strong> ao “De”, o
        relatório passa a usar o “Para”.
      </p>
      <p>
        Exemplo: De <Cod>Manut. elevador</Cod> → Para <Cod>Manutenção de elevadores</Cod>.
      </p>
      <p>
        A comparação ignora acentos, maiúsculas e espaços repetidos (“MANUT. ELEVADOR” também
        serve), mas precisa ser o nome inteiro: “Manut.” sozinho não troca “Manut. elevador”. Aqui
        não valem os sinais especiais dos campos de rubrica.
      </p>
    </Ajuda>
  );
}
