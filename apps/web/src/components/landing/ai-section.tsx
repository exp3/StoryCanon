import type { Dictionary } from "@/lib/i18n";
import { LandingCard, LandingSection } from "./section";

/**
 * The "designed for AI integration" pillar. StoryCanon calls no model itself,
 * so every claim here is about the surface ChatGPT writes into: the published
 * schema, the context call, per-command rollback and write provenance.
 */
export function AiSection({ t }: { t: Dictionary["landing"]["ai"] }) {
  return (
    <LandingSection id="ai" heading={t.heading} lead={t.lead} tone="warm">
      <div className="grid gap-4 sm:grid-cols-2">
        {t.points.map((point, i) => (
          <LandingCard key={point.title}>
            <span className="mb-6 block text-xs font-bold tracking-[0.1em] text-[#46605a]">
              {String(i + 1).padStart(2, "0")}
            </span>
            <h3 className="text-[17px] font-semibold leading-snug">{point.title}</h3>
            <p className="mt-2 text-sm leading-6 text-[#5d5d57]">{point.body}</p>
          </LandingCard>
        ))}
      </div>
    </LandingSection>
  );
}
