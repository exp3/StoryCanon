import type { Dictionary } from "@/lib/i18n";
import { TrackedLink } from "@/components/tracked-link";
import { AppMock } from "./app-mock";

export function Hero({ t }: { t: Dictionary["landing"] }) {
  return (
    <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-6 py-16 md:py-24 lg:grid-cols-[1.04fr_0.96fr] lg:gap-16">
      <div>
        <p className="mb-4 text-xs font-bold uppercase tracking-[0.12em] text-[#46605a]">{t.hero.eyebrow}</p>
        <h1 className="max-w-[700px] text-4xl font-semibold leading-[1.25] tracking-[-0.045em] sm:text-5xl lg:text-[3.75rem]">
          {t.hero.titleLine1}
          <br />
          {t.hero.titleLine2}
        </h1>
        <p className="mt-6 max-w-[620px] text-lg leading-9 text-[#5d5d57]">{t.hero.lead}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <TrackedLink
            className="inline-flex min-h-[46px] items-center justify-center rounded border border-[#1d1d1b] bg-[#1d1d1b] px-5 text-sm font-bold text-white"
            href="/login"
            event="cta_click"
            location="hero"
          >
            {t.hero.primaryCta}
          </TrackedLink>
          <a
            className="inline-flex min-h-[46px] items-center justify-center rounded border border-[#1d1d1b] px-5 text-sm font-bold"
            href="#framework"
          >
            {t.hero.secondaryCta}
          </a>
        </div>
        <p className="mt-4 text-xs text-[#74746e]">{t.hero.note}</p>
      </div>
      <div className="flex items-center">
        <AppMock t={t.heroMock} />
      </div>
    </section>
  );
}
