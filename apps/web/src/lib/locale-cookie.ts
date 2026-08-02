/**
 * Names shared between the Edge middleware and the server-side locale
 * resolver. Kept dependency-free so `middleware.ts` can import them without
 * dragging the i18n dictionary or Prisma into the Edge bundle.
 */
export const LOCALE_COOKIE = "sc_locale";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Request header the middleware uses to hand `/ja` and `/en` to the app. */
export const LOCALE_HEADER = "x-sc-locale";
