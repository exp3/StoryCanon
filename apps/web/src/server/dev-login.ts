/**
 * Local-only sign-in, so the authenticated screens can be opened on a machine
 * with no Google OAuth client configured.
 *
 * Google is the only real provider, and Auth.js's Credentials provider cannot
 * be used here because it requires JWT sessions while this app uses
 * `strategy: "database"`. So rather than change how production sessions work,
 * this writes the same Session row the Prisma adapter would have written and
 * sets the same cookie.
 *
 * Two independent conditions must both hold for any of it to be reachable:
 * a non-production build, and an explicit DEV_LOGIN=1. Deployments set neither.
 */
export function isDevLoginEnabled() {
  return process.env.NODE_ENV !== "production" && process.env.DEV_LOGIN === "1";
}

/**
 * Auth.js picks the cookie name from whether the deployment is secure. Dev runs
 * over plain http, but derive it anyway so this keeps working behind a local
 * https proxy.
 */
export function sessionCookieName(isSecure: boolean) {
  return isSecure ? "__Secure-authjs.session-token" : "authjs.session-token";
}

export const DEV_LOGIN_DEFAULT_EMAIL = "dev@localhost";
