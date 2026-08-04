"use client";

import Script from "next/script";
import { Suspense, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import type { Dictionary } from "@/lib/i18n";

export const STORAGE_KEY = "sc_cookie_consent";
export const OPEN_COOKIE_SETTINGS_EVENT = "sc:open-cookie-settings";

type Consent = "granted" | "denied";

type AnalyticsConsentProps = {
  gaId: string;
  posthogKey: string;
  posthogHost: string;
  userId: string | null;
  plan: string | null;
  t: Dictionary["consent"];
};

/**
 * Loads Google Analytics and/or PostHog only after the user has actively
 * granted consent, and renders the consent banner. Essential auth/session
 * cookies are unaffected — this gates analytics only. Consent is remembered
 * in localStorage and can be reopened from the Cookie policy page via a
 * `sc:open-cookie-settings` event.
 *
 * Renders nothing when neither GA nor PostHog is configured.
 *
 * Strings are passed in rather than resolved here: this is a client component
 * and the locale is only knowable on the server.
 */
export function AnalyticsConsent({ gaId, posthogKey, posthogHost, userId, plan, t }: AnalyticsConsentProps) {
  const [consent, setConsent] = useState<Consent | null | "loading">("loading");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) as Consent | null;
    setConsent(stored ?? null);
    const reopen = () => setConsent(null);
    window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, reopen);
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, reopen);
  }, []);

  useEffect(() => {
    if (!posthogKey || !posthogHost) return;
    if (consent === "granted") {
      if (!posthog.__loaded) {
        posthog.init(posthogKey, {
          api_host: posthogHost,
          capture_pageview: false,
          person_profiles: "identified_only",
          disable_session_recording: true,
        });
      }
      posthog.opt_in_capturing();
      if (userId) posthog.identify(userId, { plan });
    } else if (consent === "denied" && posthog.__loaded) {
      posthog.opt_out_capturing();
    }
  }, [consent, posthogKey, posthogHost, userId, plan]);

  function choose(value: Consent) {
    window.localStorage.setItem(STORAGE_KEY, value);
    setConsent(value);
  }

  const hasAnalytics = Boolean(gaId) || Boolean(posthogKey && posthogHost);
  if (!hasAnalytics) return null;

  const loadAnalytics = consent === "granted";
  const showBanner = consent === null;

  return (
    <>
      {loadAnalytics && gaId ? (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} strategy="afterInteractive" />
          <Script id="ga-init" strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${gaId}', { anonymize_ip: true });`}
          </Script>
        </>
      ) : null}

      {loadAnalytics && posthogKey && posthogHost ? (
        <Suspense fallback={null}>
          <PostHogPageview />
        </Suspense>
      ) : null}

      {showBanner ? (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-[#dedbd2] bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-4 text-sm text-[#3f3f39] sm:flex-row sm:items-center sm:justify-between">
            <p className="leading-6">
              {t.messageBefore}
              <a className="text-[#46605a] underline" href="/legal/cookies">
                {t.policyLink}
              </a>
              {t.messageAfter}
            </p>
            <div className="flex shrink-0 gap-2">
              <button
                className="rounded border border-[#c9c6bc] px-4 py-2 text-[#1d1d1b]"
                onClick={() => choose("denied")}
                type="button"
              >
                {t.deny}
              </button>
              <button
                className="rounded bg-[#1d1d1b] px-4 py-2 text-white"
                onClick={() => choose("granted")}
                type="button"
              >
                {t.accept}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

/** Manually captures $pageview on client-side route changes — App Router navigation doesn't trigger posthog-js's built-in history-API pageview capture reliably, so capture_pageview is off and this drives it instead. */
function PostHogPageview() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!posthog.__loaded) return;
    const query = searchParams.toString();
    posthog.capture("$pageview", {
      $current_url: query ? `${pathname}?${query}` : pathname,
    });
  }, [pathname, searchParams]);

  return null;
}
