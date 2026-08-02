import { cookies, headers } from "next/headers";
import { cache } from "react";
import { pickAcceptLanguage } from "@/lib/accept-language";
import { isLocale, type Locale } from "@/lib/i18n";
import { LOCALE_COOKIE, LOCALE_HEADER } from "@/lib/locale-cookie";
import { getSessionUser } from "@/server/session";

/**
 * The one place that decides which language a request is rendered in, so the
 * root layout, the header, the footer and the page can never disagree.
 *
 * Cached per request: `getSessionUser` hits the database on every call under
 * the database session strategy.
 */
export const resolveLocale = cache(async (): Promise<Locale> => {
  const headerList = await headers();

  // An explicit /ja or /en URL wins outright — a crawler must get the language
  // it asked for, and a reader following a shared link must too.
  const fromUrl = headerList.get(LOCALE_HEADER);
  if (fromUrl && isLocale(fromUrl)) return fromUrl;

  // A signed-in user's saved preference. /settings owns this value.
  const user = await getSessionUser();
  if (user) return user.locale;

  // Anonymous visitors: a previous explicit choice, then the browser's own
  // preference. Both are untrusted input, hence the isLocale guard.
  const fromCookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (fromCookie && isLocale(fromCookie)) return fromCookie;

  return pickAcceptLanguage(headerList.get("accept-language")) ?? "en";
});
