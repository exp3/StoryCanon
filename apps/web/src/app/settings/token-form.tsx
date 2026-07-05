"use client";

import { useActionState } from "react";
import { CopyButton } from "@/components/copy-button";
import { getDictionary, type Locale } from "@/lib/i18n";
import { createApiToken, type CreateApiTokenState } from "./actions";

const initialState: CreateApiTokenState = { error: null, token: null };

export function CreateTokenForm({ locale }: { locale: Locale }) {
  const [state, formAction, pending] = useActionState(createApiToken, initialState);
  const t = getDictionary(locale).settings;

  return (
    <form action={formAction} className="space-y-3 rounded border border-[#dedbd2] bg-white p-6">
      <label className="block">
        <span className="text-sm font-medium">{t.tokenNameLabel}</span>
        <input
          className="mt-1 w-full rounded border border-[#dedbd2] px-3 py-2"
          name="name"
          placeholder={t.tokenNamePlaceholder}
          required
        />
      </label>
      <button
        className="rounded bg-[#1d1d1b] px-4 py-2 text-sm text-white disabled:opacity-50"
        type="submit"
        disabled={pending}
      >
        {t.issueButton}
      </button>
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {state.token ? (
        <div className="rounded border border-amber-400 bg-amber-50 p-4 text-sm">
          <p className="font-medium">{t.revealWarning}</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="block flex-1 break-all rounded bg-white p-2">{state.token}</code>
            <CopyButton value={state.token} />
          </div>
        </div>
      ) : null}
    </form>
  );
}
