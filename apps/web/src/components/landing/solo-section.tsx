import type { Dictionary } from "@/lib/i18n";
import { LandingCard, LandingSection } from "./section";

/** The "you don't need AI to get value from this" pillar. */
export function SoloSection({ t }: { t: Dictionary["landing"]["solo"] }) {
  return (
    <LandingSection id="solo" heading={t.heading} lead={t.lead}>
      <div className="grid gap-4 sm:grid-cols-2">
        {t.points.map((point) => (
          <LandingCard key={point.title}>
            <h3 className="text-[17px] font-semibold leading-snug">{point.title}</h3>
            <p className="mt-2 text-sm leading-6 text-[#5d5d57]">{point.body}</p>
          </LandingCard>
        ))}
      </div>
    </LandingSection>
  );
}
