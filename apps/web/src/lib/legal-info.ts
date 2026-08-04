/**
 * Single source of truth for the operator / legal facts shown across the
 * 特定商取引法・利用規約・プライバシーポリシー・お問い合わせ pages.
 *
 * Values wrapped in 【要確認…】 are legally required facts that must be
 * supplied by the operator. Fill them in here and every page updates.
 * These pages are drafts for the operator to review with a legal
 * professional before launch — they are not legal advice.
 */
export const legalInfo = {
  serviceName: "StoryCanon",
  serviceUrl: "https://storycanon.softglow.jp",

  // 事業者（個人事業主）
  operatorType: "個人事業主" as const,
  operatorName: "Softglow",
  // 特商法上「運営統括責任者」は屋号ではなく個人事業主本人の実名を表示する。
  operatorResponsibleName: "木村成孝",
  operatorTitle: "運営統括責任者",
  // discloseOnRequest=true の間、所在地・電話番号は tokushoho ページでは
  // 「請求があれば開示」文言に置き換わり未使用（下の値は将来 false にした際の控え）。
  address: "",
  phone: "",
  discloseOnRequest: true,

  // 連絡先
  contactEmail: "storycanon@softglow.jp",
  contactPath: "/contact",
  contactFormUrl:
    "https://docs.google.com/forms/d/e/1FAIpQLSfTu033SkU_8qcN8KrBLdl354gmcfmOREhWA_qSGp9gpExEEg/viewform?usp=header",

  // 規約・準拠法
  governingLaw: "日本法",
  jurisdiction: "東京地方裁判所",

  // 料金（税込表示。/settings の Plan & Billing セクションと同一の値。決済は Stripe 上に最終金額を表示）
  pricing: {
    currencyNote: "表示価格・課税区分の最終値は決済ページ（Stripe）に表示されます。",
    plusMonthly: "$9.90",
    plusYearly: "$99",
    proMonthly: "$52.80",
    proYearly: "$528",
  },

  // 解析。NEXT_PUBLIC_ を付けないこと — その接頭辞だと Next.js がビルド時に値を
  // 埋め込むため、実行時の環境変数が効かなくなる。この値を読むのは layout.tsx
  // （サーバーコンポーネント）で、そこから props でクライアント側へ渡している。
  gaMeasurementId: process.env.GA_MEASUREMENT_ID ?? "",
  // 同じ理由で NEXT_PUBLIC_ を付けない。
  posthogKey: process.env.POSTHOG_KEY ?? "",
  posthogHost: process.env.POSTHOG_HOST ?? "",

  // 更新日（各ページ共通。改定時に更新）
  lastUpdated: "2026-07-12",
} as const;

export type LegalInfo = typeof legalInfo;

/** True once a real operator name has been filled in (used to warn on draft pages). */
export const legalInfoIsPlaceholder = legalInfo.operatorName.startsWith("【要確認");
