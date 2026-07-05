import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/server/session";
import { isLocale } from "@/lib/i18n";

export default async function OnboardingPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=%2Fonboarding");
  if (user.onboardingCompletedAt) redirect("/dashboard");

  return (
    <main className="mx-auto flex min-h-[calc(100vh-73px)] max-w-md items-center px-6 py-10">
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

            redirect("/dashboard");
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
    </main>
  );
}
