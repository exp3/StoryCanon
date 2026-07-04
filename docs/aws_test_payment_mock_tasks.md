# AWS 検証環境テストと決済モック運用タスク

作成日: 2026-07-04

## 方針

P1/P2 の残タスクは、AWS 環境を使った結合テストまで含めて完了判定する。

ただし、決済だけは Stripe 本番連携を行わず、MVP ではモックとして扱う。

## ゴール

- AWS 上の ECS Express Mode + RDS PostgreSQL + Secrets Manager + S3 構成で動作確認できる。
- Web UI からログイン、作品作成、作品一覧、作品詳細、主要 CRUD、エクスポート、API token 管理ができる。
- MCP 風 API を bearer token で呼び出し、保存、論理削除、ロールバック、文脈取得ができる。
- 決済は Stripe ではなく、DB の Subscription / plan を操作する管理用モックで扱う。
- build / test / AWS smoke test の手順と結果を docs に残す。

## AWS 作成スクリプト

検証環境はユーザーが実行する。作成には次を使う。

```powershell
$env:GOOGLE_CLIENT_ID = "<google-oauth-client-id>"
$env:GOOGLE_CLIENT_SECRET = "<google-oauth-client-secret>"

.\scripts\create-aws-dev-ecs-express.ps1 `
  -Stage dev `
  -Region ap-northeast-1 `
  -AwsAccountId "199041707218" `
  -Profile "<aws-profile>" `
  -ConfirmCreate "create-storycanon-dev"
```

CDK bootstrap が未実施の場合:

```powershell
.\scripts\create-aws-dev-ecs-express.ps1 `
  -Stage dev `
  -Region ap-northeast-1 `
  -AwsAccountId "199041707218" `
  -Profile "<aws-profile>" `
  -Bootstrap `
  -ConfirmCreate "create-storycanon-dev"
```

カスタムドメインを使う場合:

```powershell
.\scripts\create-aws-dev-ecs-express.ps1 `
  -Stage dev `
  -Region ap-northeast-1 `
  -AwsAccountId "199041707218" `
  -Profile "<aws-profile>" `
  -AppDomainName "storycanon-dev.example.com" `
  -ConfirmCreate "create-storycanon-dev"
```

## ユーザー側で準備が必要な情報

- AWS account ID: `199041707218`
- AWS profile 名、または AWS CLI が認証済みであること。
- Google OAuth client ID。
- Google OAuth client secret。
- Google OAuth の承認済みリダイレクト URI: `https://<app-url>/api/auth/callback/google`
- カスタムドメインを使う場合は app domain name。Route53/ALB 連携は ECS Express Mode の作成結果を見て追加設定する。

ECS Express Mode URL を使う場合、スクリプト完了後に表示された URL を Google OAuth の redirect URI に追加する。

## 注意点

- 作成スクリプトは AWS リソースを作るため課金が発生する。
- 検証後は `scripts/delete-aws-dev.ps1` で速やかに削除する。
- RDS は private subnet にあるため、手元 PC から Prisma migration を直接実行しない。
- ECS Express Mode の container 起動時に `prisma migrate deploy` を実行し、その後 `node apps/web/server.js` を起動する。
- migration 失敗時は ECS/CloudWatch logs を確認する。

## 決済モック仕様

### 目的

Stripe checkout / webhook は今回実装しない。

代わりに、開発、検証、MVP 運用用に plan を手動変更できる安全な管理 API / script を用意する。

### 対象 plan

- FREE
- PLUS
- PRO

### 対象 status

- ACTIVE
- TRIALING
- PAST_DUE
- CANCELED
- INCOMPLETE

### 必須機能

- 管理者だけが userId を指定して plan / status を変更できる。
- 変更内容は AuditLog に記録する。
- 通常ユーザーや MCP token から plan を変更できない。
- `/billing` では現在 plan、status、制限使用量、モック決済であることを表示する。
- JSON export など plan gated feature は実際の Subscription の plan 値を参照する。

### 実装候補

どちらか、または両方を実装する。

1. 管理用 API
   - `POST /api/admin/subscriptions/mock-update`
   - `Authorization: Bearer <admin token>` または admin email allowlist
   - body: `{ "userId": "...", "plan": "PLUS", "status": "ACTIVE" }`

2. 管理用 script
   - `npm run mock:subscription -w apps/web -- --user <userId> --plan PLUS --status ACTIVE`
   - AWS 環境では DB 接続可能な trusted environment から実行する。

## P1 タスク

### 認証

- [ ] Web API の actor を `x-storycanon-user-id` / `local-user` から NextAuth session ベースへ変更する。
- [ ] 未ログイン Web API は 401 を返す。
- [ ] dev/test 限定 fallback が必要なものは `NODE_ENV !== "production"` で明示的に制限する。
- [ ] login / logout 導線を UI に追加する。

### Web UI

- [ ] `/projects` を実データ一覧に接続する。
- [ ] `/projects/new` から project を作成できるようにする。
- [ ] `/projects/[projectId]` で project 詳細を表示する。
- [ ] tabs を実データに接続する。
- [ ] scenes CRUD UI を実装する。
- [ ] characters CRUD UI を実装する。
- [ ] character notes CRUD UI を実装する。
- [ ] world notes CRUD UI を実装する。
- [ ] foreshadowings CRUD UI を実装する。
- [ ] plot threads CRUD UI を実装する。
- [ ] revision todos CRUD UI を実装する。
- [ ] story state snapshot 作成・一覧 UI を実装する。
- [ ] export UI を実装する。

### API token 管理

- [ ] API token 作成 API を実装する。
- [ ] API token 一覧 API を実装する。
- [ ] API token 失効 API を実装する。
- [ ] `/settings` に API token 管理 UI を追加する。
- [ ] token は平文保存せず、作成時のみ表示する。

### Rollback

- [ ] `undo-last-command` は直前 `MutationLog` に `transactionId` がある場合、その transaction 全体を rollback する。
- [ ] transaction 全体 rollback の route-level test を追加する。
- [ ] rollback conflict の route-level test を追加する。

### 実 API テスト

- [ ] `handleWebApi` / `handleMcpApi` を実際に呼ぶテストを追加する。
- [ ] Prisma test DB を使った integration test を追加する。
- [ ] MCP bearer token 認証テストを追加する。
- [ ] JSON export plan 制限を実 handler でテストする。
- [ ] deletedAt データ除外を実 handler でテストする。

## P2 タスク

### 決済モック / billing

- [ ] Stripe checkout / webhook は今回実装しない方針を docs に明記する。
- [ ] Subscription mock update API または script を実装する。
- [ ] mock update は管理者専用にする。
- [ ] mock update を AuditLog に記録する。
- [ ] `/billing` に現在 plan / status / usage を表示する。
- [ ] PAST_DUE / CANCELED / INCOMPLETE 時の閲覧可・新規保存不可を実装する。

### セキュリティ・運用

- [ ] AuditLog を主要操作に追加する。
- [ ] Web API / MCP API rate limit を実装する。
- [ ] CSRF 方針を整理し、必要な対策を実装する。
- [ ] request body / 本文 / token を通常ログに出さないことをテストする。
- [ ] MutationLog snapshot の保持期間・削除方針を docs に記録する。

### 検索

- [ ] project 内 scenes の ILIKE 検索を実装する。
- [ ] character 名前検索を実装する。
- [ ] memo 検索を実装する。

### AWS / CI

- [x] ECS Express Mode に `NEXTAUTH_URL` を渡す。
- [x] ECS Express Mode に mock payment mode 用 env を渡す: `PAYMENT_MODE=mock`
- [x] Secrets Manager に必要な secret を定義する。
  - `NEXTAUTH_URL`
  - `NEXTAUTH_SECRET`
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
  - `APP_API_TOKEN_PEPPER`
- [x] AWS 作成スクリプトを追加する。
- [x] RDS migration 手順を確定する。ECS Express Mode の container 起動時に `prisma migrate deploy` を実行する。
- [ ] AWS smoke test 手順を docs に追加する。
- [ ] GitHub Actions または同等の CI で build / test を実行する。

## AWS smoke test

AWS 環境を使ってよい。

ただし、リソース作成や課金が発生する操作の前に対象 stage / region / account を明示する。

最低限の確認:

- [ ] CDK synth が通る。
- [ ] ECS Express Mode service が起動する。
- [ ] ECS Express Mode task から RDS に接続できる。
- [ ] Prisma migration が適用できる。
- [ ] Google OAuth login が成功する。
- [ ] Web UI から project 作成・一覧・詳細表示ができる。
- [ ] `/settings` で API token を発行できる。
- [ ] MCP API `list-private-projects` が bearer token で成功する。
- [ ] MCP API `save-generated-scene` が成功する。
- [ ] MCP API `delete-project-data` が成功し、context / export から除外される。
- [ ] MCP API `rollback-command` が成功する。
- [ ] `/billing` で mock plan が表示される。
- [ ] mock update で FREE / PLUS / PRO の挙動が切り替わる。

## AWS stop / delete tasks

検証後にコストを止めるため、停止・削除手順も用意する。

- [ ] `scripts/stop-aws-dev.ps1` で停止できる範囲と、ECS Express Mode は削除優先であることを確認する。
- [ ] 停止では ECS Express Mode / ALB / VPC/NAT Gateway の料金が残る可能性を docs に明記する。
- [ ] `scripts/delete-aws-dev.ps1` で ECS Express Mode service と dev CloudFormation stacks を削除できることを確認する。
- [ ] ECR repository は retain される可能性があるため、`-DestroyRetainedEcr` で削除できることを確認する。
- [ ] 削除後に CloudFormation, ECS Express Mode, RDS, VPC/NAT Gateway, ECR, S3, Secrets Manager に残存リソースがないか確認する。

停止:

```powershell
.\scripts\stop-aws-dev.ps1 -Stage dev -Region ap-northeast-1
```

削除:

```powershell
.\scripts\delete-aws-dev.ps1 -Stage dev -Region ap-northeast-1 -ConfirmDestroy "delete-storycanon-dev"
```

ECR も削除:

```powershell
.\scripts\delete-aws-dev.ps1 -Stage dev -Region ap-northeast-1 -ConfirmDestroy "delete-storycanon-dev" -DestroyRetainedEcr
```

## Codex 実装プロンプト

```text
StoryCanon の P1/P2 残タスクを完了してください。AWS 環境を使った検証は許可されています。ただし、決済のみ Stripe 本番連携ではなくモックとして扱ってください。

必ず最初に以下を読んでください。
- docs/storycanon_external_spec.md
- docs/storycanon_internal_spec.md
- docs/implementation_review_after_completion.md
- docs/aws_test_payment_mock_tasks.md
- docs/infrastructure.md

今回の最重要方針:
- AWS ECS Express Mode + RDS PostgreSQL + Secrets Manager + S3 で検証できる状態を目指す
- 決済は PAYMENT_MODE=mock として扱う
- Stripe checkout / webhook は実装しない
- Subscription / plan / status は mock 管理 API または script で変更できるようにする
- mock plan 変更は管理者専用にし、AuditLog に記録する
- /billing では現在 plan / status / usage と、mock 決済であることを表示する

優先実装:
1. Web API 認証を NextAuth session ベースに変更する
2. login / logout 導線を追加する
3. /projects, /projects/new, /projects/[projectId] を実 API に接続する
4. 主要リソースの CRUD UI を実装する
5. /settings に API token 作成・一覧・失効 UI を実装する
6. MCP bearer token の実 route / handler テストを追加する
7. undo-last-command が transactionId 付き直前指令を transaction 全体で rollback するよう修正する
8. rollback / soft delete / export plan gate の実 API テストを追加する
9. 決済モック API または script を実装する
10. /billing の mock plan 表示と usage 表示を実装する
11. PAST_DUE / CANCELED / INCOMPLETE 時の保存制限を実装する
12. AuditLog, rate limit, CSRF 方針を最低限実装、または docs に明確化する
13. ILIKE 検索を実装する
14. AWS smoke test 手順を docs に追加する
15. AWS 検証後の stop / delete 手順を検証し、必要なら scripts と docs を更新する

AWS 検証:
- AWS 環境を使ってよい
- ただし deploy / resource creation / paid operation の前には stage, region, account, 作成対象を明示する
- CDK synth, build, migration, ECS Express Mode, RDS 接続、MCP bearer token の smoke test まで確認する
- 検証後は scripts/stop-aws-dev.ps1 または scripts/delete-aws-dev.ps1 の手順でコストを止められることを確認する
- 実行できなかった AWS 手順は、理由と手動実行コマンドを docs に残す

品質条件:
- npm run build -w apps/web
- npm run build -w infra
- npm run test:integration
- 追加した実 API / Prisma テスト
これらを通してください。

注意:
- 本文や token を通常ログに出さない
- API token は平文保存せず、作成時のみ表示する
- 決済モックは production Stripe と混同しないよう PAYMENT_MODE=mock などで明示的に分ける
- 既存仕様、既存コード、既存設計に合わせ、余剰な全面改修は避ける
- 完了後、docs/aws_test_payment_mock_tasks.md または別レビュー docs に完了・未完了を整理する

最終報告では、実装内容、実行した検証、AWS で確認したこと、未完了・手動確認が必要なことを簡潔にまとめてください。
```
