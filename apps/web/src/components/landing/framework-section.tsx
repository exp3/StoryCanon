import type { Dictionary } from "@/lib/i18n";
import { LandingSection, LandingSubheading } from "./section";

/**
 * The "we give you a framework" pillar. StoryCanon has no template picker, so
 * the claim is deliberately the opposite one: the schema is fixed, and these
 * are its actual entities, status lifecycles and required fields.
 */
export function FrameworkSection({ t }: { t: Dictionary["landing"]["framework"] }) {
  return (
    <LandingSection id="framework" heading={t.heading} lead={t.lead}>
      <LandingSubheading>{t.entitiesHeading}</LandingSubheading>
      <ul className="grid gap-px border border-[#dedbd2] bg-[#dedbd2] sm:grid-cols-2 lg:grid-cols-3">
        {t.entities.map((entity) => (
          <li key={entity.name} className="bg-[#fbfbf9] p-5">
            <h4 className="text-[15px] font-semibold">{entity.name}</h4>
            <p className="mt-1.5 text-sm leading-6 text-[#5d5d57]">{entity.blurb}</p>
          </li>
        ))}
      </ul>

      <div className="mt-14 grid gap-12 lg:grid-cols-2">
        <div>
          <LandingSubheading>{t.lifecyclesHeading}</LandingSubheading>
          <dl className="border-t border-[#dedbd2]">
            {t.lifecycles.map((lifecycle) => (
              <div key={lifecycle.label} className="border-b border-[#dedbd2] py-4">
                <dt className="text-sm font-semibold">{lifecycle.label}</dt>
                <dd className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[13px] text-[#5d5d57]">
                  {lifecycle.stages.map((stage, i) => (
                    <span key={stage} className="flex items-center gap-2">
                      {i > 0 ? <span aria-hidden className="text-[#a8a49a]">→</span> : null}
                      <span className="border border-[#dedbd2] bg-white px-2 py-0.5">{stage}</span>
                    </span>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div>
          <LandingSubheading>{t.fixedFieldsHeading}</LandingSubheading>
          <dl className="border-t border-[#dedbd2]">
            {t.fixedFields.map((field) => (
              <div key={field.label} className="border-b border-[#dedbd2] py-4">
                <dt className="text-sm font-semibold text-[#46605a]">{field.label}</dt>
                <dd className="mt-1.5 text-sm leading-6 text-[#5d5d57]">{field.body}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <p className="mt-10 max-w-2xl border-l-2 border-[#46605a] pl-4 text-[15px] leading-7 text-[#3f3f39]">
        {t.note}
      </p>
    </LandingSection>
  );
}
