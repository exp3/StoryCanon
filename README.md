# StoryCanon

StoryCanon は、ChatGPT で生成・相談した小説の設定、本文、キャラクター、世界観、伏線、TODO、現在の物語状態を作品ごとに保存するための MVP 実装です。

## 構成

- `apps/web`: Next.js + TypeScript + Prisma + PostgreSQL の Web/API アプリ
- `packages/db`: Prisma クライアント。Node と Cloudflare Workers で別の生成物が要るため独立したパッケージにしてある（[後述](#prisma-クライアント)）
- `docs`: 内部仕様、外部仕様、移行の記録
- `tests/integration`: ローカル結合テスト

## デプロイ先

本番は **Cloudflare Workers + Supabase PostgreSQL（東京）** で稼働している。
`main` への push で `.github/workflows/deploy-workers.yml` がマイグレーションとデプロイを行う。

2026-08-30 までは AWS（ALB + ECS Fargate + RDS）だった。移行の経緯と当時ハマった点は
[docs/cloudflare-cutover.md](docs/cloudflare-cutover.md) に残してある。**AWS 側の資源は撤去済みで、
CDK のブートストラップも消してあるため、AWS へ戻すには `cdk bootstrap` からやり直しになる。**

## ローカル開発

```powershell
npm install
Copy-Item .env.example apps/web/.env
docker compose up -d postgres
npm run prisma:migrate -w apps/web
npm run dev -w apps/web
```

## テスト

```powershell
npm run test -w apps/web        # ユニット
npm run test:integration        # 結合（外部リソースは作らない）
```

## Prisma クライアント

Prisma 7 は TypeScript しか出力しないため、クライアントは `packages/db` でコンパイルしてから使う。
Node と workerd では**必要な生成物が違う**ので両方を作り、`package.json` の conditional export で
振り分けている。呼び出し側は `@storycanon/db` を import するだけでよい。

生成物は git 管理外で、`npm run dev` / `build` / `test` / `lint` が必要な方を自動で作る。
`tsc` を単体で走らせる場合だけ、先に `npm run db:node -w apps/web` が要る。

## Cloudflare へのデプロイ

通常は `main` への push で CI が行う。手元から出す場合は `apps/web` で:

```powershell
npm run deploy:worker
```

**`npx opennextjs-cloudflare build` を直接叩かないこと。** `deploy:worker` は
`scripts/build-worker.mjs` 経由でローカルの `.env` 類を退避してからビルドする。
これを飛ばすと `next build` がローカルの値をバンドルに焼き込み、`NEXTAUTH_SECRET` が
開発用の値のまま本番に乗る。
