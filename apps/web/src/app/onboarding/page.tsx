import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/server/session";
import { getDictionary, isLocale } from "@/lib/i18n";
import { McpConnect } from "@/components/mcp-connect";
import { getMcpConnection } from "@/server/mcp-connection";

const TOTAL_STEPS = 3;

/**
 * Three steps: language, then how they want to write, then — for anyone who
 * says "with an AI" — the connection panel itself.
 *
 * `onboardingCompletedAt` is still set at the end of step 1, not step 3. The
 * later steps are skippable and a returning user must never be trapped back in
 * here; the `step` query param is what keeps them reachable afterwards.
 */
export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=%2Fonboarding");

  const { step } = await searchParams;
  if (user.onboardingCompletedAt && !step) redirect("/dashboard");

  const t = getDictionary(user.locale).onboarding;
  const current = step === "3" ? 3 : step === "2" ? 2 : 1;

  return (
    <main
      className={`mx-auto px-6 py-10 ${current === 1 ? "flex min-h-[calc(100vh-73px)] max-w-md items-center" : "max-w-3xl"}`}
    >
      <div className="w-full">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-[#46605a]">
          {t.stepLabel} {current} / {TOTAL_STEPS}
        </p>

        {current === 1 ? <LanguageStep /> : null}
        {current === 2 ? <PlanStep locale={user.locale} /> : null}
        {current === 3 ? <ConnectStep userId={user.id} locale={user.locale} /> : null}
      </div>
    </main>
  );
}

function LanguageStep() {
  return (
    <section className="w-full rounded border border-[#dedbd2] bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold text-[#1d1d1b]">Welcome to StoryCanon / StoryCanonへようこそ</h1>
      <p className="mt-3 text-sm leading-6 text-[#4b4b45]">
        Choose your language to get started. / はじめに使用する言語を選択してください。
      </p>
      <form
        className="mt-6 space-y-4"
        action={async (formData) => {
          "use server";

          const currentUser = await getSessionUser();
          if (!currentUser) redirect("/login?next=%2Fonboarding");

          const requested = String(formData.get("locale") ?? "en");
          const locale = isLocale(requested) ? requested : "en";

          await prisma.user.update({
            where: { id: currentUser.id },
            data: { locale, onboardingCompletedAt: new Date() },
          });

          redirect("/onboarding?step=2");
        }}
      >
        <div className="space-y-2">
          <label className="flex items-center gap-3 rounded border border-[#dedbd2] px-4 py-3">
            <input type="radio" name="locale" value="en" defaultChecked />
            <span>English</span>
          </label>
          <label className="flex items-center gap-3 rounded border border-[#dedbd2] px-4 py-3">
            <input type="radio" name="locale" value="ja" />
            <span>日本語</span>
          </label>
        </div>
        <button className="block w-full rounded bg-[#1d1d1b] px-4 py-3 text-center text-white" type="submit">
          Continue / 続ける
        </button>
      </form>
    </section>
  );
}

function PlanStep({ locale }: { locale: "en" | "ja" }) {
  const t = getDictionary(locale).onboarding;

  return (
    <section>
      <h1 className="text-2xl font-semibold text-[#1d1d1b]">{t.planHeading}</h1>
      <p className="mt-3 max-w-[620px] text-sm leading-6 text-[#4b4b45]">{t.planLead}</p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <article className="flex flex-col rounded border border-[#1d1d1b] bg-white p-5">
          <h2 className="mb-2 font-semibold">{t.planWithAiTitle}</h2>
          <p className="mb-5 text-sm leading-6 text-[#555]">{t.planWithAiBody}</p>
          <Link
            className="mt-auto inline-flex min-h-[42px] items-center justify-center rounded bg-[#1d1d1b] px-4 text-sm font-bold text-white"
            href="/onboarding?step=3"
          >
            {t.planWithAiCta}
          </Link>
        </article>

        <article className="flex flex-col rounded border border-[#dedbd2] bg-white p-5">
          <h2 className="mb-2 font-semibold">{t.planSoloTitle}</h2>
          <p className="mb-5 text-sm leading-6 text-[#555]">{t.planSoloBody}</p>
          <Link
            className="mt-auto inline-flex min-h-[42px] items-center justify-center rounded border border-[#1d1d1b] px-4 text-sm font-bold"
            href="/dashboard"
          >
            {t.planSoloCta}
          </Link>
        </article>
      </div>
    </section>
  );
}

async function ConnectStep({ userId, locale }: { userId: string; locale: "en" | "ja" }) {
  const t = getDictionary(locale).onboarding;
  const connection = await getMcpConnection(userId);

  const headerList = await headers();
  const host = headerList.get("host");
  const protocol = headerList.get("x-forwarded-proto") ?? "https";

  return (
    <section>
      <h1 className="mb-5 text-2xl font-semibold text-[#1d1d1b]">{t.connectHeading}</h1>
      <div className="rounded border border-[#dedbd2] bg-white p-6">
        <McpConnect
          locale={locale}
          mcpUrl={`${protocol}://${host}/mcp`}
          openApiUrl={`${protocol}://${host}/mcp-openapi.json`}
          initialConnection={connection}
          compact
        />
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <Link
          className="inline-flex min-h-[42px] items-center justify-center rounded bg-[#1d1d1b] px-5 text-sm font-bold text-white"
          href="/dashboard"
        >
          {t.doneCta}
        </Link>
        <Link className="text-sm text-[#46605a] underline" href="/dashboard">
          {t.skip}
        </Link>
      </div>
    </section>
  );
}
