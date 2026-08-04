import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal-page";
import { CookieSettingsButton } from "@/components/cookie-settings-button";
import { legalInfo } from "@/lib/legal-info";

export const metadata: Metadata = {
  title: "Cookieポリシー",
};

export default function CookiePolicyPage() {
  return (
    <LegalPage
      title="Cookieポリシー"
      intro={`${legalInfo.serviceName}（以下「本サービス」）における Cookie および類似技術の利用について説明します。`}
    >
      <LegalSection heading="1. Cookieとは">
        <p>
          Cookie は、ウェブサイトが利用者のブラウザに保存する小さなテキストデータです。本サービスは、ログイン状態の維持や利用状況の分析のために Cookie を使用します。
        </p>
      </LegalSection>

      <LegalSection heading="2. 利用する Cookie の種類">
        <div className="space-y-3">
          <div>
            <p className="font-medium text-[#1d1d1b]">必須 Cookie（同意不要）</p>
            <p>
              ログインおよびセッションの維持、セキュリティのために使用します。これらは本サービスの提供に不可欠であり、無効にすると正常に利用できない場合があります。
            </p>
          </div>
          <div>
            <p className="font-medium text-[#1d1d1b]">機能 Cookie（同意不要）</p>
            <p>
              表示言語の選択を保持するために使用します（
              <code className="mx-1 rounded bg-[#f2f1ec] px-1 text-sm">sc_locale</code>
              ）。個人を識別する情報は含まれず、解析にも利用しません。
            </p>
          </div>
          <div>
            <p className="font-medium text-[#1d1d1b]">分析 Cookie（同意が必要）</p>
            <p>
              Google Analytics（Google LLC 提供）および PostHog（PostHog Inc. 提供）により、ページの閲覧状況や画面上の操作（クリック等）を統計的に把握し、サービス改善に利用します。取得される情報には、閲覧ページ、参照元、ブラウザ情報、IPアドレス（Google Analyticsは匿名化）等が含まれます。ログイン中の利用者については、内部的なユーザーIDおよびプラン種別を PostHog に送信し、機能の利用状況を分析します。画面操作を録画するセッション録画機能は無効にしています。代表的な Cookie は
              <code className="mx-1 rounded bg-[#f2f1ec] px-1 text-sm">_ga</code>
              <code className="mx-1 rounded bg-[#f2f1ec] px-1 text-sm">_ga_*</code>
              （Google Analytics）、
              <code className="mx-1 rounded bg-[#f2f1ec] px-1 text-sm">ph_*_posthog</code>
              （PostHog）です。PostHog のデータは EU（欧州）リージョンでホスティングされています。分析 Cookie は、利用者が同意した場合にのみ有効になります。
            </p>
          </div>
        </div>
      </LegalSection>

      <LegalSection heading="3. 同意の管理・オプトアウト">
        <p>
          分析 Cookie は、初回アクセス時に表示されるバナーで同意・拒否を選択できます。選択は以下のボタンからいつでも変更できます。
        </p>
        <div className="py-1">
          <CookieSettingsButton />
        </div>
        <p>
          また、ブラウザの設定で Cookie を削除・ブロックすること、Google が提供する
          <a
            className="mx-1 text-[#46605a] underline"
            href="https://tools.google.com/dlpage/gaoptout"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google アナリティクス オプトアウト アドオン
          </a>
          を利用することでも、収集を停止できます。
        </p>
      </LegalSection>

      <LegalSection heading="4. 関連ポリシー">
        <p>
          個人情報の取り扱い全般については
          <a className="mx-1 text-[#46605a] underline" href="/legal/privacy">
            プライバシーポリシー
          </a>
          をご確認ください。Google および PostHog による情報の取り扱いについては、それぞれの提供元のプライバシーポリシーをご参照ください。
        </p>
      </LegalSection>
    </LegalPage>
  );
}
