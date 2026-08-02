import type { Dictionary } from "@/lib/i18n";
import { LandingSection, LandingSubheading } from "./section";

/**
 * Names the reader and the problem before any feature is described: who this
 * is for, and the specific ways their notes fall apart without it.
 */
export function AudienceSection({ t }: { t: Dictionary["landing"]["audience"] }) {
  return (
    <LandingSection id="audience" heading={t.heading} lead={t.lead} tone="warm">
      <LandingSubheading>{t.audienceHeading}</LandingSubheading>
      <div className="grid gap-4 md:grid-cols-3">
        {t.audience.map((item) => (
          <article key={item.title} className="border border-[#dedbd2] bg-white p-6">
            <h3 className="text-[17px] font-semibold leading-snug">{item.title}</h3>
            <p className="mt-2 text-sm leading-6 text-[#5d5d57]">{item.body}</p>
          </article>
        ))}
      </div>

      <div className="mt-14">
        <LandingSubheading>{t.painsHeading}</LandingSubheading>
        <dl className="border-t border-[#d8d4c9]">
          {t.pains.map((pain) => (
            <div
              key={pain.symptom}
              className="grid gap-2 border-b border-[#d8d4c9] py-5 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] md:gap-10"
            >
              <dt className="text-[15px] font-semibold leading-7 text-[#1d1d1b]">「{pain.symptom}」</dt>
              <dd className="text-sm leading-7 text-[#5d5d57]">{pain.answer}</dd>
            </div>
          ))}
        </dl>
      </div>
    </LandingSection>
  );
}
