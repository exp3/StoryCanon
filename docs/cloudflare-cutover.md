# Cloudflare 切り替え手順書

AWS（ALB + ECS Fargate + RDS）から Cloudflare Workers + Supabase へ本番を切り替える手順。
**所要時間の目安は約50分**、うち利用者から見えるダウンタイムは 10〜15 分。

リハーサルで実測した値と、その過程で潰した問題を反映してある。判断を挟まずに上から流せる形にしてあるので、
想定と違う結果が出たら止めて原因を確認すること。

---

## 0. 事前条件（当日より前に済ませる）

| 条件 | 確認方法 |
|---|---|
| DNS の委任が Cloudflare に完了 | `nslookup -type=NS -norecurse softglow.jp a.dns.jp` が Cloudflare の NS を返す |
| Supabase が **Pro プラン** | 無料枠には自動バックアップが無い。現行 RDS は7日保持なので、Free のままだとデータ保護が後退する |
| Worker のシークレット6件が投入済み | `npx wrangler secret list`（`apps/web` で実行） |
| Hyperdrive のクエリキャッシュが無効 | `npx wrangler hyperdrive get b1add919bdaa46eaa3be4ec541824615` が `"caching": {"disabled": true}` |
| 移行タスク定義 | `storycanon-prod-dbtools:4` 以降が存在 |

Stripe の Webhook URL はドメインが変わらないため **変更不要**。
Google OAuth のリダイレクト URI も本番用が既に登録済みのため **変更不要**。

### 当日使う識別子

```
クラスタ          storycanon-prod-cluster
サービス          storycanon-prod-app
移行タスク定義    storycanon-prod-dbtools
サブネット        subnet-07d6bc7d0d4f6aff2,subnet-028ee8602ea756d56
セキュリティG     sg-02258949a02c69492
Hyperdrive ID     b1add919bdaa46eaa3be4ec541824615
Worker            storycanon（https://storycanon.beautiful-life.workers.dev）
```

---

## 1. 事前準備（ダウンタイム前・利用者に影響なし）

### 1-1. Worker を本番設定でビルドしてデプロイ

`apps/web/wrangler.jsonc` の `PAYMENT_MODE` を `"live"` に変更する。
検証中は `"mock"` にしてあり、これが課金開始のキルスイッチになっている。

```bash
npm run deploy:worker -w apps/web
```

`deploy:worker` は `.env` を退避してからビルドする。**`npx opennextjs-cloudflare build` を直接叩かないこと** —
ローカルの `.env` が焼き込まれ、`NEXTAUTH_SECRET` が開発用の値になる。

この時点では Supabase が空なので Worker は正常に応答しない。それでよい。

### 1-2. 切り戻し用に現在の DNS を控える

```
storycanon.softglow.jp  CNAME  storycanon-prod-alb-1113339467.ap-northeast-1.elb.amazonaws.com  (DNS only)
```

---

## 2. 書き込み停止（ここからダウンタイム）

```bash
aws ecs update-service --region ap-northeast-1 \
  --cluster storycanon-prod-cluster --service storycanon-prod-app --desired-count 0
```

タスクが 0 になるまで待つ。以降 ALB は 503 を返す。

```bash
aws ecs describe-services --region ap-northeast-1 \
  --cluster storycanon-prod-cluster --services storycanon-prod-app \
  --query "services[0].runningCount" --output text
```

**RDS は停止しない。** 切り戻し先として動かしたままにする。

---

## 3. データ移行（実測 2 秒）

`apps/web/scripts/cutover-migrate.json` を overrides として一発で流す。
中身は RDS からのダンプ → Supabase の public スキーマ再作成 → リストア → 件数照合。

```bash
aws ecs run-task --region ap-northeast-1 --cluster storycanon-prod-cluster \
  --task-definition storycanon-prod-dbtools --launch-type FARGATE --count 1 \
  --started-by cutover \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-07d6bc7d0d4f6aff2,subnet-028ee8602ea756d56],securityGroups=[sg-02258949a02c69492],assignPublicIp=ENABLED}" \
  --overrides file://apps/web/scripts/cutover-migrate.json \
  --query "tasks[0].taskArn" --output text
```

停止を待ってログを読む。ログストリームは `web/dbtools/<タスクID>`。

```bash
aws logs get-log-events --region ap-northeast-1 \
  --log-group-name /ecs/storycanon-prod \
  --log-stream-name web/dbtools/<タスクID> \
  --query "events[].message" --output text
```

**全テーブルが `OK` であることを確認する。** ひとつでも `MISMATCH` なら先に進まず、7章へ。

移行タスクは Supabase の **Session pooler（IPv4）** を使う。直接接続は IPv6 のみで、
この VPC には IPv6 が無いため到達できない。Worker 側は Hyperdrive 経由で直接接続を使っており、こちらは IPv6 で繋がる。

---

## 4. DNS を Worker に向ける

Cloudflare ダッシュボードで作業する。

1. `DNS > Records` から `storycanon` の CNAME レコードを **削除**
2. `Workers & Pages > storycanon > Settings > Domains & Routes` で
   **Add > Custom Domain** に `storycanon.softglow.jp` を追加

Custom Domain を追加すると Cloudflare が DNS レコードと証明書を自動で用意する。
既存の CNAME が残っていると競合するため、削除が先。

証明書の発行に数分かかることがある。

---

## 5. 動作確認

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://storycanon.softglow.jp/api/health
curl -s -o /dev/null -w "%{http_code}\n" https://storycanon.softglow.jp/
curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer invalid-token-value" \
  https://storycanon.softglow.jp/api/mcp/list-private-projects
```

3つ目は **401 であること**。500 なら DB に到達できていない。
`/api/health` は DB を触らないため、200 でも接続の証明にはならない。

ブラウザで以下を確認する。

- Google ログイン
- 既存プロジェクトが一覧に出る（**データ移行が効いている証拠**）
- シーンの編集と保存
- 設定画面でプランが正しく表示される
- MCP トークンの発行

`api.softglow.jp` も巻き込み事故が無いか確認する。

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://api.softglow.jp/
```

---

## 6. 後片付け（当日中）

- Stripe ダッシュボードで Webhook が届いているか確認（URL 変更なし）
- Cloudflare の Workers ログでエラーが出ていないか確認
- **RDS と ECS サービスはこの日は消さない**。1〜2週間並走観察してから撤去する

---

## 7. 切り戻し

DNS を戻して ECS を起こすだけで元に戻る。RDS は読み取りしかしていないため無傷。

1. Cloudflare で Custom Domain を削除
2. `storycanon` の CNAME を再作成（**DNS only**）
   ```
   storycanon  CNAME  storycanon-prod-alb-1113339467.ap-northeast-1.elb.amazonaws.com
   ```
3. ECS を戻す
   ```bash
   aws ecs update-service --region ap-northeast-1 \
     --cluster storycanon-prod-cluster --service storycanon-prod-app --desired-count 1
   ```

**切り戻しが無傷なのは、切り替え後に Supabase へ書き込まれた分を捨てられる間だけ。**
利用者が新しいデータを作り始めたら、戻すには Supabase から RDS への逆移行が必要になる。
異常に気づいたら早く判断すること。

---

## 付録: リハーサルで潰した問題

当日に遭遇していたら時間を溶かしていたもの。同種の問題を疑うときの参考に残す。

| 問題 | 原因 | 対処 |
|---|---|---|
| `apk add` が exit 99 | アプリのイメージは `USER nextjs` で動き、パッケージを入れられない | 公式 postgres イメージを使う専用タスク定義を作った |
| `invalid sslmode value` | `DATABASE_URL` の `sslmode=no-verify` は node-postgres 拡張で libpq には無い。`schema` も Prisma 独自 | クエリ文字列を `?sslmode=require` に差し替える |
| ホスト名解決の失敗 | Supabase のパスワードに `@` が含まれ、URI の区切りと誤認された | 接続文字列を組み立てず `PG*` 環境変数を使う |
| `Network unreachable` | Supabase の直接接続は IPv6 のみ、VPC に IPv6 が無い | 移行タスクだけ Session pooler（IPv4）を使う |
| シークレット取得の失敗 | 手動作成したシークレットは CDK が作った実行ロールの許可対象外 | 別建てのインラインポリシーで付与（次回デプロイで巻き戻らない） |
| オンボーディングのループ | Hyperdrive のクエリキャッシュが既定で有効。60秒、書き込みで無効化されない | `--caching-disabled`。認証と課金判定にも同じ影響があった |
| OAuth のコールバックが localhost | `next build` がローカルの `.env` を焼き込む。Docker 経路は `.dockerignore` のおかげで無事だった | `scripts/build-worker.mjs` が `.env` を退避してビルドする |
