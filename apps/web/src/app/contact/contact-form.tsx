"use client";

import { useActionState } from "react";
import { submitContact, type ContactState } from "./actions";

const initialState: ContactState = { ok: false, error: null };

export function ContactForm() {
  const [state, formAction, pending] = useActionState(submitContact, initialState);

  if (state.ok) {
    return (
      <div className="rounded border border-[#cfe0d6] bg-[#eef5f0] p-4 text-sm text-[#2f4a40]">
        お問い合わせを受け付けました。ご入力いただいたメールアドレス宛に、担当より順次ご連絡いたします。
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4 rounded border border-[#dedbd2] bg-white p-6">
      <label className="block">
        <span className="text-sm font-medium">お名前</span>
        <input className="mt-1 w-full rounded border border-[#dedbd2] px-3 py-2" name="name" required />
      </label>
      <label className="block">
        <span className="text-sm font-medium">メールアドレス</span>
        <input
          className="mt-1 w-full rounded border border-[#dedbd2] px-3 py-2"
          name="email"
          type="email"
          required
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium">お問い合わせ内容</span>
        <textarea
          className="mt-1 min-h-40 w-full rounded border border-[#dedbd2] px-3 py-2"
          name="message"
          required
        />
      </label>
      {/* Honeypot field: hidden from users, catches naive bots. */}
      <input
        className="hidden"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
      />
      <button
        className="rounded bg-[#1d1d1b] px-4 py-2 text-sm text-white disabled:opacity-50"
        type="submit"
        disabled={pending}
      >
        送信する
      </button>
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
    </form>
  );
}
