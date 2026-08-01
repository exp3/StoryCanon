import { notFound } from "next/navigation";
import { requireSessionUser } from "./session";

/**
 * Admin access is controlled by the `ADMIN_EMAILS` environment variable — a
 * comma-separated allowlist of emails. When unset, nobody is an admin (the
 * safe default). Emails are compared case-insensitively after trimming.
 */
export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const allowlist = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  return allowlist.includes(email.toLowerCase());
}

/**
 * Gate for admin-only pages and server actions. Requires an authenticated
 * session, then a matching entry in `ADMIN_EMAILS`. Non-admins get a 404 so
 * the admin surface's existence is not revealed.
 */
export async function requireAdminUser() {
  const user = await requireSessionUser("/admin");
  if (!isAdminEmail(user.email)) notFound();
  return user;
}
