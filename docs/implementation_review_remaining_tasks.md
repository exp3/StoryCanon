# StoryCanon 実装レビューと残タスク

作成日: 2026-07-04

このレビューは静的確認のみで行った。ユーザー指示に従い、アプリ起動、ビルド、テスト、DB 接続、CDK synth/deploy は実行していない。

## レビュー対象

- 仕様: `docs/storycanon_external_spec.md`, `docs/storycanon_internal_spec.md`, `docs/infrastructure.md`
- 実装: `apps/web`, `infra`, `tests/integration`

## 全体評価

MVP の土台はかなり作られている。Next.js / Prisma / PostgreSQL / NextAuth / CDK / App Runner / RDS / S3 / MCP 風 API の主要な骨格は存在する。

一方で、現状は「データモデルと API の一部が先行しているプロトタイプ」に近く、仕様上の MVP としては未完了である。特に Web UI、Web 認証の実使用、CRUD の更新・削除、MCP論理削除、MCPロールバック、課金、監査ログ、レート制限、API トークン発行、JSON export 制限が不足している。

前回レビュー時に文字化け・構文破損疑いとして記録した TypeScript / TSX / test ファイルは、UTF-8 として再確認したところ実ファイル内の文言は正常だった。PowerShell の表示エンコードによる誤判定だったため、アプリ側の修正は不要。

## 実装済み・概ね準拠

- Prisma schema は仕様の主要モデルをほぼ網羅している。
  - User / Account / Session / VerificationToken
  - Subscription / ApiToken
  - Project / Chapter / Scene
  - Character / CharacterNote / WorldNote
  - PlotThread / Foreshadowing / RevisionTodo / StoryStateSnapshot
  - ExportJob / AuditLog
- Project は `visibility = PRIVATE` 固定の方針に沿っている。
- 主要 enum は仕様に近い形で定義されている。
- Web API の一部 CRUD は実装されている。
  - projects: GET / POST / GET by id / PATCH / DELETE
  - chapters, scenes, characters, world-notes, foreshadowings, plot-threads, revision-todos, story-state-snapshots: project 配下の GET / POST
  - latest story state: GET
  - markdown/json export: GET
- MCP 風 API の主要 action は実装されている。
  - list-private-projects
  - create-private-project
  - get-private-project-context
  - get-next-generation-context
  - save-generated-scene
  - save-character-note
  - save-world-note
  - save-foreshadowing
  - save-plot-thread
  - save-revision-todo
  - save-story-state-snapshot
- プラン制限の一部は実装されている。
  - project 数
  - scene 本文文字数
  - characters / worldNotes / foreshadowings / plotThreads / revisionTodos / storySnapshots の件数
- NextAuth + Google OAuth の設定ファイルは存在する。
- API トークン認証の検証処理は存在する。
- CDK は仕様の主要スタックを概ね持っている。
  - NetworkStack
  - DatabaseStack
  - StorageStack
  - SecretsStack
  - AppRunnerStack
  - DnsStack
- ローカル PostgreSQL 用 `docker-compose.yml` と Web 用 Dockerfile が存在する。

## 部分実装・要補完

### Web API

- 仕様では各リソースに PATCH / DELETE / 単体 GET があるが、実装は project 配下の一覧 GET / 作成 POST に偏っている。
- 未実装または不足している代表例:
  - `PATCH /api/chapters/:chapterId`
  - `DELETE /api/chapters/:chapterId`
  - `GET /api/scenes/:sceneId`
  - `PATCH /api/scenes/:sceneId`
  - `DELETE /api/scenes/:sceneId`
  - `GET /api/characters/:characterId`
  - `PATCH /api/characters/:characterId`
  - `DELETE /api/characters/:characterId`
  - Character Notes の Web API 一式
  - World Notes / Foreshadowings / Plot Threads / Revision Todos の PATCH / DELETE
- project 所有者チェックは一部あるが、単体リソース操作を追加する際は必ず project 経由で `userId` を検証する必要がある。

### MCP 風 API

- 主要保存 action はあるが、API トークンをユーザーが発行・失効する UI/API がない。
- 仕様変更により、MCP 側からも作品データを論理削除できる必要があるが、未実装。
- 仕様変更により、MCP 側から保存・更新・削除指令をロールバックできる必要があるが、未実装。
- MCP / Web API のミューテーションをロールバックするための `MutationLog` 相当の操作ログモデルが未実装。
- `save-character-note` 以外の保存 action は Web API に委譲しているため、MCP 用の入力仕様との差異が増えた場合に吸収層が必要。

### Web UI

- 画面ルートの骨格はあるが、多くが静的表示で API と接続されていない。
- `/projects` は一覧取得を行っていない。
- `/projects/new` はフォーム送信処理がなく、保存ボタンも `type="button"` で作成されない。
- `/projects/[projectId]` はタブ UI の見た目のみで、各タブの一覧・編集・保存・削除がない。
- Dashboard の件数表示が固定値。
- 仕様にある `/settings` と `/billing` が未実装。
- Login / logout 導線が UI に見当たらない。

### 認証・認可

- NextAuth 設定はあるが、Web API は `x-storycanon-user-id` ヘッダーまたは `"local-user"` を actor として扱っている。
- 本番 Web API では `auth()` のセッションから現在ユーザーを取得する実装に切り替える必要がある。
- API トークンはハッシュ検証のみ実装済みで、発行・表示・失効・権限説明の UI/API が不足している。
- MCP権限表示に、作品データの論理削除と連携指令のロールバックを追加する必要がある。

### エクスポート

- Markdown export は実装されている。
- JSON export は実装されているが、仕様上の「Plus 以上のみ」の制限がない。
- ExportJob / S3 bucket はモデルとインフラに存在するが、同期レスポンスで返す実装であり、ジョブ管理や S3 保存とは未接続。

### プラン・課金

- Subscription モデルとプラン判定はある。
- Stripe SDK / checkout / webhook / billing 画面は未実装。
- 仕様では MVP は DB 上の plan 手動変更から始めてもよいが、その運用手順・管理 UI・最低限の seed/script がない。
- past_due / canceled / incomplete 時の閲覧のみ許可、新規保存制限などの挙動が未実装。

### セキュリティ・運用

- レート制限が未実装。
- AuditLog モデルはあるが、API 操作時に記録されていない。
- MCP / Web API ロールバック用の操作ログが未実装。
- 本文や request body をログに出さない方針のテスト・ガードがない。
- CSRF 対応は NextAuth 側に依存しているが、独自 Web API の扱いが未整理。
- App Runner 環境変数に仕様上必要な `NEXTAUTH_URL` が見当たらない。

### 検索

- 仕様にある LIKE / ILIKE 検索が未実装。

### テスト

- `tests/integration/storycanon.integration.test.mjs` はインメモリの仕様確認に近く、実際の Next.js route handler / Prisma / 認証 / plan service を検証していない。
- 今回は実行禁止のため、テストの成否は未確認。

### 文字化け・構文破損確認

以下のファイルは UTF-8 として再確認し、典型的な文字化け断片が残っていないことを確認済み。前回の構文破損疑いは PowerShell の既定表示エンコードによる誤判定だった。

- `apps/web/src/server/handlers.ts`
- `apps/web/src/server/export.ts`
- `apps/web/src/app/page.tsx`
- `apps/web/src/app/dashboard/page.tsx`
- `apps/web/src/app/projects/page.tsx`
- `apps/web/src/app/projects/new/page.tsx`
- `apps/web/src/app/projects/[projectId]/page.tsx`
- `tests/integration/storycanon.integration.test.mjs`

## 残タスク

### P0: MVP 動作前提の修正

- [x] 文字化けにより壊れている可能性が高い TS / TSX / test の文字列と JSX を再確認する。
- [ ] `npm run build -w apps/web` が通る状態にする。
- [ ] `npm run build -w infra` が通る状態にする。
- [ ] `npm run test:integration` が通る状態にする。
- [ ] Web API の actor を `"local-user"` から NextAuth セッションベースに変更する。
- [ ] `/projects/new` から実際に project を作成できるようにする。
- [ ] `/projects` でログインユーザーの project 一覧を表示する。
- [ ] `/projects/[projectId]` で project 詳細、story state、scene 一覧を実データ表示する。

### P1: 仕様上の MVP API 完了

- [ ] 削除可能な業務モデルに `deletedAt` を追加し、物理削除から論理削除へ切り替える。
- [ ] 一覧・詳細・文脈取得・エクスポートで `deletedAt = null` のデータのみ扱う。
- [ ] Chapters の PATCH / DELETE を実装する。
- [ ] Scenes の単体 GET / PATCH / DELETE を実装する。
- [ ] Characters の単体 GET / PATCH / DELETE を実装する。
- [ ] Character Notes の Web API 一式を実装する。
- [ ] World Notes の PATCH / DELETE を実装する。
- [ ] Foreshadowings の PATCH / DELETE を実装する。
- [ ] Plot Threads の PATCH / DELETE を実装する。
- [ ] Revision Todos の PATCH / DELETE を実装する。
- [ ] Story State Snapshot の論理削除を実装する。
- [ ] すべての単体操作で project 所有者チェックを追加する。
- [ ] JSON export を Plus 以上に制限する。
- [ ] API トークン発行・失効 API を実装する。
- [ ] MCP `delete-project-data` を実装する。
- [ ] MCP `rollback-command` を実装する。
- [ ] MCP `undo-last-command` を `rollback-command` の簡易エイリアスとして実装する。
- [ ] ロールバック用の `MutationLog` 相当モデルを追加する。
- [ ] `MutationLog` に `commandId`, `transactionId`, `beforeSnapshot`, `afterSnapshot`, `rolledBackAt` を保存する。
- [ ] 1つのユーザー指令で複数レコードを変更する場合に同じ `transactionId` を付与する。
- [ ] `commandId` 指定の単一操作ロールバックを実装する。
- [ ] `transactionId` 指定の一括ロールバックを実装する。
- [ ] 作成操作のロールバックは作成データの論理削除として実装する。
- [ ] 論理削除操作のロールバックは `deletedAt = null` への復元として実装する。
- [ ] 更新操作のロールバックは `beforeSnapshot` の復元として実装する。
- [ ] ロールバック対象の後続操作競合を検出し、通常はエラー、`force: true` で強制実行できるようにする。

### P1: Web UI 完了

- [ ] Login / logout 導線を追加する。
- [ ] Dashboard を実データの集計に接続する。
- [ ] Project detail tabs を実データに接続する。
- [ ] Scene editor を実装する。
- [ ] Character list / form を実装する。
- [ ] Character note list / form を実装する。
- [ ] World note list / form を実装する。
- [ ] Foreshadowing list / form を実装する。
- [ ] Plot thread list / form を実装する。
- [ ] Revision todo list / form を実装する。
- [ ] Story state panel / snapshot 作成フォームを実装する。
- [ ] Export panel を実装する。
- [ ] `/settings` を実装し、API token 管理を置く。
- [ ] `/billing` を実装し、現在 plan と制限使用量を表示する。

### P1: 課金・プラン制限

- [ ] Stripe を本実装するか、MVP として DB 手動変更運用にするかを決めて docs に明記する。
- [ ] Stripe を本実装する場合は checkout と webhook を実装する。
- [ ] DB 手動変更運用にする場合は管理手順または script を追加する。
- [ ] past_due / canceled / incomplete 時の保存制限を実装する。
- [ ] Plan usage を API と UI に出す。

### P1: セキュリティ・監査

- [ ] Web API / MCP API のレート制限を実装する。
- [ ] AuditLog 記録を主要操作に追加する。
- [ ] Web API / MCP API のミューテーション操作をロールバック可能な形で記録する。
- [ ] 本文・トークン・request body 全体をログに出さない方針をテストで固定する。
- [ ] ロールバック用ログに本文全文を保存する場合の暗号化・保持期間・削除方針を決める。
- [ ] API token の prefix 長、生成方式、再表示不可、失効動作を仕様化して実装する。
- [ ] CSRF 方針を Web API に対して明確化する。

### P2: 検索・エクスポート運用

- [ ] Project 内 scenes の ILIKE 検索を実装する。
- [ ] Character 名検索を実装する。
- [ ] Memo 検索を実装する。
- [ ] ExportJob と S3 を使うか、MVP は同期レスポンスに限定するかを docs に明記する。
- [ ] S3 を使う場合は export job 作成・status 更新・download URL 取得を実装する。

### P2: インフラ・CI/CD

- [ ] App Runner に `NEXTAUTH_URL` を渡す。
- [ ] App Runner custom domain の DNS 検証・証明書検証手順を docs に補足する。
- [ ] GitHub Actions workflow を追加する。
- [ ] CI で lint / test / build を実行する。
- [ ] Docker build / ECR push / App Runner deployment の自動化範囲を決める。
- [ ] Prisma migrate deploy の実行場所と手順を確定する。

### P2: テスト拡充

- [ ] Route handler の Web API テストを追加する。
- [ ] MCP API の bearer token 認証テストを追加する。
- [ ] 所有者違いの 404 / 403 テストを追加する。
- [ ] Plan limit exceeded の 403 テストを追加する。
- [ ] JSON export の plan 制限テストを追加する。
- [ ] MCP 論理削除のテストを追加する。
- [ ] MCP `rollback-command` の単一操作ロールバックテストを追加する。
- [ ] MCP `rollback-command` の `transactionId` 一括ロールバックテストを追加する。
- [ ] MCP `undo-last-command` の直前操作ロールバックテストを追加する。
- [ ] 更新操作の `beforeSnapshot` 復元テストを追加する。
- [ ] ロールバック競合検出テストを追加する。
- [ ] 削除済みデータが文脈取得・一覧・エクスポートに含まれないテストを追加する。
- [ ] Web UI の主要フォーム送信テストを追加する。

## 仕様との対応状況サマリ

| 領域 | 状況 | メモ |
|---|---|---|
| データモデル | 概ね実装済み | Prisma schema は MVP の主要モデルを網羅 |
| インフラ | 概ね実装済み | CDK の主要スタックあり。NEXTAUTH_URL など一部補完必要 |
| Web API | 部分実装 | 作成・一覧中心。更新・削除・単体取得が不足 |
| MCP 風 API | 部分実装 | 主要保存 action あり。トークン発行、論理削除、ロールバック、テスト不足 |
| Web UI | 未完に近い | 静的画面中心で API 未接続 |
| 認証 | 部分実装 | NextAuth 設定あり。Web API は local-user fallback |
| プラン制限 | 部分実装 | 保存制限の一部あり。課金状態制御と JSON export 制限なし |
| Stripe | 未実装 | モデルのみ |
| レート制限 | 未実装 | 仕様との差分 |
| AuditLog | 未実装 | モデルのみ |
| 検索 | 未実装 | ILIKE 検索なし |
| Export | 部分実装 | Markdown/JSON 同期返却あり。plan 制限なし |
| テスト | 不足 | 実 API ではなくインメモリ中心 |
# 2026-07-04 Additional Completion Update

The following implementation-review items are now completed:

- Added `deletedAt` to soft-deletable Prisma models and added the `MutationLog` model plus migration.
- Changed Web API and MCP reads, context responses, and exports to use only `deletedAt = null` data.
- Added missing Web API CRUD routes for chapters, scenes, characters, character notes, world notes, foreshadowings, plot threads, revision todos, and story state snapshots.
- Changed DELETE behavior from physical deletion to soft deletion.
- Added MCP `delete-project-data`.
- Added MCP `rollback-command`.
- Added MCP `undo-last-command` as the simple alias of `rollback-command`.
- Added rollback by `commandId` and reverse rollback by `transactionId`.
- Implemented rollback semantics for creates, deletes, and updates using MutationLog snapshots.
- Added rollback conflict detection for later mutations of the same target, with `force: true` override.
- Stored `commandId`, `transactionId`, `beforeSnapshot`, `afterSnapshot`, and `rolledBackAt` in `MutationLog`.
- Restricted JSON export to Plus or higher.
- Tightened owner checks and validation on added CRUD and MCP mutation paths.
- Added integration tests for soft deletion, JSON export restriction, rollback, undo alias behavior, transaction rollback, and rollback conflict handling.
- Verified `npm run build -w apps/web`, `npm run build -w infra`, and `npm run test:integration`.
