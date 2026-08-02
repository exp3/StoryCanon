import Link from "next/link";
import type { Dictionary } from "@/lib/i18n";

export function CtaSection({ t }: { t: Dictionary["landing"]["cta"] }) {
  return (
    <section className="border-t border-[#dedbd2]">
      <div className="mx-auto w-full max-w-6xl px-6 py-16 text-center md:py-24">
        <h2 className="text-3xl font-semibold leading-tight tracking-tight md:text-[2.5rem]">{t.heading}</h2>
        <p className="mx-auto mt-4 max-w-[590px] leading-8 text-[#5d5d57]">{t.lead}</p>
        <Link
          className="mt-8 inline-flex min-h-[46px] items-center justify-center rounded border border-[#1d1d1b] bg-[#1d1d1b] px-6 text-sm font-bold text-white"
          href="/login"
        >
          {t.button}
        </Link>
        <p className="mt-4 text-xs text-[#74746e]">{t.note}</p>
      </div>
    </section>
  );
}
