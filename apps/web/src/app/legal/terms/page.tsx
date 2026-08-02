import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal-page";
import { legalInfo } from "@/lib/legal-info";

export const metadata: Metadata = {
  title: "利用規約",
};

export default function TermsPage() {
  return (
    <LegalPage
      title="利用規約"
      intro={`本利用規約（以下「本規約」）は、${legalInfo.operatorName}（以下「運営者」）が提供する「${legalInfo.serviceName}」（以下「本サービス」）の利用条件を定めるものです。利用者は、本サービスを利用することにより本規約に同意したものとみなされます。`}
    >
      <LegalSection heading="第1条（適用）">
        <p>本規約は、本サービスの利用に関わる運営者と利用者との間の一切の関係に適用されます。</p>
      </LegalSection>

      <LegalSection heading="第2条（アカウント登録）">
        <p>
          本サービスの一部機能は、Google アカウントによる認証を経て利用できます。利用者は、登録情報を自己の責任で管理し、第三者に使用させてはなりません。
        </p>
      </LegalSection>

      <LegalSection heading="第3条（利用料金と支払い）">
        <p>
          有料プランの利用料金、支払方法および支払時期は、申込画面、決済ページおよび
          <a className="mx-1 text-[#46605a] underline" href="/legal/tokushoho">特定商取引法に基づく表記</a>
          に定めるとおりとします。有料プランは契約期間ごとに自動更新されます。
        </p>
      </LegalSection>

      <LegalSection heading="第4条（解約・返金）">
        <p>
          利用者は、設定画面の請求管理からいつでも解約できます。返金の取扱いは
          <a className="mx-1 text-[#46605a] underline" href="/legal/refund">返金・キャンセルポリシー</a>
          に従います。
        </p>
      </LegalSection>

      <LegalSection heading="第5条（禁止事項）">
        <p>利用者は、本サービスの利用にあたり、以下の行為をしてはなりません。</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>法令または公序良俗に違反する行為</li>
          <li>運営者、他の利用者または第三者の権利・利益を侵害する行為</li>
          <li>本サービスの運営を妨害し、またはサーバー等に過度の負荷をかける行為</li>
          <li>不正アクセス、リバースエンジニアリングその他これらに類する行為</li>
          <li>本サービスを通じて反社会的勢力に利益を供与する行為</li>
        </ul>
      </LegalSection>

      <LegalSection heading="第6条（利用者コンテンツ）">
        <p>
          利用者が本サービスに登録・保存した文章その他のデータ（以下「利用者コンテンツ」）の権利は利用者に帰属します。運営者は、本サービスの提供・維持・改善に必要な範囲でこれらを取り扱います。
        </p>
      </LegalSection>

      <LegalSection heading="第7条（サービスの変更・中断・終了）">
        <p>
          運営者は、利用者への事前の通知なく、本サービスの内容を変更し、または提供を中断・終了することができます。これにより利用者に生じた損害について、運営者は本規約に別途定める場合を除き責任を負いません。
        </p>
      </LegalSection>

      <LegalSection heading="第8条（免責事項）">
        <p>
          本サービスは現状有姿で提供されます。運営者は、本サービスに事実上または法律上の瑕疵がないことを明示的にも黙示的にも保証しません。運営者の責任は、運営者の故意または重過失による場合を除き、利用者が直近1か月間に支払った利用料金を上限とします。
        </p>
      </LegalSection>

      <LegalSection heading="第9条（規約の変更）">
        <p>
          運営者は、必要と判断した場合、本規約を変更できます。変更後の規約は本サービス上に掲示した時点から効力を生じます。
        </p>
      </LegalSection>

      <LegalSection heading="第10条（準拠法・管轄）">
        <p>
          本規約の準拠法は{legalInfo.governingLaw}とします。本サービスに関して紛争が生じた場合には、{legalInfo.jurisdiction}を第一審の専属的合意管轄裁判所とします。
        </p>
      </LegalSection>
    </LegalPage>
  );
}
