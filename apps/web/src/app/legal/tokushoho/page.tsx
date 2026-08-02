import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { legalInfo } from "@/lib/legal-info";

export const metadata: Metadata = {
  title: "特定商取引法に基づく表記",
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-[#eceae2] py-3 sm:grid-cols-[220px_1fr] sm:gap-4">
      <dt className="font-medium text-[#1d1d1b]">{label}</dt>
      <dd className="text-[#3f3f39]">{children}</dd>
    </div>
  );
}

export default function TokushohoPage() {
  const onRequest = "ご請求をいただいた場合には、遅滞なく開示いたします。";
  return (
    <LegalPage
      title="特定商取引法に基づく表記"
      intro="特定商取引法第11条（通信販売についての広告）に基づき、以下のとおり表示します。"
    >
      <dl>
        <Row label="販売事業者">{legalInfo.operatorName}</Row>
        <Row label="運営統括責任者">{legalInfo.operatorResponsibleName}</Row>
        <Row label="所在地">
          {legalInfo.discloseOnRequest ? onRequest : legalInfo.address}
        </Row>
        <Row label="電話番号">
          {legalInfo.discloseOnRequest ? onRequest : legalInfo.phone}
        </Row>
        <Row label="お問い合わせ">
          <a className="text-[#46605a] underline" href={legalInfo.contactPath}>
            お問い合わせフォーム
          </a>
          （メール：{legalInfo.contactEmail}）
        </Row>
        <Row label="販売URL">{legalInfo.serviceUrl}</Row>
        <Row label="販売価格">
          各プランの料金は申込画面および決済ページに税込で表示します。
          <ul className="mt-1 list-disc pl-5">
            <li>Plus：月額 {legalInfo.pricing.plusMonthly} ／ 年額 {legalInfo.pricing.plusYearly}</li>
            <li>Pro：月額 {legalInfo.pricing.proMonthly} ／ 年額 {legalInfo.pricing.proYearly}</li>
          </ul>
          <p className="mt-1 text-sm text-[#6b6b63]">{legalInfo.pricing.currencyNote}</p>
        </Row>
        <Row label="商品代金以外の必要料金">
          インターネット接続に必要な通信料金等はお客様のご負担となります。表示価格には消費税を含みます。
        </Row>
        <Row label="支払方法">クレジットカード（決済代行：Stripe）</Row>
        <Row label="支払時期">
          初回はお申し込み手続き完了時に決済されます。以後は選択されたプランの期間（月額または年額）ごとに自動更新され、更新日に決済されます。
        </Row>
        <Row label="役務の提供時期">決済完了後、直ちにご利用いただけます。</Row>
        <Row label="自動更新について">
          有料プランは、解約手続きが行われない限り、契約期間の満了時に同一条件で自動的に更新されます。次回更新日は設定画面の請求情報からご確認いただけます。
        </Row>
        <Row label="解約方法">
          設定画面 →「請求管理（Manage billing）」から、Stripe カスタマーポータルにアクセスし、いつでも解約できます。解約後は、当該請求期間の終了日まで有料機能をご利用いただけます。
        </Row>
        <Row label="返品・キャンセル（返品特約）">
          サービスの性質上、提供開始後の返品・返金は原則としてお受けできません。詳細は
          <a className="mx-1 text-[#46605a] underline" href="/legal/refund">
            返金・キャンセルポリシー
          </a>
          をご確認ください。
        </Row>
        <Row label="動作環境">
          最新版の Google Chrome / Safari / Microsoft Edge / Firefox。JavaScript および Cookie を有効にしてご利用ください。
        </Row>
      </dl>
    </LegalPage>
  );
}
