import { redirect } from "next/navigation";
import { signIn } from "@/auth";
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

  return (
    <main className="mx-auto flex min-h-[calc(100vh-73px)] max-w-md items-center px-6 py-10">
      <section className="w-full rounded border border-[#dedbd2] bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-[#1d1d1b]">Log in</h1>
        <p className="mt-3 text-sm leading-6 text-[#4b4b45]">
          Sign in with your Google account to use the StoryCanon dashboard, project list, and project editor.
        </p>
        <form
          className="mt-6"
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: nextPath });
          }}
        >
          <button
            type="submit"
            className="block w-full rounded bg-[#1d1d1b] px-4 py-3 text-center text-white"
          >
            Log in with Google
          </button>
        </form>
      </section>
    </main>
  );
}
