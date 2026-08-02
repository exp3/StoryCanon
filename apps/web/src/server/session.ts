import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { Locale } from "@/lib/i18n";

export type SessionUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  locale: Locale;
  onboardingCompletedAt: Date | null;
};

/**
 * Cached per request: the layout, header, footer and page each need the user,
 * and the database session strategy makes every uncached call a round trip.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth();
  const user = session?.user as SessionUser | undefined;
  if (!user?.id) return null;
  return user;
});

export async function requireSessionUser(nextPath?: string) {
  const user = await getSessionUser();
  if (!user) {
    const suffix = nextPath ? `?next=${encodeURIComponent(nextPath)}` : "";
    redirect(`/login${suffix}`);
  }
  if (!user.onboardingCompletedAt) {
    redirect("/onboarding");
  }
  return user;
}

export function normalizeNextPath(nextPath: string | null | undefined) {
  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return "/dashboard";
  }
  return nextPath;
}
