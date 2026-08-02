import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal-page";
import { legalInfo } from "@/lib/legal-info";

export const metadata: Metadata = {
  title: "プライバシーポリシー",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="プライバシーポリシー"
      intro={`${legalInfo.operatorName}（以下「運営者」）は、「${legalInfo.serviceName}」（以下「本サービス」）における利用者の個人情報を、本ポリシーに従って適切に取り扱います。`}
    >
      <LegalSection heading="1. 取得する情報">
        <ul className="list-disc space-y-1 pl-5">
          <li>アカウント情報：Google アカウントを通じて取得する氏名・メールアドレス・プロフィール画像</li>
          <li>利用者コンテンツ：プロジェクト、本文、キャラクター、世界観メモ等、利用者が本サービスに保存したデータ</li>
          <li>決済情報：Stripe が発行する顧客ID・サブスクリプション状態（クレジットカード番号は運営者では保持しません）</li>
          <li>利用情報：アクセスログ、IPアドレス、ブラウザ情報、Cookie 等を通じて自動的に取得する情報</li>
        </ul>
      </LegalSection>

      <LegalSection heading="2. 利用目的">
        <ul className="list-disc space-y-1 pl-5">
          <li>本サービスの提供、本人認証および利用者コンテンツの保存・表示のため</li>
          <li>料金の決済および請求管理のため</li>
          <li>お問い合わせ対応のため</li>
          <li>本サービスの品質向上、利用状況の分析および不正利用の防止のため</li>
        </ul>
      </LegalSection>

      <LegalSection heading="3. 第三者提供・外部サービスの利用">
        <p>運営者は、法令に基づく場合を除き、あらかじめ同意を得ずに個人情報を第三者に提供しません。本サービスは以下の外部サービスを利用しており、それぞれの目的の範囲で情報が取り扱われます。</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Google LLC（認証：Google アカウントによるログイン）</li>
          <li>Stripe, Inc.（決済処理・サブスクリプション管理）</li>
          <li>Amazon Web Services, Inc.（サーバー・データベース・ファイル保管。東京リージョンを利用）</li>
          <li>Google LLC（アクセス解析：Google Analytics。詳細は
            <a className="mx-1 text-[#46605a] underline" href="/legal/cookies">Cookieポリシー</a>
            をご参照ください）
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="4. Cookie・アクセス解析">
        <p>
          本サービスは、ログイン状態の維持およびアクセス解析のために Cookie 等を使用します。取得・利用の詳細および同意の管理方法は
          <a className="mx-1 text-[#46605a] underline" href="/legal/cookies">Cookieポリシー</a>
          に定めます。
        </p>
      </LegalSection>

      <LegalSection heading="5. 保管期間">
        <p>
          個人情報は、利用目的の達成に必要な期間、または法令で定められた期間保管します。利用者はアカウントの削除を求めることができ、その場合、運営者は法令上保持が必要なものを除き、合理的な期間内に消去します。
        </p>
      </LegalSection>

      <LegalSection heading="6. 安全管理措置">
        <p>
          運営者は、個人情報の漏えい・滅失・毀損の防止その他の安全管理のために必要かつ適切な措置を講じます。具体的な取り組みは
          <a className="mx-1 text-[#46605a] underline" href="/legal/security">セキュリティ</a>
          ページに記載します。
        </p>
      </LegalSection>

      <LegalSection heading="7. 開示・訂正・利用停止等の請求">
        <p>
          利用者は、自己の個人情報について、開示・訂正・追加・削除・利用停止等を求めることができます。ご請求は
          <a className="mx-1 text-[#46605a] underline" href={legalInfo.contactPath}>お問い合わせフォーム</a>
          より受け付けます。ご本人であることを確認のうえ、法令に従い対応します。
        </p>
      </LegalSection>

      <LegalSection heading="8. お問い合わせ窓口">
        <p>
          本ポリシーに関するお問い合わせは、{legalInfo.contactEmail}（または
          <a className="mx-1 text-[#46605a] underline" href={legalInfo.contactPath}>お問い合わせフォーム</a>
          ）までご連絡ください。
        </p>
      </LegalSection>

      <LegalSection heading="9. 改定">
        <p>運営者は、必要に応じて本ポリシーを改定することがあります。重要な変更については本サービス上で通知します。</p>
      </LegalSection>
    </LegalPage>
  );
}
