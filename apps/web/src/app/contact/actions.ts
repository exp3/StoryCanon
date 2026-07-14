"use server";

import { z } from "zod";

export type ContactState = { ok: boolean; error: string | null };

const contactSchema = z.object({
  name: z.string().min(1, "お名前を入力してください。").max(120),
  email: z.string().email("メールアドレスの形式が正しくありません。").max(254),
  message: z.string().min(1, "お問い合わせ内容を入力してください。").max(5000),
});

export async function submitContact(_prev: ContactState, formData: FormData): Promise<ContactState> {
  // Simple honeypot: real users leave this hidden field empty.
  if (String(formData.get("company") ?? "") !== "") {
    return { ok: true, error: null };
  }

  const parsed = contactSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    message: String(formData.get("message") ?? ""),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "入力内容をご確認ください。" };
  }

  // TODO(delivery): wire this to the operator's chosen destination.
  //   - Email notification (e.g. Amazon SES / Resend) to the support address, or
  //   - Persist to a ContactMessage table (requires a Prisma model + migration).
  // Until then, submissions are written to the server log so they are not lost
  // in development. Do NOT ship to production without real delivery.
  console.info("[contact] new submission", {
    name: parsed.data.name,
    email: parsed.data.email,
    message: parsed.data.message,
    at: new Date().toISOString(),
  });

  return { ok: true, error: null };
}
