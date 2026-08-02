import { NextResponse, type NextRequest } from "next/server";
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, LOCALE_HEADER } from "@/lib/locale-cookie";

/**
 * Gives the landing page crawlable per-language URLs without duplicating the
 * route. `/ja` and `/en` are rewritten onto `/` with the locale carried in a
 * request header, so the root layout — which cannot see the child segment —
 * still renders the right `<html lang>`. The choice is also persisted as a
 * cookie so it survives the visitor navigating away from the landing page.
 *
 * Runs on the Edge runtime: do not import the i18n dictionary or Prisma here.
 *
 * On caching: `/` renders differently per Accept-Language and per locale
 * cookie, so it must never be served from a shared cache. Next owns the `Vary`
 * header on App Router responses and overwrites anything set here, but it also
 * marks these dynamic routes `private, no-store`, and there is no CDN in front
 * of the ALB — so nothing can cache them today. Revisit this if a CDN is added
 * or if `/` ever gains `revalidate`.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const headers = new Headers(request.headers);
  // The locale header is ours to set. A spoofed inbound one could otherwise be
  // cached against `/` and served to other visitors in the wrong language.
  headers.delete(LOCALE_HEADER);

  if (pathname !== "/ja" && pathname !== "/en") {
    return NextResponse.next({ request: { headers } });
  }

  const locale = pathname === "/ja" ? "ja" : "en";
  headers.set(LOCALE_HEADER, locale);

  const url = request.nextUrl.clone();
  url.pathname = "/";

  const response = NextResponse.rewrite(url, { request: { headers } });
  response.cookies.set(LOCALE_COOKIE, locale, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: LOCALE_COOKIE_MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}

export const config = {
  matcher: ["/", "/ja", "/en"],
};
