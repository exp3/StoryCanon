import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser, normalizeNextPath } from "@/server/session";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const currentUser = await getSessionUser();
  const { next } = await searchParams;
  const nextPath = normalizeNextPath(next);

  if (currentUser) {
    redirect(nextPath);
  }

  const googleSignInHref = `/api/auth/signin/google?callbackUrl=${encodeURIComponent(nextPath)}`;

  return (
    <main className="mx-auto flex min-h-[calc(100vh-73px)] max-w-md items-center px-6 py-10">
      <section className="w-full rounded border border-[#dedbd2] bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-[#1d1d1b]">ログイン</h1>
        <p className="mt-3 text-sm leading-6 text-[#4b4b45]">
          StoryCanon のダッシュボード、作品一覧、作品編集画面を使うには Google アカウントでログインしてください。
        </p>
        <div className="mt-6">
          <Link className="block w-full rounded bg-[#1d1d1b] px-4 py-3 text-center text-white" href={googleSignInHref}>
            Google でログイン
          </Link>
        </div>
      </section>
    </main>
  );
}
