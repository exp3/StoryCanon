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
  operatorName: "【要確認：運営者氏名（個人事業主）】",
  operatorTitle: "運営統括責任者",
  // 個人事業主は「請求があれば遅滞なく開示」運用も可。公開する場合は文言を実値に置換。
  address: "【要確認：所在地（郵便番号・住所）。もしくは「請求があった場合に遅滞なく開示します」】",
  phone: "【要確認：電話番号。もしくは「請求があった場合に遅滞なく開示します」】",
  discloseOnRequest: true,

  // 連絡先
  contactEmail: "【要確認：連絡先メールアドレス】",
  contactPath: "/contact",

  // 規約・準拠法
  governingLaw: "日本法",
  jurisdiction: "【要確認：合意管轄裁判所（例：東京地方裁判所）】",

  // 料金（税込表示。実値に置換すること。決済は Stripe 上に最終金額を表示）
  pricing: {
    currencyNote: "表示価格・課税区分の最終値は決済ページ（Stripe）に表示されます。",
    plusMonthly: "【要確認：Plus 月額（税込）】",
    plusYearly: "【要確認：Plus 年額（税込）】",
    proMonthly: "【要確認：Pro 月額（税込）】",
    proYearly: "【要確認：Pro 年額（税込）】",
  },

  // 解析
  gaMeasurementId: process.env.NEXT_PUBLIC_GA_ID ?? "",

  // 更新日（各ページ共通。改定時に更新）
  lastUpdated: "2026-07-12",
} as const;

export type LegalInfo = typeof legalInfo;

/** True once a real operator name has been filled in (used to warn on draft pages). */
export const legalInfoIsPlaceholder = legalInfo.operatorName.startsWith("【要確認");
