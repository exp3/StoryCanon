"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ReaderScene = {
  id: string;
  title: string;
  body: string;
  chapterTitle: string | null;
};

type Props = {
  projectId: string;
  scenes: ReaderScene[];
  initial: { sceneId: string | null; scrollRatio: number } | null;
  labels: { autoSaved: string; resumed: string; empty: string };
};

const TOP_OFFSET = 96; // px from the viewport top used to decide the "current" scene
const SAVE_DEBOUNCE_MS = 5000; // wait this long after scrolling stops before persisting

export function Reader({ projectId, scenes, initial, labels }: Props) {
  const [progressPct, setProgressPct] = useState(0);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const lastSent = useRef<string>("");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const computePosition = useCallback(() => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>("[data-scene-id]"));
    const scrollY = window.scrollY;
    let sceneId: string | null = sections[0]?.dataset.sceneId ?? null;
    let scrollRatio = 0;
    for (const section of sections) {
      if (section.offsetTop <= scrollY + TOP_OFFSET) {
        sceneId = section.dataset.sceneId ?? null;
        const rel = scrollY + TOP_OFFSET - section.offsetTop;
        scrollRatio = section.offsetHeight > 0 ? Math.min(1, Math.max(0, rel / section.offsetHeight)) : 0;
      } else {
        break;
      }
    }
    return { sceneId, scrollRatio };
  }, []);

  const sendProgress = useCallback(
    (useBeacon: boolean) => {
      const { sceneId, scrollRatio } = computePosition();
      const payload = JSON.stringify({ sceneId, scrollRatio: Math.round(scrollRatio * 1000) / 1000 });
      if (payload === lastSent.current) return;
      lastSent.current = payload;
      const url = `/api/projects/${projectId}/reading-progress`;
      if (useBeacon && typeof navigator.sendBeacon === "function") {
        navigator.sendBeacon(url, new Blob([payload], { type: "application/json" }));
      } else {
        fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: payload, keepalive: true }).catch(
          () => {},
        );
      }
      setSavedAt(new Date());
    },
    [computePosition, projectId],
  );

  // Restore the saved position on mount.
  useEffect(() => {
    if (!initial?.sceneId) return;
    const target = document.querySelector<HTMLElement>(`[data-scene-id="${CSS.escape(initial.sceneId)}"]`);
    if (!target) return;
    const y = target.offsetTop + target.offsetHeight * (initial.scrollRatio ?? 0) - TOP_OFFSET;
    window.scrollTo({ top: Math.max(0, y), behavior: "auto" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const updateBar = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      setProgressPct(scrollable > 0 ? Math.min(100, (window.scrollY / scrollable) * 100) : 0);
    };

    const onScroll = () => {
      updateBar();
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => sendProgress(false), SAVE_DEBOUNCE_MS);
    };

    const onLeave = () => {
      if (document.visibilityState === "hidden") sendProgress(true);
    };
    const onBeforeUnload = () => sendProgress(true);

    updateBar();
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", onLeave);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onLeave);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [sendProgress]);

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-20 h-1 bg-transparent">
        <div className="h-full bg-[#315247] transition-[width] duration-150" style={{ width: `${progressPct}%` }} />
      </div>

      <div className="fixed right-4 top-4 z-20 rounded-full bg-black/70 px-3 py-1 text-xs text-white">
        {initial?.sceneId && savedAt === null ? labels.resumed : savedAt ? labels.autoSaved : null}
      </div>

      <article className="reader-body mx-auto max-w-[42rem] px-6 py-16">
        {scenes.map((scene, index) => (
          <section key={scene.id} data-scene-id={scene.id} className="mb-16 scroll-mt-24">
            {scene.chapterTitle && (index === 0 || scenes[index - 1].chapterTitle !== scene.chapterTitle) ? (
              <h2 className="mb-8 border-b border-[#e2ddcf] pb-2 text-center text-lg font-semibold tracking-wide text-[#4b4b45]">
                {scene.chapterTitle}
              </h2>
            ) : null}
            <h3 className="mb-6 text-center text-xl font-semibold text-[#2a2a26]">{scene.title}</h3>
            <div className="whitespace-pre-wrap text-[1.05rem] leading-[2.1] text-[#2a2a26]">{scene.body}</div>
          </section>
        ))}
      </article>
    </>
  );
}
