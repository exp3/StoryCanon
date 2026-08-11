import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeNextPath } from "@/server/session";
import { DEV_LOGIN_DEFAULT_EMAIL, isDevLoginEnabled, sessionCookieName } from "@/server/dev-login";

/** Matches the 30-day session the Prisma adapter would create. */
const SESSION_DAYS = 30;

/**
 * GET /dev-login → signs in as a local development user.
 *
 * Returns 404 unless both guards in server/dev-login.ts pass, so on a
 * production build this route does not exist as far as a caller can tell.
 *
 * Query parameters:
 *   ?email=…  which local user to be (default dev@localhost)
 *   ?fresh=1  delete that user's works, tokens and grants and reset onboarding
 *   ?next=…   where to land afterwards (default /dashboard)
 */
export async function GET(request: NextRequest) {
  if (!isDevLoginEnabled()) {
    return new NextResponse("Not found", { status: 404 });
  }

  const params = request.nextUrl.searchParams;
  const email = params.get("email") || DEV_LOGIN_DEFAULT_EMAIL;
  const next = normalizeNextPath(params.get("next") ?? "/dashboard");

  const user = await prisma.user.upsert({
    where: { email },
    create: { email, name: "Local Dev", locale: "ja" },
    update: {},
    select: { id: true },
  });

  if (params.get("fresh") === "1") {
    // Hard deletes rather than the app's soft delete: the point is to get back
    // to a genuinely first-run account, which soft-deleted rows would not give.
    await prisma.project.deleteMany({ where: { userId: user.id } });
    await prisma.apiToken.deleteMany({ where: { userId: user.id } });
    await prisma.oAuthGrant.deleteMany({ where: { userId: user.id } });
    await prisma.user.update({
      where: { id: user.id },
      data: { onboardingCompletedAt: null, locale: "ja" },
    });
  }

  const sessionToken = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 3600 * 1000);
  await prisma.session.create({ data: { sessionToken, userId: user.id, expires } });

  const isSecure = request.nextUrl.protocol === "https:";
  const response = NextResponse.redirect(new URL(next, request.nextUrl.origin));
  response.cookies.set(sessionCookieName(isSecure), sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: isSecure,
    expires,
  });
  return response;
}
