import type { Dictionary } from "@/lib/i18n";

/**
 * The illustrative project screen in the hero. Deliberately built from markup
 * rather than a screenshot: it stays legible at any width, needs no static
 * asset (the Docker runner stage does not ship `public/`), and translates.
 */
export function AppMock({ t }: { t: Dictionary["landing"]["heroMock"] }) {
  return (
    <div className="w-full border border-[#dedbd2] bg-white shadow-[0_14px_34px_rgba(38,37,31,0.06)]" aria-hidden>
      <div className="flex items-center justify-between border-b border-[#dedbd2] px-5 py-4 text-sm">
        <strong>{t.projectTitle}</strong>
        <span className="rounded-sm bg-[#e4eee8] px-2 py-0.5 text-[11px] font-bold text-[#315247]">
          {t.savedBadge}
        </span>
      </div>
      <div className="px-5 py-5">
        <div className="flex gap-3 overflow-hidden whitespace-nowrap border-b border-[#dedbd2] pb-3 text-xs text-[#5d5d57]">
          {t.tabs.map((tab, i) => (
            <span key={tab} className={i === 0 ? "font-bold text-[#1d1d1b]" : ""}>
              {tab}
            </span>
          ))}
        </div>

        <div className="mt-4 border border-[#ebe9e2] bg-[#fafaf8] p-4">
          <div className="mb-3 flex justify-between text-[13px] font-bold">
            <span>{t.stateLabel}</span>
            <span>{t.stateDate}</span>
          </div>
          {t.stateLines.map((line) => (
            <p key={line} className="mb-2 text-xs leading-relaxed text-[#5d5d57] last:mb-0">
              {line}
            </p>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {t.stats.map((stat) => (
            <div key={stat.label} className="border border-[#dedbd2] p-2.5">
              <span className="block text-[10px] text-[#5d5d57]">{stat.label}</span>
              <strong className="text-xl">{stat.value}</strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
