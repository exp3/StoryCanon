import type { Dictionary } from "@/lib/i18n";
import { LandingSection } from "./section";

/**
 * Uses <details> rather than a JS accordion so every answer is in the served
 * HTML: this section exists as much for crawlers and for the FAQPage JSON-LD
 * (see app/page.tsx) as it does for readers.
 */
export function FaqSection({ t }: { t: Dictionary["landing"]["faq"] }) {
  return (
    <LandingSection id="faq" heading={t.heading} lead={t.lead}>
      <dl className="border-t border-[#d8d4c9]">
        {t.items.map((item) => (
          <details key={item.q} className="group border-b border-[#d8d4c9]">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-[15px] font-semibold text-[#1d1d1b] [&::-webkit-details-marker]:hidden">
              <dt>{item.q}</dt>
              <span
                aria-hidden
                className="shrink-0 text-xl leading-none text-[#46605a] transition-transform group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <dd className="max-w-[760px] pb-5 text-sm leading-7 text-[#5d5d57]">{item.a}</dd>
          </details>
        ))}
      </dl>
    </LandingSection>
  );
}
