"use client";

import { useActionState } from "react";
import { createApiToken, type CreateApiTokenState } from "./actions";

const initialState: CreateApiTokenState = { error: null, token: null };

export function CreateTokenForm() {
  const [state, formAction, pending] = useActionState(createApiToken, initialState);

  return (
    <form action={formAction} className="space-y-3 rounded border border-[#dedbd2] bg-white p-6">
      <label className="block">
        <span className="text-sm font-medium">トークン名</span>
        <input
          className="mt-1 w-full rounded border border-[#dedbd2] px-3 py-2"
          name="name"
          placeholder="例: ChatGPT連携"
          required
        />
      </label>
      <button
        className="rounded bg-[#1d1d1b] px-4 py-2 text-sm text-white disabled:opacity-50"
        type="submit"
        disabled={pending}
      >
        新しいトークンを発行
      </button>
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {state.token ? (
        <div className="rounded border border-amber-400 bg-amber-50 p-4 text-sm">
          <p className="font-medium">この画面を離れると二度と表示されません。今すぐコピーしてください。</p>
          <code className="mt-2 block break-all rounded bg-white p-2">{state.token}</code>
        </div>
      ) : null}
    </form>
  );
}
