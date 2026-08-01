import Link from "next/link";
import { signOut } from "@/auth";
import { getDictionary } from "@/lib/i18n";
import { getSessionUser } from "@/server/session";
import { isAdminEmail } from "@/server/admin";

export async function SiteHeader() {
  const user = await getSessionUser();
  const t = getDictionary(user?.locale ?? "en").header;
  const showAdmin = isAdminEmail(user?.email);

  return (
    <header className="border-b border-[#dedbd2] bg-[#f7f7f4]">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-6">
          <Link className="text-lg font-semibold text-[#1d1d1b]" href={user ? "/dashboard" : "/"}>
            StoryCanon
          </Link>
          {user ? (
            <nav className="flex items-center gap-4 text-sm text-[#4b4b45]">
              <Link href="/dashboard">{t.dashboard}</Link>
              <Link href="/projects">{t.projects}</Link>
              <Link href="/projects/new">{t.newProject}</Link>
              <Link href="/settings">{t.settings}</Link>
              {showAdmin ? <Link href="/admin">{t.admin}</Link> : null}
            </nav>
          ) : null}
        </div>
        {user ? (
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-[#4b4b45] sm:inline">{user.name ?? user.email}</span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <button className="rounded border border-[#1d1d1b] px-3 py-2" type="submit">
                {t.logout}
              </button>
            </form>
          </div>
        ) : (
          <Link className="rounded bg-[#1d1d1b] px-4 py-2 text-sm text-white" href="/login">
            {t.login}
          </Link>
        )}
      </div>
    </header>
  );
}
