import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "返金・キャンセルポリシー | StoryCanon",
};

export default function RefundPage() {
  return (
    <LegalPage
      title="返金・キャンセルポリシー"
      intro="有料プランの解約・返金の取扱いについて定めます。特定商取引法に基づく表記および利用規約とあわせてご確認ください。"
    >
      <LegalSection heading="1. 解約（自動更新の停止）">
        <p>
          有料プランは、設定画面 →「請求管理（Manage billing）」から Stripe カスタマーポータルにアクセスすることで、いつでも解約できます。解約手続きを行うと、次回以降の自動更新が停止されます。
        </p>
        <p>
          解約後も、既にお支払いいただいた請求期間の終了日までは、有料機能を引き続きご利用いただけます。
        </p>
      </LegalSection>

      <LegalSection heading="2. 返金の原則">
        <p>
          本サービスはデジタルコンテンツ・役務の性質を有するため、提供開始後の返金は原則としてお受けできません。月額・年額いずれのプランについても、期間の途中で解約された場合の日割り返金は行いません。
        </p>
      </LegalSection>

      <LegalSection heading="3. 例外的に返金する場合">
        <p>次のいずれかに該当する場合には、個別に返金の可否を判断します。</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>運営者の重大な帰責事由により、有料機能が相当期間にわたり利用できなかった場合</li>
          <li>二重決済など、明らかな課金上の誤りがあった場合</li>
          <li>その他、法令により返金が求められる場合</li>
        </ul>
      </LegalSection>

      <LegalSection heading="4. 返金の請求方法">
        <p>
          返金をご希望の場合は、
          <a className="mx-1 text-[#46605a] underline" href="/contact">お問い合わせフォーム</a>
          より、対象のアカウント・決済日・理由を添えてご連絡ください。返金を行う場合は、原則として決済に用いられた手段へ返金します。
        </p>
      </LegalSection>
    </LegalPage>
  );
}
