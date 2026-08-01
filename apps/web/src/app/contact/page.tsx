import type { Metadata } from "next";
import Link from "next/link";
import { legalInfo } from "@/lib/legal-info";

export const metadata: Metadata = {
  title: "お問い合わせ | StoryCanon",
};

export default function ContactPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10 text-[#1d1d1b]">
      <nav className="mb-6 text-sm">
        <Link className="text-[#46605a] underline" href="/">
          ← {legalInfo.serviceName} トップ
        </Link>
      </nav>

      <h1 className="text-3xl font-semibold">お問い合わせ</h1>
      <p className="mt-4 leading-7 text-[#3f3f39]">
        {legalInfo.serviceName} に関するご質問・ご要望・不具合のご報告は、以下のフォームよりお送りください。内容を確認のうえ、ご入力いただいたメールアドレス宛にご返信します。
      </p>

      <div className="mt-6">
        <a
          className="inline-block rounded bg-[#1d1d1b] px-4 py-2 text-sm text-white"
          href={legalInfo.contactFormUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          お問い合わせフォームを開く
        </a>
      </div>

      <p className="mt-6 text-sm text-[#6b6b63]">
        個人情報の取り扱いについては
        <Link className="mx-1 text-[#46605a] underline" href="/legal/privacy">
          プライバシーポリシー
        </Link>
        をご確認ください。
      </p>
    </main>
  );
}
