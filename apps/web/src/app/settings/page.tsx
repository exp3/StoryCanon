import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { CopyButton } from "@/components/copy-button";
import { isBillingLive } from "@/lib/billing-config";
import { getDictionary, localeTag } from "@/lib/i18n";
import { PLAN_LIMITS } from "@/server/plan";
import { requireSessionUser } from "@/server/session";
import { listGrants } from "@/server/oauth-store";
import { disconnectOAuthGrant, revokeApiToken, updateLocale } from "./actions";
import { createBillingPortalSession, createCheckoutSession } from "./billing-actions";
import { CreateTokenForm } from "./token-form";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ billing?: string }>;
}) {
  const user = await requireSessionUser("/settings");
  const t = getDictionary(user.locale).settings;
  const { billing } = await searchParams;
  const tokens = await prisma.apiToken.findMany({
    where: { userId: user.id, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });
  const subscription = await prisma.subscription.findFirst({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
  });
  const grants = await listGrants(user.id);
  const plan = subscription && ["ACTIVE", "TRIALING"].includes(subscription.status) ? subscription.plan : "FREE";
  const planLabels = { FREE: t.planFree, PLUS: t.planPlus, PRO: t.planPro };
  const planLabel = planLabels[plan];
  const comparePlans = ["FREE", "PLUS", "PRO"] as const;
  const limitRows: { label: string; key: keyof typeof PLAN_LIMITS.FREE }[] = [
    { label: t.limitProjects, key: "projects" },
    { label: t.limitCharacters, key: "charactersPerProject" },
    { label: t.limitBodyChars, key: "bodyCharsPerProject" },
    { label: t.limitWorldNotes, key: "worldNotesPerProject" },
    { label: t.limitForeshadowings, key: "foreshadowingsPerProject" },
    { label: t.limitMysteries, key: "mysteriesPerProject" },
    { label: t.limitPlotThreads, key: "plotThreadsPerProject" },
    { label: t.limitRevisionTodos, key: "revisionTodosPerProject" },
    { label: t.limitStorySnapshots, key: "storySnapshotsPerProject" },
  ];
  // JSON export is the only non-numeric plan gate (see server/plan.ts and export/page.tsx).
  const jsonExportByPlan: Record<(typeof comparePlans)[number], boolean> = { FREE: false, PLUS: true, PRO: true };
  // Tax-included figures satisfy Japan's 総額表示 and must stay in sync with the
  // 特定商取引法 page (lib/legal-info.ts). Yearly is priced at 10x monthly.
  const planPricing = {
    PLUS: { monthly: { incl: "$9.90", excl: "$9" }, yearly: { incl: "$99", excl: "$90" } },
    PRO: { monthly: { incl: "$52.80", excl: "$48" }, yearly: { incl: "$528", excl: "$480" } },
  } as const;
  const upgradeLabels = { PLUS: t.upgradeToPlus, PRO: t.upgradeToPro };
  // Only offer what would actually be an upgrade: Free sees both, Plus sees Pro.
  // With the billing kill switch off (lib/billing-config.ts) nothing is
  // purchasable, so the forms give way to a "coming soon" notice. The plan
  // comparison table stays visible either way.
  const billingLive = isBillingLive();
  const purchasablePlans = !billingLive
    ? []
    : (["PLUS", "PRO"] as const).filter((p) => (p === "PLUS" ? plan === "FREE" : plan !== "PRO"));
  const statusSuffix =
    subscription?.status === "PAST_DUE" ? ` ${t.statusPastDue}` : subscription?.status === "CANCELED" ? ` ${t.statusCanceled}` : "";

  const headerList = await headers();
  const host = headerList.get("host");
  const protocol = headerList.get("x-forwarded-proto") ?? "https";
  const openApiUrl = `${protocol}://${host}/mcp-openapi.json`;
  const mcpUrl = `${protocol}://${host}/mcp`;

  function formatDate(date: Date | null) {
    if (!date) return null;
    return date.toLocaleDateString(localeTag(user.locale));
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="mb-6 text-3xl font-semibold">{t.title}</h1>

      {billing ? (
        <div className="mb-6 rounded border border-[#dedbd2] bg-[#f7f7f4] p-4 text-sm text-[#4b4b45]">
          {billing === "success" && t.billingSuccess}
          {billing === "cancelled" && t.billingCancelled}
          {billing === "no-customer" && t.billingNoCustomer}
          {billing === "not-configured" && t.billingNotConfigured}
        </div>
      ) : null}

      <section className="mb-8 rounded border border-[#dedbd2] bg-white p-6">
        <h2 className="mb-3 text-xl font-semibold">{t.billingHeading}</h2>
        <p className="mb-4 text-sm leading-6 text-[#4b4b45]">
          {t.currentPlanLabel}: <span className="font-medium text-[#1d1d1b]">{planLabel}</span>
          {statusSuffix}
        </p>
        <h3 className="mb-2 text-sm font-semibold text-[#1d1d1b]">{t.compareHeading}</h3>
        <div className="mb-4 overflow-x-auto rounded border border-[#dedbd2] bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#dedbd2] text-left text-[#4b4b45]">
                <th className="px-4 py-2 font-medium">{t.compareFeatureCol}</th>
                {comparePlans.map((p) => (
                  <th
                    key={p}
                    className={`px-4 py-2 text-right font-medium ${
                      p === plan ? "bg-[#f7f7f4] text-[#1d1d1b]" : ""
                    }`}
                  >
                    {planLabels[p]}
                    {p === plan ? (
                      <span className="ml-1 rounded bg-[#1d1d1b] px-1.5 py-0.5 text-[10px] font-normal text-white">
                        {t.compareCurrentBadge}
                      </span>
                    ) : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {limitRows.map((row) => (
                <tr key={row.key} className="border-b border-[#ece8dd] last:border-0">
                  <td className="px-4 py-2 text-[#4b4b45]">{row.label}</td>
                  {comparePlans.map((p) => (
                    <td
                      key={p}
                      className={`px-4 py-2 text-right tabular-nums ${
                        p === plan ? "bg-[#f7f7f4] font-medium text-[#1d1d1b]" : "text-[#4b4b45]"
                      }`}
                    >
                      {PLAN_LIMITS[p][row.key].toLocaleString(localeTag(user.locale))}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="border-b border-[#ece8dd] last:border-0">
                <td className="px-4 py-2 text-[#4b4b45]">{t.featureJsonExport}</td>
                {comparePlans.map((p) => (
                  <td
                    key={p}
                    className={`px-4 py-2 text-right ${
                      p === plan ? "bg-[#f7f7f4] font-medium text-[#1d1d1b]" : "text-[#4b4b45]"
                    }`}
                  >
                    {jsonExportByPlan[p] ? (
                      <span aria-label={t.featureYes}>✓</span>
                    ) : (
                      <span aria-label={t.featureNo}>—</span>
                    )}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        {!billingLive ? (
          <p className="mb-4 rounded border border-[#dedbd2] bg-[#f7f7f4] p-3 text-sm text-[#4b4b45]">
            {t.billingComingSoon}
          </p>
        ) : null}
        {purchasablePlans.length > 0 ? (
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            {purchasablePlans.map((p) => (
              <form
                key={p}
                action={createCheckoutSession}
                className="rounded border border-[#dedbd2] bg-[#f7f7f4] p-4"
              >
                <input type="hidden" name="plan" value={p} />
                <p className="font-medium text-[#1d1d1b]">{planLabels[p]}</p>
                <fieldset className="mt-3">
                  <legend className="sr-only">{t.intervalLegend}</legend>
                  <div className="flex flex-col gap-2">
                    {(["monthly", "yearly"] as const).map((interval) => (
                      <label
                        key={interval}
                        className="flex cursor-pointer items-start gap-3 rounded border border-[#dedbd2] bg-white p-3 has-[:checked]:border-[#1d1d1b] has-[:checked]:ring-1 has-[:checked]:ring-[#1d1d1b]"
                      >
                        <input
                          className="mt-1 accent-[#1d1d1b]"
                          type="radio"
                          name="interval"
                          value={interval}
                          defaultChecked={interval === "monthly"}
                        />
                        <span className="flex-1">
                          <span className="flex items-baseline justify-between gap-2">
                            <span className="text-sm font-medium text-[#1d1d1b]">
                              {interval === "monthly" ? t.intervalMonthly : t.intervalYearly}
                            </span>
                            {interval === "yearly" ? (
                              <span className="rounded bg-[#e4ede7] px-1.5 py-0.5 text-[10px] text-[#2f4a40]">
                                {t.yearlySavings}
                              </span>
                            ) : null}
                          </span>
                          <span className="mt-1 block text-sm text-[#1d1d1b]">
                            {planPricing[p][interval].incl}
                            <span className="text-[#4b4b45]">
                              {interval === "monthly" ? t.perMonth : t.perYear} {t.taxIncluded}
                            </span>
                          </span>
                          <span className="block text-xs text-[#6b6b63]">
                            {planPricing[p][interval].excl} {t.taxExcluded}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <button
                  className="mt-3 w-full rounded bg-[#1d1d1b] px-4 py-2 text-sm text-white"
                  type="submit"
                >
                  {upgradeLabels[p]}
                </button>
              </form>
            ))}
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          {billingLive && subscription?.stripeCustomerId ? (
            <form action={createBillingPortalSession}>
              <button className="rounded border border-[#dedbd2] px-4 py-2 text-sm text-[#1d1d1b]" type="submit">
                {t.manageBilling}
              </button>
            </form>
          ) : null}
        </div>
      </section>

      <section className="mb-8 rounded border border-[#dedbd2] bg-white p-6">
        <h2 className="mb-3 text-xl font-semibold">{t.languageHeading}</h2>
        <p className="mb-4 text-sm leading-6 text-[#4b4b45]">{t.languageDesc}</p>
        <form className="flex items-center gap-3" action={updateLocale}>
          <select className="rounded border border-[#dedbd2] px-3 py-2 text-sm" name="locale" defaultValue={user.locale}>
            <option value="en">{t.languageEnglish}</option>
            <option value="ja">{t.languageJapanese}</option>
          </select>
          <button className="rounded bg-[#1d1d1b] px-4 py-2 text-sm text-white" type="submit">
            {t.languageSave}
          </button>
        </form>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold">{t.apiTokenHeading}</h2>
        <p className="mb-4 text-sm leading-6 text-[#4b4b45]">{t.apiTokenDesc}</p>
        <CreateTokenForm locale={user.locale} />
      </section>

      <section className="mb-8 rounded border border-[#dedbd2] bg-white p-6">
        <h2 className="mb-3 text-xl font-semibold">{t.connectionHeading}</h2>
        <p className="mb-3 text-sm leading-6 text-[#4b4b45]">{t.connectionIntro}</p>
        <ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-[#4b4b45]">
          <li>{t.step1}</li>
          <li>{t.step2}</li>
          <li>
            {t.step3}
            <span className="mt-1 flex items-center gap-2">
              <code className="block flex-1 break-all rounded bg-[#f7f7f4] p-2 text-xs">{openApiUrl}</code>
              <CopyButton value={openApiUrl} />
            </span>
          </li>
          <li>{t.step4}</li>
          <li>{t.step5}</li>
        </ol>
      </section>

      <section className="mb-8 rounded border border-[#dedbd2] bg-white p-6">
        <h2 className="mb-3 text-xl font-semibold">{t.mcpHeading}</h2>
        <p className="mb-3 text-sm leading-6 text-[#4b4b45]">{t.mcpIntro}</p>
        <span className="mb-3 flex items-center gap-2">
          <code className="block flex-1 break-all rounded bg-[#f7f7f4] p-2 text-xs">{mcpUrl}</code>
          <CopyButton value={mcpUrl} />
        </span>
        <p className="text-sm leading-6 text-[#4b4b45]">{t.mcpAuth}</p>
        <p className="mt-3 text-sm leading-6 text-[#4b4b45]">{t.mcpOAuth}</p>
      </section>

      <section className="mb-8 rounded border border-[#dedbd2] bg-white p-6">
        <h2 className="mb-3 text-xl font-semibold">{t.connectedAppsHeading}</h2>
        <p className="mb-4 text-sm leading-6 text-[#4b4b45]">{t.connectedAppsIntro}</p>
        {grants.length === 0 ? (
          <p className="text-sm text-[#4b4b45]">{t.connectedAppsEmpty}</p>
        ) : (
          <ul className="space-y-3">
            {grants.map((grant) => (
              <li key={grant.id} className="flex items-start justify-between gap-4 rounded border border-[#ece8dd] px-4 py-3">
                <div className="min-w-0">
                  <p className="break-all font-medium text-[#1d1d1b]">{grant.client.clientName || grant.client.clientId}</p>
                  <p className="mt-1 text-xs text-[#666]">
                    {t.connectedAppsConnected} {grant.createdAt.toLocaleString(localeTag(user.locale))}
                  </p>
                  <p className="mt-1 break-all text-xs text-[#666]">
                    {t.connectedAppsScope} {grant.scope}
                  </p>
                </div>
                <form action={disconnectOAuthGrant}>
                  <input type="hidden" name="grantId" value={grant.id} />
                  <button className="shrink-0 rounded border border-red-600 px-3 py-1 text-xs text-red-600" type="submit">
                    {t.disconnect}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold">{t.issuedTokensHeading}</h2>
        {tokens.length === 0 ? (
          <p className="text-sm text-[#4b4b45]">{t.noTokens}</p>
        ) : (
          <ul className="space-y-3">
            {tokens.map((token) => (
              <li
                key={token.id}
                className="flex items-center justify-between rounded border border-[#dedbd2] bg-white p-4"
              >
                <div>
                  <p className="font-medium text-[#1d1d1b]">{token.name}</p>
                  <p className="mt-1 text-xs text-[#4b4b45]">
                    {token.tokenPrefix}… ・{t.createdLabel} {formatDate(token.createdAt)}
                    {token.lastUsedAt ? ` ・${t.lastUsedLabel} ${formatDate(token.lastUsedAt)}` : ""}
                    {token.revokedAt ? ` ・${t.revokedLabel} (${formatDate(token.revokedAt)})` : ""}
                  </p>
                </div>
                {!token.revokedAt ? (
                  <form action={revokeApiToken}>
                    <input type="hidden" name="id" value={token.id} />
                    <button
                      className="rounded border border-red-600 px-3 py-2 text-sm text-red-600"
                      type="submit"
                    >
                      {t.revoke}
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
