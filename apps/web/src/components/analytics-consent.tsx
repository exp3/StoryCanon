"use client";

import Script from "next/script";
import { useEffect, useState } from "react";

const STORAGE_KEY = "sc_cookie_consent";
export const OPEN_COOKIE_SETTINGS_EVENT = "sc:open-cookie-settings";

type Consent = "granted" | "denied";

/**
 * Loads Google Analytics only after the user has actively granted consent, and
 * renders the consent banner. Essential auth/session cookies are unaffected —
 * this gates analytics only. Consent is remembered in localStorage and can be
 * reopened from the Cookie policy page via a `sc:open-cookie-settings` event.
 *
 * Renders nothing when no GA measurement id is configured.
 */
export function AnalyticsConsent({ gaId }: { gaId: string }) {
  const [consent, setConsent] = useState<Consent | null | "loading">("loading");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) as Consent | null;
    setConsent(stored ?? null);
    const reopen = () => setConsent(null);
    window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, reopen);
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, reopen);
  }, []);

  function choose(value: Consent) {
    window.localStorage.setItem(STORAGE_KEY, value);
    setConsent(value);
  }

  if (!gaId) return null;

  const loadGa = consent === "granted";
  const showBanner = consent === null;

  return (
    <>
      {loadGa ? (
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

      {showBanner ? (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-[#dedbd2] bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-4 text-sm text-[#3f3f39] sm:flex-row sm:items-center sm:justify-between">
            <p className="leading-6">
              本サイトは、利用状況の分析のために Cookie（Google Analytics）を使用します。詳細は
              <a className="mx-1 text-[#46605a] underline" href="/legal/cookies">
                Cookieポリシー
              </a>
              をご覧ください。
            </p>
            <div className="flex shrink-0 gap-2">
              <button
                className="rounded border border-[#c9c6bc] px-4 py-2 text-[#1d1d1b]"
                onClick={() => choose("denied")}
                type="button"
              >
                拒否する
              </button>
              <button
                className="rounded bg-[#1d1d1b] px-4 py-2 text-white"
                onClick={() => choose("granted")}
                type="button"
              >
                同意する
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
