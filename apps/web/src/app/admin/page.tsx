import { prisma } from "@/lib/prisma";
import { getDictionary, localeTag } from "@/lib/i18n";
import { requireAdminUser } from "@/server/admin";
import { grantPlan, revokePlan } from "./actions";

const plans = ["FREE", "PLUS", "PRO"];
const statuses = ["ACTIVE", "TRIALING", "PAST_DUE", "CANCELED", "INCOMPLETE"];

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; email?: string; granted?: string }>;
}) {
  const user = await requireAdminUser();
  const t = getDictionary(user.locale).admin;
  const { error, email, granted } = await searchParams;

  // Counted from the database rather than PostHog: analytics only loads after
  // the cookie banner is accepted, so it systematically undercounts exactly the
  // early-funnel users we are trying to see.
  const [userCount, onboardedCount, withProjectCount, withSceneCount, tokenIssuedCount, tokenUsedCount, oauthGrantedCount, mcpActiveCount] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { onboardingCompletedAt: { not: null } } }),
      prisma.user.count({ where: { projects: { some: { deletedAt: null } } } }),
      prisma.user.count({
        where: { projects: { some: { deletedAt: null, scenes: { some: { deletedAt: null } } } } },
      }),
      prisma.user.count({ where: { apiTokens: { some: { deletedAt: null } } } }),
      prisma.user.count({ where: { apiTokens: { some: { deletedAt: null, lastUsedAt: { not: null } } } } }),
      prisma.user.count({ where: { oauthGrants: { some: {} } } }),
      prisma.user.count({
        where: {
          OR: [
            { apiTokens: { some: { deletedAt: null, lastUsedAt: { not: null } } } },
            { oauthGrants: { some: {} } },
          ],
        },
      }),
    ]);

  const funnel = [
    { label: t.stageSignedUp, value: userCount },
    { label: t.stageOnboarded, value: onboardedCount },
    { label: t.stageHasProject, value: withProjectCount },
    { label: t.stageHasScene, value: withSceneCount },
  ];

  const mcpRows = [
    { label: t.mcpTokenIssued, value: tokenIssuedCount },
    { label: t.mcpTokenUsed, value: tokenUsedCount, indent: true },
    { label: t.mcpTokenUnused, value: tokenIssuedCount - tokenUsedCount, indent: true },
    { label: t.mcpOAuthGranted, value: oauthGrantedCount },
    { label: t.mcpAnyActive, value: mcpActiveCount, emphasis: true },
  ];

  function percent(value: number, of: number) {
    if (of === 0) return "—";
    return `${Math.round((value / of) * 100)}%`;
  }

  const subscriptions = await prisma.subscription.findMany({
    where: {
      OR: [{ plan: { in: ["PLUS", "PRO"] } }, { status: { in: ["ACTIVE", "TRIALING"] } }],
    },
    orderBy: { updatedAt: "desc" },
    include: { user: { select: { email: true } } },
  });

  const logs = await prisma.auditLog.findMany({
    where: { action: { in: ["grant-plan", "revoke-plan"] } },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { user: { select: { email: true } } },
  });

  function formatDate(date: Date) {
    return date.toLocaleString(localeTag(user.locale));
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="mb-2 text-3xl font-semibold">{t.title}</h1>
      <p className="mb-6 text-sm leading-6 text-[#4b4b45]">{t.description}</p>

      {granted ? (
        <div className="mb-6 rounded border border-[#dedbd2] bg-[#f0f5f2] p-4 text-sm text-[#315247]">
          {t.granted} {granted}
        </div>
      ) : null}
      {error === "user-not-found" ? (
        <div className="mb-6 rounded border border-red-300 bg-red-50 p-4 text-sm text-red-700">
          {t.userNotFound}
          {email ? <span className="ml-1 font-medium">{email}</span> : null}
        </div>
      ) : null}

      <section className="mb-8 rounded border border-[#dedbd2] bg-white p-6">
        <h2 className="mb-1 text-xl font-semibold">{t.funnelHeading}</h2>
        <p className="mb-4 text-sm leading-6 text-[#666]">{t.funnelNote}</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#dedbd2] text-left text-[#4b4b45]">
                <th className="py-2 pr-4 font-medium">{t.funnelStage}</th>
                <th className="px-4 py-2 text-right font-medium">{t.funnelUsers}</th>
                <th className="px-4 py-2 text-right font-medium">{t.funnelOfTotal}</th>
                <th className="py-2 pl-4 text-right font-medium">{t.funnelOfPrev}</th>
              </tr>
            </thead>
            <tbody>
              {funnel.map((stage, i) => (
                <tr key={stage.label} className="border-b border-[#ece8dd] last:border-0">
                  <td className="py-2 pr-4">{stage.label}</td>
                  <td className="px-4 py-2 text-right font-medium">
                    {stage.value.toLocaleString(localeTag(user.locale))}
                  </td>
                  <td className="px-4 py-2 text-right text-[#666]">{percent(stage.value, userCount)}</td>
                  <td className="py-2 pl-4 text-right text-[#666]">
                    {i === 0 ? "—" : percent(stage.value, funnel[i - 1].value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-8 rounded border border-[#dedbd2] bg-white p-6">
        <h2 className="mb-1 text-xl font-semibold">{t.mcpHeading}</h2>
        <p className="mb-4 text-sm leading-6 text-[#666]">{t.mcpNote}</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#dedbd2] text-left text-[#4b4b45]">
                <th className="py-2 pr-4 font-medium">{t.funnelStage}</th>
                <th className="px-4 py-2 text-right font-medium">{t.funnelUsers}</th>
                <th className="py-2 pl-4 text-right font-medium">{t.funnelOfTotal}</th>
              </tr>
            </thead>
            <tbody>
              {mcpRows.map((row) => (
                <tr key={row.label} className="border-b border-[#ece8dd] last:border-0">
                  <td className={`py-2 pr-4 ${row.indent ? "pl-4 text-[#666]" : ""}`}>{row.label}</td>
                  <td className={`px-4 py-2 text-right ${row.emphasis ? "font-semibold" : "font-medium"}`}>
                    {row.value.toLocaleString(localeTag(user.locale))}
                  </td>
                  <td className="py-2 pl-4 text-right text-[#666]">{percent(row.value, userCount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-8 rounded border border-[#dedbd2] bg-white p-6">
        <h2 className="mb-3 text-xl font-semibold">{t.grantHeading}</h2>
        <form className="grid gap-4 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end" action={grantPlan}>
          <label className="block">
            <span className="text-sm font-medium">{t.emailLabel}</span>
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              type="email"
              name="email"
              defaultValue={email ?? ""}
              required
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">{t.planLabel}</span>
            <select className="mt-1 w-full rounded border px-3 py-2" name="plan" defaultValue="PLUS">
              {plans.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium">{t.statusLabel}</span>
            <select className="mt-1 w-full rounded border px-3 py-2" name="status" defaultValue="ACTIVE">
              {statuses.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <button className="rounded bg-[#1d1d1b] px-4 py-2 text-sm text-white" type="submit">
            {t.grantButton}
          </button>
        </form>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold">{t.currentGrantsHeading}</h2>
        {subscriptions.length === 0 ? (
          <p className="text-sm text-[#4b4b45]">{t.empty}</p>
        ) : (
          <div className="overflow-x-auto rounded border border-[#dedbd2] bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#dedbd2] text-left text-[#4b4b45]">
                  <th className="px-4 py-2 font-medium">{t.colEmail}</th>
                  <th className="px-4 py-2 font-medium">{t.colPlan}</th>
                  <th className="px-4 py-2 font-medium">{t.colStatus}</th>
                  <th className="px-4 py-2 font-medium">{t.colSource}</th>
                  <th className="px-4 py-2 font-medium">{t.colUpdated}</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((sub) => (
                  <tr key={sub.id} className="border-b border-[#ece8dd] last:border-0">
                    <td className="px-4 py-2">{sub.user.email ?? sub.userId}</td>
                    <td className="px-4 py-2">{sub.plan}</td>
                    <td className="px-4 py-2">{sub.status}</td>
                    <td className="px-4 py-2">{sub.stripeSubscriptionId ? t.sourceStripe : t.sourceManual}</td>
                    <td className="px-4 py-2 text-[#666]">{formatDate(sub.updatedAt)}</td>
                    <td className="px-4 py-2 text-right">
                      <form action={revokePlan}>
                        <input type="hidden" name="userId" value={sub.userId} />
                        <button className="rounded border border-red-600 px-3 py-1 text-xs text-red-600" type="submit">
                          {t.revoke}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold">{t.logHeading}</h2>
        {logs.length === 0 ? (
          <p className="text-sm text-[#4b4b45]">{t.logEmpty}</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {logs.map((log) => {
              const meta = (log.metadata ?? {}) as { email?: string; plan?: string; status?: string };
              return (
                <li key={log.id} className="rounded border border-[#dedbd2] bg-white px-4 py-2 text-[#4b4b45]">
                  <span className="font-medium text-[#1d1d1b]">{log.action}</span>
                  {" · "}
                  {meta.email ? `${meta.email} · ` : ""}
                  {meta.plan ?? ""} {meta.status ? `(${meta.status})` : ""}
                  {" · "}
                  <span className="text-[#666]">
                    {log.user.email ?? log.userId} · {formatDate(log.createdAt)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
