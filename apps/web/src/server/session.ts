import { auth } from "@/auth";
import { redirect } from "next/navigation";

export type SessionUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  const user = session?.user as SessionUser | undefined;
  if (!user?.id) return null;
  return user;
}

export async function requireSessionUser(nextPath?: string) {
  const user = await getSessionUser();
  if (!user) {
    const suffix = nextPath ? `?next=${encodeURIComponent(nextPath)}` : "";
    redirect(`/login${suffix}`);
  }
  return user;
}

export function normalizeNextPath(nextPath: string | null | undefined) {
  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return "/dashboard";
  }
  return nextPath;
}
