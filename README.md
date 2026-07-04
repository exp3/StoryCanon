# StoryCanon

StoryCanon は、ChatGPT で生成・相談した小説の設定、本文、キャラクター、世界観、伏線、TODO、現在の物語状態を作品ごとに保存するための MVP 実装です。

## 構成

- `apps/web`: Next.js + TypeScript + Prisma + PostgreSQL の Web/API アプリ
- `infra`: AWS CDK v2 による App Runner / ECR / RDS / VPC / S3 / Secrets Manager 構成
- `docs`: 内部仕様、外部仕様、AWS 構築メモ
- `tests/integration`: ローカル結合テスト

## ローカル開発

```powershell
npm install
Copy-Item .env.example apps/web/.env
docker compose up -d postgres
npm run prisma:migrate -w apps/web
npm run dev -w apps/web
```

## テスト

AWS リソースは作成せず、ローカルの結合テストのみ実行します。

```powershell
npm run test:integration
```

## AWS

CDK と AWS CLI の手順は [docs/infrastructure.md](D:\dev\StoryCanon\docs\infrastructure.md) にまとめています。実行前に AWS アカウント、ドメイン、Secrets Manager の値を確認してください。
