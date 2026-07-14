import Link from "next/link";
import { legalInfo, legalInfoIsPlaceholder } from "@/lib/legal-info";

/**
 * Shared chrome for the Japanese legal / policy pages: title, last-updated
 * date, an optional draft warning while operator facts are still placeholders,
 * and consistent prose styling.
 */
export function LegalPage({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10 text-[#1d1d1b]">
      <nav className="mb-6 text-sm">
        <Link className="text-[#46605a] underline" href="/">
          ← {legalInfo.serviceName} トップ
        </Link>
      </nav>

      <h1 className="text-3xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-[#6b6b63]">最終更新日：{legalInfo.lastUpdated}</p>

      {legalInfoIsPlaceholder ? (
        <p className="mt-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          ⚠️ これは下書きです。事業者情報などの法定記載事項が未確定のため、
          <code className="mx-1 rounded bg-amber-100 px-1">src/lib/legal-info.ts</code>
          の【要確認】項目を実値に置き換え、公開前に専門家（弁護士等）の確認を受けてください。
        </p>
      ) : null}

      {intro ? <p className="mt-6 leading-7 text-[#3f3f39]">{intro}</p> : null}

      <div className="legal-body mt-6 space-y-6 leading-7 text-[#3f3f39]">{children}</div>
    </main>
  );
}

/** A numbered/titled section used within legal pages. */
export function LegalSection({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-lg font-semibold text-[#1d1d1b]">{heading}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
