import { isLocale, type Locale } from "@/lib/i18n";

/**
 * Picks a supported locale out of an `Accept-Language` header.
 *
 * Tags are scanned left to right and the first supported one wins. We do not
 * sort by q-value: browsers already emit tags in descending q order, so a
 * positional scan is equivalent for real traffic and avoids float parsing.
 * Returns null when the visitor asks for nothing we support.
 */
export function pickAcceptLanguage(header: string | null | undefined): Locale | null {
  if (!header) return null;
  for (const part of header.split(",")) {
    // "ja-JP;q=0.9" -> "ja"
    const tag = part.split(";")[0].trim().toLowerCase();
    const base = tag.split("-")[0];
    if (isLocale(base)) return base;
  }
  return null;
}
