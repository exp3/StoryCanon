import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal-page";
import { legalInfo } from "@/lib/legal-info";

export const metadata: Metadata = {
  title: "セキュリティ | StoryCanon",
};

export default function SecurityPage() {
  return (
    <LegalPage
      title="セキュリティ"
      intro={`${legalInfo.serviceName} は、利用者のデータを保護するために以下の技術的・組織的な対策を講じています。`}
    >
      <LegalSection heading="通信の暗号化">
        <p>
          本サービスへのすべての通信は TLS（HTTPS）で暗号化しています。ログイン状態を保持する Cookie には Secure / HttpOnly 属性を付与しています。
        </p>
      </LegalSection>

      <LegalSection heading="データの保管と暗号化">
        <p>
          データはクラウド基盤（Amazon Web Services、東京リージョン）で保管します。データベースおよびファイルストレージ（エクスポートファイル等）は保存時に暗号化しています。データベースはインターネットから直接アクセスできない隔離ネットワーク内に配置しています。
        </p>
      </LegalSection>

      <LegalSection heading="認証">
        <p>
          ログインは Google アカウントによる認証（OAuth）を利用しており、本サービスが利用者のパスワードを保持することはありません。外部連携用のAPIトークンは、そのままの値ではなくハッシュ化して保管しています。
        </p>
      </LegalSection>

      <LegalSection heading="決済情報の取り扱い">
        <p>
          クレジットカード情報の処理は、PCI DSS に準拠した決済事業者 Stripe が行います。本サービスがカード番号を受け取り、または保持することはありません。
        </p>
      </LegalSection>

      <LegalSection heading="秘密情報の管理">
        <p>
          APIキーやデータベース接続情報などの機密情報は、専用のシークレット管理サービスで管理し、ソースコードには含めません。
        </p>
      </LegalSection>

      <LegalSection heading="脆弱性の報告">
        <p>
          セキュリティ上の問題を発見された場合は、悪用や公開を控えたうえで、
          <a className="mx-1 text-[#46605a] underline" href={legalInfo.contactPath}>お問い合わせフォーム</a>
          よりご報告ください。確認のうえ、速やかに対応します。
        </p>
      </LegalSection>
    </LegalPage>
  );
}
