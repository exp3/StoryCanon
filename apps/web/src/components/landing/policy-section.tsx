import type { Dictionary } from "@/lib/i18n";
import { legalInfo } from "@/lib/legal-info";
import { LandingSection } from "./section";

/** The "we keep developing, and feedback shapes it" pillar. */
export function PolicySection({ t }: { t: Dictionary["landing"]["policy"] }) {
  return (
    <LandingSection id="policy" heading={t.heading} lead={t.lead} tone="warm">
      <dl className="grid gap-x-12 gap-y-6 border-t border-[#d8d4c9] sm:grid-cols-2">
        {t.points.map((point) => (
          <div key={point.title} className="border-b border-[#d8d4c9] pb-6 pt-4">
            <dt className="text-[15px] font-semibold text-[#46605a]">{point.title}</dt>
            <dd className="mt-2 text-sm leading-6 text-[#5d5d57]">{point.body}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-10">
        <a
          className="inline-flex min-h-[46px] items-center justify-center rounded border border-[#1d1d1b] bg-white px-5 text-sm font-bold"
          href={legalInfo.contactFormUrl}
          rel="noopener noreferrer"
          target="_blank"
        >
          {t.contactCta}
        </a>
        <p className="mt-3 text-xs text-[#74746e]">{t.contactNote}</p>
      </div>
    </LandingSection>
  );
}
