import type { Dictionary } from "@/lib/i18n";
import { LandingCard, LandingSection, LandingSubheading } from "./section";

/**
 * The "designed for AI integration" pillar. StoryCanon calls no model itself,
 * so every claim here is about the surface an assistant writes into: the
 * published schema, the context call, per-command rollback and write
 * provenance.
 *
 * The client list below is deliberately the last word of the section, and the
 * trademark note sits directly under it: those product names belong to other
 * companies, and naming them for interoperability is the only reason they are
 * on this page.
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

      <div className="mt-14">
        <LandingSubheading>{t.mcpHeading}</LandingSubheading>
        <p className="max-w-2xl leading-8 text-[#5d5d57]">{t.mcpLead}</p>

        <ul className="mt-8 grid gap-px border border-[#dedbd2] bg-[#dedbd2] md:grid-cols-3">
          {t.clients.map((client) => (
            <li key={client.name} className="bg-[#fbfbf9] p-5">
              <h4 className="text-[15px] font-semibold">{client.name}</h4>
              <p className="mt-1.5 text-sm leading-6 text-[#5d5d57]">{client.body}</p>
            </li>
          ))}
        </ul>

        <p className="mt-6 max-w-2xl border-l-2 border-[#46605a] pl-4 text-[15px] leading-7 text-[#3f3f39]">
          {t.clientsNote}
        </p>

        <div className="mt-10 border-t border-[#dedbd2] pt-6 text-[13px] leading-6 text-[#74746e]">
          {/* A sibling of the MCP subheading, not of the client cards — so it is
              an h3 despite being set smaller than the h4 card titles above. */}
          <h3 className="font-semibold text-[#5d5d57]">{t.trademarksHeading}</h3>
          <ul className="mt-2 max-w-3xl space-y-1">
            {t.trademarks.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="mt-3 max-w-3xl">{t.trademarksNote}</p>
        </div>
      </div>
    </LandingSection>
  );
}
