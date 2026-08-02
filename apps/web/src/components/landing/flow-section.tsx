import type { Dictionary } from "@/lib/i18n";
import { LandingSection } from "./section";

export function FlowSection({ t }: { t: Dictionary["landing"]["flow"] }) {
  return (
    <LandingSection id="flow" heading={t.heading} lead={t.lead}>
      <ol className="grid gap-4 md:grid-cols-3">
        {t.steps.map((step, i) => (
          <li key={step.title} className="border border-[#dedbd2] bg-white/60 p-6">
            <span className="mb-5 block text-[13px] font-bold tracking-[0.1em] text-[#46605a]">
              {String(i + 1).padStart(2, "0")}
            </span>
            <h3 className="text-[17px] font-semibold leading-snug">{step.title}</h3>
            <p className="mt-2 text-sm leading-6 text-[#5d5d57]">{step.body}</p>
          </li>
        ))}
      </ol>
    </LandingSection>
  );
}
