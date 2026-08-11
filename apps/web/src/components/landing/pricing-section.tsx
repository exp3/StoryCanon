import { TrackedLink } from "@/components/tracked-link";
import { isBillingLive } from "@/lib/billing-config";
import { localeTag, type Dictionary, type Locale } from "@/lib/i18n";
import { legalInfo } from "@/lib/legal-info";
import { JSON_EXPORT_BY_PLAN, PLAN_LIMITS, type PlanName } from "@/lib/plan-limits";
import { LandingSection, LandingSubheading } from "./section";

// Declared here rather than in the dictionary so the keys keep their literal
// types and can index PLAN_LIMITS. Mirrors `comparePlans` in /settings.
const PLAN_ORDER = ["FREE", "PLUS", "PRO"] as const;

// The four numbers a stranger actually compares, shown on the cards. The rest
// are in the full table below.
const HEADLINE_LIMITS = [
  "projects",
  "charactersPerProject",
  "bodyCharsPerProject",
  "storySnapshotsPerProject",
] as const;

export function PricingSection({
  t,
  settings,
  locale,
}: {
  t: Dictionary["landing"]["pricing"];
  settings: Dictionary["settings"];
  locale: Locale;
}) {
  // Labels come from the /settings dictionary so both surfaces say the same
  // thing about the same limit.
  const limitLabels: Record<keyof typeof PLAN_LIMITS.FREE, string> = {
    projects: settings.limitProjects,
    charactersPerProject: settings.limitCharacters,
    bodyCharsPerProject: settings.limitBodyChars,
    worldNotesPerProject: settings.limitWorldNotes,
    foreshadowingsPerProject: settings.limitForeshadowings,
    mysteriesPerProject: settings.limitMysteries,
    plotThreadsPerProject: settings.limitPlotThreads,
    revisionTodosPerProject: settings.limitRevisionTodos,
    storySnapshotsPerProject: settings.limitStorySnapshots,
  };
  const limitKeys = Object.keys(limitLabels) as (keyof typeof PLAN_LIMITS.FREE)[];

  // Tax-included figures, shared with the 特定商取引法 page so they cannot drift.
  const prices: Record<PlanName, { monthly: string; yearly: string | null }> = {
    FREE: { monthly: "$0", yearly: null },
    PLUS: { monthly: legalInfo.pricing.plusMonthly, yearly: legalInfo.pricing.plusYearly },
    PRO: { monthly: legalInfo.pricing.proMonthly, yearly: legalInfo.pricing.proYearly },
  };

  // Anonymous visitors cannot check out in either state — every CTA goes to
  // /login. The kill switch only decides whether we promise a purchase path.
  const billingLive = isBillingLive();
  const format = (value: number) => value.toLocaleString(localeTag(locale));

  return (
    <LandingSection id="pricing" heading={t.heading} lead={t.lead}>
      {!billingLive ? (
        <p className="mb-8 max-w-3xl border border-[#dedbd2] bg-[#f7f7f4] p-4 text-sm leading-6 text-[#4b4b45]">
          {t.comingSoonNote}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        {PLAN_ORDER.map((plan) => {
          const featured = plan === "PLUS";
          return (
            <article
              key={plan}
              className={`flex flex-col border p-7 ${
                featured
                  ? "border-[#46605a] bg-white shadow-[0_14px_34px_rgba(38,37,31,0.05)]"
                  : "border-[#dedbd2] bg-white/60"
              }`}
            >
              <div className="mb-2 flex min-h-[22px] items-center gap-2">
                <p className="text-[11px] font-bold tracking-[0.08em] text-[#46605a]">
                  {t.plans[plan].tagline}
                </p>
                {!billingLive && plan !== "FREE" ? (
                  <span className="rounded-sm bg-[#e4eee8] px-2 py-0.5 text-[10px] font-bold text-[#315247]">
                    {t.comingSoonBadge}
                  </span>
                ) : null}
              </div>

              <h3 className="text-[23px] font-semibold">{t.plans[plan].label}</h3>
              <p className="mb-1 mt-2 text-[32px] font-bold leading-tight tracking-[-0.04em]">
                {prices[plan].monthly}{" "}
                <small className="text-[13px] font-normal tracking-normal text-[#5d5d57]">
                  {settings.perMonth} {plan === "FREE" ? null : settings.taxIncluded}
                </small>
              </p>
              <p className="mb-6 min-h-[26px] text-xs text-[#5d5d57]">
                {prices[plan].yearly
                  ? `${prices[plan].yearly} ${settings.perYear} · ${settings.yearlySavings}`
                  : null}
              </p>

              <dl className="mb-6 border-t border-[#ece8dd] text-[13px]">
                {HEADLINE_LIMITS.map((key) => (
                  <div key={key} className="flex justify-between gap-3 border-b border-[#ece8dd] py-2">
                    <dt className="text-[#5d5d57]">{limitLabels[key]}</dt>
                    <dd className="tabular-nums font-medium">{format(PLAN_LIMITS[plan][key])}</dd>
                  </div>
                ))}
                <div className="flex justify-between gap-3 border-b border-[#ece8dd] py-2">
                  <dt className="text-[#5d5d57]">{settings.featureJsonExport}</dt>
                  <dd className="font-medium">
                    {JSON_EXPORT_BY_PLAN[plan] ? (
                      <span aria-label={settings.featureYes}>✓</span>
                    ) : (
                      <span aria-label={settings.featureNo}>—</span>
                    )}
                  </dd>
                </div>
              </dl>

              <TrackedLink
                className={`mt-auto inline-flex min-h-[46px] items-center justify-center rounded border border-[#1d1d1b] px-5 text-sm font-bold ${
                  featured ? "bg-[#1d1d1b] text-white" : ""
                }`}
                href="/login"
                event="cta_click"
                location={`pricing:${plan.toLowerCase()}`}
              >
                {plan === "FREE" ? t.freeCta : t.paidCta}
              </TrackedLink>
            </article>
          );
        })}
      </div>

      <p className="mt-4 text-xs text-[#74746e]">{t.taxIncludedNote}</p>

      <div className="mt-14">
        <LandingSubheading>{t.compareHeading}</LandingSubheading>
        <div className="overflow-x-auto border border-[#dedbd2] bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#dedbd2] text-left text-[#4b4b45]">
                <th className="px-4 py-2 font-medium">{settings.compareFeatureCol}</th>
                {PLAN_ORDER.map((plan) => (
                  <th key={plan} className="px-4 py-2 text-right font-medium">
                    {t.plans[plan].label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {limitKeys.map((key) => (
                <tr key={key} className="border-b border-[#ece8dd] last:border-0">
                  <td className="px-4 py-2 text-[#4b4b45]">{limitLabels[key]}</td>
                  {PLAN_ORDER.map((plan) => (
                    <td key={plan} className="px-4 py-2 text-right tabular-nums text-[#4b4b45]">
                      {format(PLAN_LIMITS[plan][key])}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="border-b border-[#ece8dd] last:border-0">
                <td className="px-4 py-2 text-[#4b4b45]">{settings.featureJsonExport}</td>
                {PLAN_ORDER.map((plan) => (
                  <td key={plan} className="px-4 py-2 text-right text-[#4b4b45]">
                    {JSON_EXPORT_BY_PLAN[plan] ? (
                      <span aria-label={settings.featureYes}>✓</span>
                    ) : (
                      <span aria-label={settings.featureNo}>—</span>
                    )}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-[#74746e]">{t.footnote}</p>
      </div>
    </LandingSection>
  );
}
