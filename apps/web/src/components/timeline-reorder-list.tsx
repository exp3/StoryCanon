"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

export type ReorderableItem = { id: string; label: string; card: ReactNode };

type Props = {
  items: ReorderableItem[];
  /** Reports where the card landed relative to its neighbours, not the whole list. */
  action: (eventId: string, afterId: string | null, beforeId: string | null) => void | Promise<void>;
  labels: { handle: string; hint: string; position: string };
};

const DURATION_MS = 180;

// The component is client-side but still server-rendered once; useLayoutEffect
// would warn there.
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Timeline cards, reorderable by dragging their handle.
 *
 * Positions come from `offsetTop` rather than `getBoundingClientRect`, because
 * the swap animation is a transform and would otherwise feed its own motion
 * back into the hit testing. Reordering is FLIP: record the layout tops, let
 * React move the DOM, then animate each card from where it was to where it now
 * is. The dragged card is excluded — it follows the pointer instead.
 */
export function TimelineReorderList({ items, action, labels }: Props) {
  const [order, setOrder] = useState(() => items.map((item) => item.id));
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [pending, startTransition] = useTransition();

  const nodes = useRef(new Map<string, HTMLLIElement>());
  const previousTops = useRef(new Map<string, number>());
  const orderRef = useRef(order);
  const refocusId = useRef<string | null>(null);
  const drag = useRef<{ id: string; pointerId: number; grabOffset: number; translate: number; moved: boolean } | null>(null);

  const serverOrder = items.map((item) => item.id).join(",");

  // Reconciles on every settled render, not just when the server value changes:
  // `moveEvent` deliberately no-ops on a move it cannot apply, and without this
  // the optimistic order would survive a rejected move until a manual reload.
  // Skipped mid-drag and mid-save so the list is never yanked out from under
  // the pointer; `draggingId` and `pending` are dependencies so it runs again
  // the moment either clears.
  useEffect(() => {
    if (pending || draggingId) return;
    const next = serverOrder ? serverOrder.split(",") : [];
    if (next.join(",") === orderRef.current.join(",")) return;
    orderRef.current = next;
    setOrder(next);
  }, [serverOrder, pending, draggingId]);

  function announce(id: string) {
    const index = orderRef.current.indexOf(id);
    const label = items.find((item) => item.id === id)?.label ?? "";
    if (index === -1) return;
    setAnnouncement(
      labels.position
        .replace("{title}", label)
        .replace("{position}", String(index + 1))
        .replace("{total}", String(orderRef.current.length)),
    );
  }

  function recordPositions() {
    previousTops.current.clear();
    for (const [id, node] of nodes.current) previousTops.current.set(id, node.offsetTop);
  }

  function applyOrder(next: string[]) {
    recordPositions();
    orderRef.current = next;
    setOrder(next);
  }

  function moveTo(id: string, index: number) {
    const rest = orderRef.current.filter((item) => item !== id);
    const bounded = Math.max(0, Math.min(index, rest.length));
    const next = [...rest.slice(0, bounded), id, ...rest.slice(bounded)];
    if (next.join(",") === orderRef.current.join(",")) return false;
    applyOrder(next);
    return true;
  }

  /**
   * Sends the moved card's neighbours rather than the full order. The server
   * re-derives the sequence from those, so a save that overlaps the next move
   * cannot apply a permutation built against a list that has already changed.
   */
  function commit(id: string) {
    const index = orderRef.current.indexOf(id);
    if (index === -1) return;
    const afterId = index > 0 ? orderRef.current[index - 1] : null;
    const beforeId = index < orderRef.current.length - 1 ? orderRef.current[index + 1] : null;
    if (!afterId && !beforeId) return;

    startTransition(async () => {
      try {
        await action(id, afterId, beforeId);
      } catch {
        // Drop the optimistic order; the sync effect restores the saved one.
        orderRef.current = [];
      }
    });
  }

  useIsomorphicLayoutEffect(() => {
    const focusId = refocusId.current;
    refocusId.current = null;
    if (focusId) nodes.current.get(focusId)?.querySelector("button")?.focus();

    if (previousTops.current.size === 0) return;
    const reduce = prefersReducedMotion();
    const dragging = drag.current;

    for (const [id, node] of nodes.current) {
      const previousTop = previousTops.current.get(id);
      if (previousTop === undefined) continue;
      const delta = previousTop - node.offsetTop;
      if (delta === 0) continue;

      if (dragging?.id === id) {
        // Keep the dragged card under the pointer now that its slot moved.
        dragging.translate += delta;
        node.style.transition = "none";
        node.style.transform = `translateY(${dragging.translate}px)`;
        continue;
      }

      if (reduce) continue;
      node.style.transition = "none";
      node.style.transform = `translateY(${delta}px)`;
      requestAnimationFrame(() => {
        // The card may have become the dragged one in the meantime.
        if (drag.current?.id === id) return;
        node.style.transition = `transform ${DURATION_MS}ms ease`;
        node.style.transform = "";
      });
    }
    previousTops.current.clear();
  }, [order]);

  // Listening on the window rather than the handle: pointer capture can be
  // refused, and the handle can unmount mid-drag. Either would otherwise leave
  // the drag running with no way to end it.
  useEffect(() => {
    if (!draggingId) return;

    function onPointerMove(event: PointerEvent) {
      const state = drag.current;
      if (!state || event.pointerId !== state.pointerId) return;
      const node = nodes.current.get(state.id);
      if (!node) return;

      // Derived from the untransformed top, so it stays correct across reorders.
      const untransformedTop = node.getBoundingClientRect().top - state.translate;
      state.translate = event.clientY - state.grabOffset - untransformedTop;
      node.style.transition = "none";
      node.style.transform = `translateY(${state.translate}px)`;

      const draggedMiddle = node.offsetTop + state.translate + node.offsetHeight / 2;
      const rest = orderRef.current.filter((id) => id !== state.id);
      let index = rest.findIndex((id) => {
        const other = nodes.current.get(id);
        return other ? draggedMiddle < other.offsetTop + other.offsetHeight / 2 : false;
      });
      if (index === -1) index = rest.length;
      if (moveTo(state.id, index)) state.moved = true;
    }

    function onPointerEnd(event: PointerEvent) {
      const state = drag.current;
      if (!state || event.pointerId !== state.pointerId) return;
      const node = nodes.current.get(state.id);

      drag.current = null;
      setDraggingId(null);

      if (node) {
        node.style.transition = prefersReducedMotion() ? "none" : `transform ${DURATION_MS}ms ease`;
        node.style.transform = "";
      }
      // A click on the handle that moved nothing must not cost a round trip.
      if (state.moved) {
        announce(state.id);
        commit(state.id);
      }
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerEnd);
    window.addEventListener("pointercancel", onPointerEnd);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerEnd);
      window.removeEventListener("pointercancel", onPointerEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draggingId]);

  function onPointerDown(event: ReactPointerEvent<HTMLButtonElement>, id: string) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const node = nodes.current.get(id);
    if (!node) return;

    // Suppresses text selection, which also suppresses the click's focus.
    event.preventDefault();
    event.currentTarget.focus();
    drag.current = { id, pointerId: event.pointerId, grabOffset: event.clientY - node.getBoundingClientRect().top, translate: 0, moved: false };
    node.style.transition = "none";
    setDraggingId(id);
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, id: string) {
    const step = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
    if (step === 0) return;
    event.preventDefault();

    const from = orderRef.current.indexOf(id);
    if (from === -1) return;
    if (!moveTo(id, from + step)) return;

    // React moves the <li> itself, which blurs the handle inside it, so focus is
    // restored after the DOM settles rather than here.
    refocusId.current = id;
    announce(id);
    commit(id);
  }

  const byId = new Map(items.map((item) => [item.id, item]));

  return (
    <>
      {items.length > 1 ? <p className="mb-2 text-xs text-[#666]">{labels.hint}</p> : null}
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
      <ol className={`space-y-3 ${pending ? "opacity-90" : ""}`}>
        {order.map((id) => {
          const item = byId.get(id);
          if (!item) return null;
          const isDragging = draggingId === id;

          return (
            <li
              key={id}
              ref={(node) => {
                if (node) nodes.current.set(id, node);
                else nodes.current.delete(id);
              }}
              className={`rounded border bg-white p-4 ${isDragging ? "relative z-10 shadow-lg" : ""}`}
            >
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  aria-label={`${labels.handle}: ${item.label}`}
                  title={labels.handle}
                  className="mt-1 shrink-0 cursor-grab touch-none rounded border border-[#dedbd2] px-2 py-1 text-xs leading-none text-[#666] active:cursor-grabbing"
                  onPointerDown={(event) => onPointerDown(event, id)}
                  onKeyDown={(event) => onKeyDown(event, id)}
                >
                  ⠿
                </button>
                <div className="min-w-0 flex-1">{item.card}</div>
              </div>
            </li>
          );
        })}
      </ol>
    </>
  );
}
