import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type Modifier,
  type ScreenReaderInstructions,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Só desloca na vertical: a lista é sempre uma coluna de linhas. */
const soVertical: Modifier = ({ transform }) => ({ ...transform, x: 0 });

const INSTRUCOES: ScreenReaderInstructions = {
  draggable:
    "Para reordenar pelo teclado, use as setas para cima e para baixo para mover a linha uma posição. " +
    "Ou pressione Espaço para levantar a linha, mova com as setas e pressione Espaço de novo para soltar; Escape cancela.",
};

/**
 * Lista de linhas repetíveis (adicionar, remover e reordenar).
 * `colunas` define o grid das linhas (ex.: "@2xl:grid-cols-[1fr_2fr_8rem]").
 * O layout segue a LARGURA DA PRÓPRIA LISTA (container query), não a da tela: abaixo de
 * `@2xl` (42rem) os botões da linha descem para baixo dos campos e os títulos somem, para que
 * os campos usem a largura toda mesmo ao lado do menu fixo (ex.: tablet a 768 px).
 * Use variantes `@xs:`/`@2xl:` em `colunas`, não `sm:`/`md:`.
 *
 * Reordenar: cada linha tem uma alça de arrastar (mouse/toque) que também é um botão de teclado:
 * setas ↑/↓ movem a linha uma posição direto; Espaço levanta, setas movem, Espaço solta, Escape
 * cancela (sensor de teclado do dnd-kit, com anúncios em pt-BR para leitor de tela).
 */
export function RepeatableList<T>({
  itens,
  onChange,
  novo,
  render,
  colunas = "sm:grid-cols-2",
  cabecalhos,
  rotuloAdicionar = "Adicionar linha",
  vazio = "Nenhum item cadastrado.",
  reordenavel = true,
  compacta = false,
}: {
  itens: T[];
  onChange: (itens: T[]) => void;
  novo: () => T;
  render: (item: T, atualizar: (parcial: Partial<T>) => void, indice: number) => ReactNode;
  colunas?: string;
  cabecalhos?: string[];
  rotuloAdicionar?: string;
  vazio?: string;
  reordenavel?: boolean;
  /** Linhas curtas (ex.: nome + valor): botões ficam ao lado a partir de `@md` (28rem). Use `@md:` em `colunas`. */
  compacta?: boolean;
}) {
  const idDnd = useId();
  // Chaves estáveis por linha (os itens não têm id próprio): acompanham remover/mover/adicionar,
  // para que a linha arrastada mantenha o foco e o React não troque os campos de lugar.
  const seq = useRef(0);
  const ids = useRef<string[]>([]);
  const gerarId = () => `linha-${++seq.current}`;
  if (ids.current.length !== itens.length) ids.current = itens.map(gerarId);

  const alcas = useRef(new Map<string, HTMLButtonElement>());
  const focoPendente = useRef<string | null>(null);
  const alvo = useRef(0);
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    const id = focoPendente.current;
    if (!id) return;
    focoPendente.current = null;
    alcas.current.get(id)?.focus();
  }, [itens]);

  const atualizar = (i: number, parcial: Partial<T>) =>
    onChange(itens.map((it, j) => (j === i ? { ...it, ...parcial } : it)));
  const remover = (i: number) => {
    ids.current = ids.current.filter((_, j) => j !== i);
    onChange(itens.filter((_, j) => j !== i));
  };
  const adicionar = () => {
    ids.current = [...ids.current, gerarId()];
    onChange([...itens, novo()]);
  };
  const mover = (de: number, para: number) => {
    if (para < 0 || para >= itens.length || de === para) return;
    ids.current = arrayMove(ids.current, de, para);
    onChange(arrayMove(itens, de, para));
  };

  const posicao = (id: UniqueIdentifier) => ids.current.indexOf(String(id)) + 1;
  const total = itens.length;
  const anuncios: Announcements = {
    onDragStart: ({ active }) => {
      alvo.current = posicao(active.id);
      return `Linha ${alvo.current} levantada. Use as setas para mover, Espaço para soltar e Escape para cancelar.`;
    },
    onDragOver: ({ over }) => {
      if (!over) return "A linha não está sobre a lista.";
      alvo.current = posicao(over.id);
      return `Posição ${alvo.current} de ${total}.`;
    },
    onDragEnd: ({ over }) =>
      over ? `Linha solta na posição ${alvo.current} de ${total}.` : "Linha solta fora da lista; nada mudou.",
    onDragCancel: () => "Movimento cancelado. A linha voltou ao lugar.",
  };

  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const aoSoltar = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    focoPendente.current = String(active.id);
    mover(ids.current.indexOf(String(active.id)), ids.current.indexOf(String(over.id)));
  };

  const moverPorSeta = (i: number, d: -1 | 1) => {
    const para = i + d;
    if (para < 0 || para >= itens.length) {
      setAviso(d < 0 ? "A linha já é a primeira." : "A linha já é a última.");
      return;
    }
    focoPendente.current = ids.current[i] ?? null;
    mover(i, para);
    setAviso(`Linha movida para a posição ${para + 1} de ${itens.length}.`);
  };

  const qtdBotoes = reordenavel ? 2 : 1;

  return (
    <div className="@container space-y-2">
      {itens.length === 0 ? (
        <p className="rounded-md border border-dashed px-4 py-3 text-sm text-muted-foreground">
          {vazio}
        </p>
      ) : (
        <>
          {cabecalhos && (
            <div className={cn("hidden items-center gap-2", compacta ? "@md:flex" : "@2xl:flex")}>
              <div className={cn("grid min-w-0 flex-1 gap-2", colunas)}>
                {cabecalhos.map((c) => (
                  <span key={c} className="text-xs font-medium text-muted-foreground">
                    {c}
                  </span>
                ))}
              </div>
              {/* Espaço invisível do mesmo tamanho dos botões da linha, para alinhar os títulos. */}
              <div className="invisible flex shrink-0 gap-1" aria-hidden="true">
                {Array.from({ length: qtdBotoes }, (_, k) => (
                  <span key={k} className="block h-0 w-9 max-md:w-11 pointer-coarse:w-11" />
                ))}
              </div>
            </div>
          )}
          <DndContext
            id={idDnd}
            sensors={sensores}
            collisionDetection={closestCenter}
            modifiers={[soVertical]}
            onDragEnd={aoSoltar}
            accessibility={{ announcements: anuncios, screenReaderInstructions: INSTRUCOES }}
          >
            <SortableContext items={ids.current} strategy={verticalListSortingStrategy}>
              {itens.map((item, i) => {
                const id = ids.current[i] as string;
                return (
                  <Linha
                    key={id}
                    id={id}
                    indice={i}
                    compacta={compacta}
                    reordenavel={reordenavel}
                    podeMover={itens.length > 1}
                    registrarAlca={(el) => {
                      if (el) alcas.current.set(id, el);
                      else alcas.current.delete(id);
                    }}
                    aoSeta={(d) => moverPorSeta(i, d)}
                    aoRemover={() => remover(i)}
                  >
                    <div className={cn("grid min-w-0 flex-1 gap-2", colunas)}>
                      {render(item, (p) => atualizar(i, p), i)}
                    </div>
                  </Linha>
                );
              })}
            </SortableContext>
          </DndContext>
          <div className="sr-only" aria-live="polite" aria-atomic="true">
            {aviso}
          </div>
        </>
      )}
      <Button type="button" variant="outline" size="sm" onClick={adicionar}>
        <Plus /> {rotuloAdicionar}
      </Button>
    </div>
  );
}

function Linha({
  id,
  indice,
  compacta,
  reordenavel,
  podeMover,
  registrarAlca,
  aoSeta,
  aoRemover,
  children,
}: {
  id: string;
  indice: number;
  compacta: boolean;
  reordenavel: boolean;
  podeMover: boolean;
  registrarAlca: (el: HTMLButtonElement | null) => void;
  aoSeta: (d: -1 | 1) => void;
  aoRemover: () => void;
  children: ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
    active,
  } = useSortable({ id, disabled: !reordenavel || !podeMover });

  const aoTeclar = (ev: KeyboardEvent<HTMLButtonElement>) => {
    // Sem arrasto em andamento, as setas movem direto uma posição.
    if (!active && (ev.key === "ArrowUp" || ev.key === "ArrowDown")) {
      ev.preventDefault();
      aoSeta(ev.key === "ArrowUp" ? -1 : 1);
      return;
    }
    listeners?.["onKeyDown"]?.(ev);
  };

  return (
            <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
              className={cn(
        "relative flex flex-col gap-2 rounded-md border bg-muted/40 p-2",
                compacta
                  ? "@md:flex-row @md:items-start @md:border-0 @md:bg-transparent @md:p-0"
                  : "@2xl:flex-row @2xl:items-start @2xl:border-0 @2xl:bg-transparent @2xl:p-0",
        isDragging && "z-10 bg-card! shadow-lg ring-1 ring-ring/30",
              )}
            >
      {children}
              <div className="flex shrink-0 justify-end gap-1">
                {reordenavel && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
            {...attributes}
            {...listeners}
            ref={(el) => {
              setActivatorNodeRef(el);
              registrarAlca(el);
            }}
            onKeyDown={aoTeclar}
            disabled={!podeMover}
            aria-roledescription="alça para reordenar"
            aria-label={`Reordenar linha ${indice + 1}`}
            className="cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
                    >
            <GripVertical />
                    </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
          onClick={aoRemover}
          aria-label={`Remover linha ${indice + 1}`}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
  );
}
