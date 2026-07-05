import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { CopyButton } from "@/components/copy-button";
import { getDictionary, localeTag } from "@/lib/i18n";
import { requireSessionUser } from "@/server/session";
import { revokeApiToken, updateLocale } from "./actions";
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
  const plan = subscription && ["ACTIVE", "TRIALING"].includes(subscription.status) ? subscription.plan : "FREE";
  const planLabel = { FREE: t.planFree, PLUS: t.planPlus, PRO: t.planPro }[plan];
  const statusSuffix =
    subscription?.status === "PAST_DUE" ? ` ${t.statusPastDue}` : subscription?.status === "CANCELED" ? ` ${t.statusCanceled}` : "";

  const headerList = await headers();
  const host = headerList.get("host");
  const protocol = headerList.get("x-forwarded-proto") ?? "https";
  const openApiUrl = `${protocol}://${host}/mcp-openapi.json`;

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
        </div>
      ) : null}

      <section className="mb-8 rounded border border-[#dedbd2] bg-white p-6">
        <h2 className="mb-3 text-xl font-semibold">{t.billingHeading}</h2>
        <p className="mb-4 text-sm leading-6 text-[#4b4b45]">
          {t.currentPlanLabel}: <span className="font-medium text-[#1d1d1b]">{planLabel}</span>
          {statusSuffix}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          {plan !== "PLUS" && plan !== "PRO" ? (
            <form action={createCheckoutSession}>
              <input type="hidden" name="plan" value="PLUS" />
              <button className="rounded bg-[#1d1d1b] px-4 py-2 text-sm text-white" type="submit">
                {t.upgradeToPlus}
              </button>
            </form>
          ) : null}
          {plan !== "PRO" ? (
            <form action={createCheckoutSession}>
              <input type="hidden" name="plan" value="PRO" />
              <button className="rounded bg-[#1d1d1b] px-4 py-2 text-sm text-white" type="submit">
                {t.upgradeToPro}
              </button>
            </form>
          ) : null}
          {subscription?.stripeCustomerId ? (
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
