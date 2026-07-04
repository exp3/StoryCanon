# StoryCanon 実装後レビュー

作成日: 2026-07-04

## 検証結果

以下は実行済み。

```text
npm run build -w apps/web
npm run build -w infra
npm run test:integration
```

結果はいずれも成功。

## 完了したもの

- Prisma schema に `deletedAt` と `MutationLog` が追加された。
- soft delete 用 migration が追加された。
- Web API / MCP API の読み取り、文脈取得、エクスポートで `deletedAt = null` を扱う実装が入った。
- 主要リソースの Web API PATCH / DELETE が追加された。
- `DELETE` は物理削除ではなく論理削除になった。
- MCP `delete-project-data` が追加された。
- MCP `rollback-command` が追加された。
- MCP `undo-last-command` が `rollback-command` の簡易エイリアスとして追加された。
- `commandId` 指定ロールバック、`transactionId` 指定ロールバックが実装された。
- 作成、削除、更新のロールバック処理が `MutationLog` snapshot ベースで実装された。
- 後続操作が同一対象を変更している場合の rollback conflict と `force: true` が実装された。
- JSON export が Plus 以上に制限された。
- API token 認証で `deletedAt = null` が考慮された。
- build / integration test は通っている。

## 未完了・要対応

### P1: Web 認証が未完了

Web API はまだ `x-storycanon-user-id` または `"local-user"` を actor として使っている。

対象:

- `apps/web/src/server/http.ts`

必要対応:

- NextAuth の `auth()` から現在ユーザーを取得する。
- 未ログイン時は Web API を 401 にする。
- テスト用の `x-storycanon-user-id` fallback は dev/test 限定にするか削除する。

### P1: Web UI が未完了

UI はまだ静的な骨組みに近い。

対象:

- `/projects`
- `/projects/new`
- `/projects/[projectId]`
- `/dashboard`

未完了:

- project 一覧取得
- project 作成フォーム送信
- project 詳細の実データ表示
- tabs の実データ接続
- scene / character / note / todo などの画面 CRUD
- settings / billing 画面
- login / logout 導線

### P1: API token 発行・失効 API/UI が未完了

Bearer token 認証の検証処理はあるが、ユーザーが token を発行・確認・失効する API/UI がない。

必要対応:

- token 作成 API
- token 一覧 API
- token 失効 API
- `/settings` の API token 管理 UI
- token は平文保存せず、作成時のみ表示する

### P1: Rollback の「直前指令」扱いに仕様差分の可能性

`rollback-command` は `commandId` / `transactionId` 指定では仕様に近い。

ただし `undo-last-command` は `commandId` / `transactionId` を指定しない `rollback-command` として、最後の `MutationLog` 1件だけを戻す実装になっている。

1つのユーザー指令で複数操作が同一 `transactionId` にまとまる場合、「直前指令を取り消す」は transaction 全体を戻す期待になりやすい。

例:

- `create-private-project` は Project と初期 StoryStateSnapshot を同一 transaction で作る。
- `save-generated-scene` は chapter 自動作成と scene 作成を同一 transaction にする。

現状の `undo-last-command` は、こうした transaction 全体ではなく最後の mutation だけを戻す可能性がある。

必要対応:

- `undo-last-command` は最後の `MutationLog` の `transactionId` がある場合、その transaction 全体をロールバックする。
- `transactionId` がない場合のみ単一 command をロールバックする。
- このケースの route-level テストを追加する。

### P1: Integration test が実 API を検証していない

`tests/integration/storycanon.integration.test.mjs` はインメモリ実装の仕様テストであり、実際の Next.js route handler / Prisma / migration / auth-token / handlers を通していない。

必要対応:

- `handleWebApi` / `handleMcpApi` を直接呼ぶテスト
- Prisma test DB を使うテスト
- MCP bearer token 認証テスト
- route handler の request/response テスト
- rollback transaction 全体の実装テスト

### P2: AuditLog / rate limit / CSRF は未完了

仕様上のセキュリティ・運用項目はまだ残っている。

未完了:

- AuditLog 記録
- Web API / MCP API rate limit
- CSRF 方針の整理
- request body / 本文を通常ログに出さないことのテスト

### P2: Stripe / billing は未完了

Subscription モデルと plan 判定はあるが、Stripe checkout / webhook / billing UI は未実装。

MVPで DB 手動変更運用にする場合も、管理手順または script が未整備。

### P2: 検索は未完了

仕様にある ILIKE 検索は未実装。

対象:

- project 内 scenes 検索
- character 名検索
- memo 検索

## 注意点

- Character は `@@unique([projectId, name])` のままなので、論理削除済み character と同名の character を再作成できない可能性がある。仕様上、削除後の同名再作成を許すなら設計変更が必要。
- MutationLog は snapshot を JSON に保存するため、本文全文が入る可能性がある。仕様上「本文を通常ログに出さない」方針とは分離されているが、暗号化・保持期間・削除方針は未実装。
- `docs/implementation_review_remaining_tasks.md` は末尾に completion update が追記されているが、本文前半には古い未完了リストが残っている。今後はこのファイルか本レビューのどちらを正にするか整理した方がよい。

