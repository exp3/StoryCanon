"use client";

import { OPEN_COOKIE_SETTINGS_EVENT, STORAGE_KEY } from "@/components/analytics-consent";

/** Reopens the cookie consent banner so a user can change their choice. */
export function CookieSettingsButton() {
  return (
    <button
      className="rounded border border-[#c9c6bc] px-4 py-2 text-sm text-[#1d1d1b]"
      onClick={() => {
        window.localStorage.removeItem(STORAGE_KEY);
        window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS_EVENT));
      }}
      type="button"
    >
      Cookie同意設定を変更する
    </button>
  );
}
