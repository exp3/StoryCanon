# StoryCanon 内部仕様書

## 1. 開発方針

### 1.1 基本方針

StoryCanon の MVP は、ChatGPT で生成・相談した物語データを保存・整理・再利用する Web アプリとして実装する。

MVPでは StoryCanon 側で AI 生成は行わない。

AI生成、レビュー、要約、キャラクター深掘りは ChatGPT 側が担当し、StoryCanon は以下を担当する。

- 作品データの永続保存
- 章・シーン管理
- キャラクター管理
- 世界観メモ管理
- 伏線管理
- プロットスレッド管理
- 修正TODO管理
- ストーリー状態スナップショット管理
- ChatGPT連携用API
- エクスポート

### 1.2 MVPの実装優先順位

1. Next.js + TypeScript + Prisma + PostgreSQL の雛形
2. AWS CDK + App Runner + RDS PostgreSQL の環境構築
3. Prisma schema
4. ローカルCRUD
5. 認証
6. 作品 / 章 / シーン
7. キャラクター / 世界観 / 伏線 / TODO
8. ストーリー状態スナップショット
9. プラン制限
10. Markdown export
11. MCP風API
12. Stripe連携

---

## 2. 技術スタック

### 2.1 Application

```text
Frontend:
- Next.js
- React
- TypeScript
- Tailwind CSS

Backend:
- Next.js Route Handlers
- TypeScript

ORM:
- Prisma

Database:
- PostgreSQL on Amazon RDS

Auth:
- NextAuth.js
- Google OAuth

Payment:
- Stripe

ChatGPT連携:
- MCP風REST API
- 将来的に Apps SDK / MCP Server へ拡張
```

### 2.2 Infrastructure

```text
AWS:
- AWS CDK v2 + TypeScript
- App Runner
- ECR
- RDS PostgreSQL
- VPC
- Secrets Manager
- S3
- Route 53
- ACM
- CloudWatch Logs
```

### 2.3 Region

```text
ap-northeast-1
```

---

## 3. システム構成

### 3.1 論理構成

```text
ChatGPT
  ↓ MCP / Apps SDK 将来対応
MCP風 API
  ↓
Application Service
  ↓
PostgreSQL

Web App
  ↓
Application Service
  ↓
PostgreSQL
```

### 3.2 AWS構成

```text
User
  ↓
Route 53
  ↓
App Runner Custom Domain
  ↓
App Runner Service
  ├─ Next.js Web UI
  ├─ API Routes
  ├─ MCP-like API
  └─ Prisma Client
       ↓ VPC Connector
     RDS PostgreSQL

App Runner
  ↓
Secrets Manager

Export API
  ↓
S3 Export Bucket

Logs
  ↓
CloudWatch Logs
```

### 3.3 MVPで採用するAWSリソース

- App Runner
- ECR
- RDS PostgreSQL Single-AZ
- Secrets Manager
- S3
- VPC
- Security Group
- CloudWatch Logs
- Route 53
- ACM

### 3.4 MVPで採用しないAWSリソース

- ECS Fargate
- ALB
- Aurora Serverless v2
- OpenSearch
- ElastiCache
- SQS
- Lambda Worker
- WAF
- CloudFront
- Multi-AZ RDS

---

## 4. リポジトリ構成

```text
storycanon/
  apps/
    web/
      src/
        app/
        components/
        server/
        lib/
      prisma/
        schema.prisma
      Dockerfile
      package.json
  infra/
    bin/
      storycanon.ts
    lib/
      network-stack.ts
      database-stack.ts
      app-runner-stack.ts
      storage-stack.ts
      secrets-stack.ts
      dns-stack.ts
    package.json
  docs/
    external-spec.md
    internal-spec.md
    infrastructure.md
```

MVPで単純化する場合は、`apps/web` をルートに置いてもよい。

---

## 5. AWS CDK設計

### 5.1 CDK言語

```text
TypeScript
```

### 5.2 Stack分割

#### NetworkStack

- VPC
- Public Subnet
- Private Subnet
- Security Group

#### DatabaseStack

- RDS PostgreSQL
- DB Subnet Group
- DB Security Group
- DB Secret

#### AppStack

- ECR Repository
- App Runner Service
- App Runner VPC Connector
- Environment Variables
- Secrets参照

#### StorageStack

- Export用S3 Bucket

#### DnsStack

- Route 53 Hosted Zone参照
- ACM Certificate
- App Runner custom domain

### 5.3 Stage

環境は `stage` で分ける。

```text
STAGE=dev
STAGE=prod
```

リソース名はすべて stage prefix を持つ。

例：

```text
storycanon-dev-db
storycanon-dev-app
storycanon-prod-db
storycanon-prod-app
```

---

## 6. AWSインフラ詳細

> **この章は実装前に書いた当初の設計で、現在の構成ではない。**
> 本番は 2026-08-30 に Cloudflare Workers + Supabase PostgreSQL（東京）へ移行済みで、
> AWS の資源は撤去されている。現在の構成は [README](../README.md)、移行の経緯は
> [docs/cloudflare-cutover.md](cloudflare-cutover.md) を参照。

### 6.1 App Runner

用途：Next.js Web / API / MCP風API を1つのDockerコンテナで動かす。

設定：

- Source: ECR image
- Port: 3000
- Auto deploy: 初期は手動でも可
- VPC Connector: RDS接続用
- Logs: CloudWatch Logs 有効

環境変数：

- NODE_ENV
- APP_ENV
- DATABASE_URL
- NEXTAUTH_URL
- NEXTAUTH_SECRET
- GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET
- APP_API_TOKEN_PEPPER
- EXPORT_BUCKET_NAME

Secret値は Secrets Manager から参照する。

### 6.2 ECR

用途：Next.js Docker image の保存。

リポジトリ名：

```text
storycanon-{stage}-web
```

### 6.3 RDS PostgreSQL

設定：

- Engine: PostgreSQL
- Single-AZ
- Storage: gp3
- Backup retention: devは1〜3日、prodは7日以上
- Public accessibility: false
- Deletion protection: prodのみtrue
- Encryption: enabled

接続は App Runner VPC Connector 経由のみ許可する。

### 6.4 VPC

構成：

```text
VPC
├─ Public Subnet
│  └─ App Runner VPC Connector
└─ Private Subnet
   └─ RDS PostgreSQL
```

### 6.5 Security Group

```text
AppRunnerSecurityGroup
  ↓ tcp/5432
RDSSecurityGroup
```

RDSは AppRunnerSecurityGroup からの5432のみ許可。

### 6.6 Secrets Manager

保存する値：

- DATABASE_URL
- NEXTAUTH_SECRET
- GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET
- APP_API_TOKEN_PEPPER

### 6.7 S3

用途：

- Markdown export
- JSON export
- 将来の一括バックアップ

MVPでは同期レスポンスでexportしてもよい。S3は将来用に作成しておく。

### 6.8 Route 53 / ACM

独自ドメインの例：

```text
app.storycanon.example
api.storycanon.example
```

MVPでは `app` のみでもよい。

---

## 7. CI/CD

> **この章は実装前に書いた当初の設計で、現在の構成ではない。**
> 本番は 2026-08-30 に Cloudflare Workers + Supabase PostgreSQL（東京）へ移行済みで、
> AWS の資源は撤去されている。現在の構成は [README](../README.md)、移行の経緯は
> [docs/cloudflare-cutover.md](cloudflare-cutover.md) を参照。

### 7.1 GitHub Actions

デプロイの流れ：

```text
1. pnpm install
2. pnpm lint
3. pnpm test
4. docker build
5. docker push to ECR
6. prisma migrate deploy
7. aws apprunner start-deployment
```

### 7.2 Prisma migration

MVPでは手動でも可。

```bash
pnpm prisma migrate deploy
```

本番ではデプロイ前ジョブとして実行する。

---

## 8. ドメインモデル

中核エンティティ：

- User
- Account
- Session
- Subscription
- ApiToken
- Project
- Chapter
- Scene
- Character
- CharacterNote
- WorldNote
- PlotThread
- Foreshadowing
- RevisionTodo
- StoryStateSnapshot
- ExportJob
- AuditLog

NextAuth.js を使うため、User / Account / Session / VerificationToken は NextAuth の Prisma Adapter 互換にする。

---

## 9. Prismaモデル仕様

### 9.1 共通方針

全モデル共通：

```prisma
id        String   @id @default(cuid())
createdAt DateTime @default(now())
updatedAt DateTime @updatedAt
```

MVPから論理削除を採用する。

削除可能な業務データには `deletedAt` を持たせ、通常の一覧・詳細・文脈取得・エクスポートでは `deletedAt = null` のデータのみを扱う。

```prisma
deletedAt DateTime?
```

対象：

- Project
- Chapter
- Scene
- Character
- CharacterNote
- WorldNote
- PlotThread
- Foreshadowing
- RevisionTodo
- StoryStateSnapshot
- ApiToken
- ExportJob

---

### 9.2 Subscription

```ts
type Subscription = {
  id: string
  userId: string
  plan: "FREE" | "PLUS" | "PRO"
  status: "ACTIVE" | "TRIALING" | "PAST_DUE" | "CANCELED" | "INCOMPLETE"
  stripeCustomerId?: string
  stripeSubscriptionId?: string
  currentPeriodEnd?: Date
  createdAt: Date
  updatedAt: Date
}
```

MVPではDB上で手動変更可能でもよい。

---

### 9.3 ApiToken

```ts
type ApiToken = {
  id: string
  userId: string
  name: string
  tokenHash: string
  tokenPrefix: string
  lastUsedAt?: Date
  revokedAt?: Date
  createdAt: Date
}
```

APIトークンは平文保存しない。

---

### 9.4 Project

```ts
type Project = {
  id: string
  userId: string
  title: string
  genre?: string
  premise?: string
  tone?: string
  targetAudience?: string
  writingStyle?: string
  forbiddenElements?: string
  userPreferences?: string
  visibility: "PRIVATE"
  createdAt: Date
  updatedAt: Date
}
```

`visibility` は MVP では `PRIVATE` 固定。

---

### 9.5 Chapter

```ts
type Chapter = {
  id: string
  projectId: string
  title: string
  order: number
  summary?: string
  purpose?: string
  createdAt: Date
  updatedAt: Date
}
```

---

### 9.6 Scene

```ts
type Scene = {
  id: string
  projectId: string
  chapterId?: string
  title: string
  order: number
  body: string
  summary?: string
  occurredEvents?: string
  generationPrompt?: string
  createdBy: "USER" | "CHATGPT"
  createdAt: Date
  updatedAt: Date
}
```

`projectId` を持たせることで、章なしシーンや検索を扱いやすくする。

---

### 9.7 Character

```ts
type Character = {
  id: string
  projectId: string
  name: string
  role?: string
  age?: string
  personality?: string
  speechStyle?: string
  appearance?: string
  background?: string
  goal?: string
  secret?: string
  currentState?: string
  firstSceneId?: string
  lastSceneId?: string
  createdAt: Date
  updatedAt: Date
}
```

---

### 9.8 CharacterNote

```ts
type CharacterNote = {
  id: string
  projectId: string
  characterId: string
  title?: string
  body: string
  category?: "INNER" | "RELATIONSHIP" | "BACKGROUND" | "SPEECH" | "PLOT" | "OTHER"
  importance: "LOW" | "MEDIUM" | "HIGH"
  relatedSceneId?: string
  createdAt: Date
  updatedAt: Date
}
```

---

### 9.9 WorldNote

```ts
type WorldNote = {
  id: string
  projectId: string
  title: string
  body: string
  category: "PLACE" | "ORGANIZATION" | "TECHNOLOGY" | "HISTORY" | "CULTURE" | "ITEM" | "RULE" | "OTHER"
  importance: "LOW" | "MEDIUM" | "HIGH"
  relatedSceneId?: string
  createdAt: Date
  updatedAt: Date
}
```

---

### 9.10 PlotThread

```ts
type PlotThread = {
  id: string
  projectId: string
  title: string
  description?: string
  status: "NOT_STARTED" | "IN_PROGRESS" | "ON_HOLD" | "RESOLVED" | "DROPPED"
  startSceneId?: string
  currentState?: string
  resolutionCondition?: string
  createdAt: Date
  updatedAt: Date
}
```

---

### 9.11 Foreshadowing

```ts
type Foreshadowing = {
  id: string
  projectId: string
  title: string
  description: string
  plantedSceneId?: string
  plannedResolution?: string
  resolvedSceneId?: string
  status: "UNPLANTED" | "PLANTED" | "IN_PROGRESS" | "RESOLVED" | "DROPPED"
  importance: "LOW" | "MEDIUM" | "HIGH"
  createdAt: Date
  updatedAt: Date
}
```

---

### 9.12 RevisionTodo

```ts
type RevisionTodo = {
  id: string
  projectId: string
  chapterId?: string
  sceneId?: string
  title: string
  problem: string
  suggestion?: string
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
  status: "OPEN" | "IN_PROGRESS" | "DONE" | "ON_HOLD" | "DROPPED"
  source: "USER" | "CHATGPT"
  createdAt: Date
  updatedAt: Date
}
```

---

### 9.13 StoryStateSnapshot

```ts
type StoryStateSnapshot = {
  id: string
  projectId: string
  summary: string
  recentEvents?: string
  characterStates?: string
  unresolvedProblems?: string
  unresolvedForeshadowings?: string
  activePlotThreads?: string
  nextOptions?: string
  avoidElements?: string
  writingRules?: string
  userPreferences?: string
  createdAt: Date
}
```

MVPではテキスト保存とする。

将来的に JSONB 化する余地を残す。

---

### 9.14 AuditLog

```ts
type AuditLog = {
  id: string
  userId: string
  action: string
  targetType?: string
  targetId?: string
  metadata?: Json
  createdAt: Date
}
```

本文そのものはログに出さない。

---

## 10. プラン制限

### 10.1 PlanLimit

```ts
const PLAN_LIMITS = {
  FREE: {
    projects: 3,
    charactersPerProject: 8,
    bodyCharsPerProject: 20000,
    worldNotesPerProject: 30,
    foreshadowingsPerProject: 30,
    plotThreadsPerProject: 30,
    revisionTodosPerProject: 50,
    storySnapshotsPerProject: 10,
  },
  PLUS: {
    projects: 50,
    charactersPerProject: 20,
    bodyCharsPerProject: 100000,
    worldNotesPerProject: 200,
    foreshadowingsPerProject: 100,
    plotThreadsPerProject: 100,
    revisionTodosPerProject: 300,
    storySnapshotsPerProject: 100,
  },
  PRO: {
    projects: null,
    charactersPerProject: null,
    bodyCharsPerProject: null,
    worldNotesPerProject: null,
    foreshadowingsPerProject: null,
    plotThreadsPerProject: null,
    revisionTodosPerProject: null,
    storySnapshotsPerProject: null,
  },
}
```

`null` は無制限扱い。

ただし内部フェアユース上限を持つ。

```ts
const PRO_FAIR_USE = {
  projects: 1000,
  bodyCharsPerProject: 3000000,
}
```

---

### 10.2 制限チェック関数

保存系APIでは必ず以下を通す。

```ts
assertCanCreateProject(userId)
assertCanAddScene(projectId, bodyLength)
assertCanAddCharacter(projectId)
assertCanAddWorldNote(projectId)
assertCanAddForeshadowing(projectId)
assertCanAddPlotThread(projectId)
assertCanAddRevisionTodo(projectId)
assertCanAddStoryStateSnapshot(projectId)
```

### 10.3 超過時レスポンス

```json
{
  "error": "PLAN_LIMIT_EXCEEDED",
  "message": "Plus plan is required to add more characters to this project.",
  "current": 8,
  "limit": 8
}
```

HTTP status:

```text
403 Forbidden
```

---

## 11. 認証・認可

### 11.1 Web認証

- NextAuth.js
- Google OAuth
- Prisma Adapter

### 11.2 APIトークン認証

MCP風APIは以下を使う。

```text
Authorization: Bearer <storycanon_access_token>
```

トークンはDBにハッシュ保存する。

### 11.3 所有者チェック

すべてのデータは `userId` を起点に所有者チェックする。

```ts
Project.userId === currentUser.id
```

Project配下のデータは Project 経由で確認する。

```ts
Scene.project.userId === currentUser.id
Character.project.userId === currentUser.id
```

### 11.4 削除権限

MVPでは Web アプリと MCP風API の両方から削除できる。

MCP風APIからの削除はすべて論理削除とし、物理削除は行わない。

MCPクライアントには、削除権限を読み取り・追加・更新とは別に明示する。

```text
作品データの論理削除
MCP指令のロールバック
```

MCPからのアカウント削除は不可。アカウント削除は Web アプリ側のみで行う。

---

## 12. Web API仕様

`DELETE` メソッドは、特記がない限り物理削除ではなく `deletedAt` を設定する論理削除として扱う。

論理削除済みデータは、通常の `GET`、MCP文脈取得、エクスポートには含めない。

### 12.1 Projects

```text
GET    /api/projects
POST   /api/projects
GET    /api/projects/:projectId
PATCH  /api/projects/:projectId
DELETE /api/projects/:projectId
```

### 12.2 Chapters

```text
GET    /api/projects/:projectId/chapters
POST   /api/projects/:projectId/chapters
PATCH  /api/chapters/:chapterId
DELETE /api/chapters/:chapterId
```

### 12.3 Scenes

```text
GET    /api/projects/:projectId/scenes
POST   /api/projects/:projectId/scenes
GET    /api/scenes/:sceneId
PATCH  /api/scenes/:sceneId
DELETE /api/scenes/:sceneId
```

### 12.4 Characters

```text
GET    /api/projects/:projectId/characters
POST   /api/projects/:projectId/characters
GET    /api/characters/:characterId
PATCH  /api/characters/:characterId
DELETE /api/characters/:characterId
```

### 12.5 Character Notes

```text
GET    /api/characters/:characterId/notes
POST   /api/characters/:characterId/notes
PATCH  /api/character-notes/:noteId
DELETE /api/character-notes/:noteId
```

### 12.6 World Notes

```text
GET    /api/projects/:projectId/world-notes
POST   /api/projects/:projectId/world-notes
PATCH  /api/world-notes/:noteId
DELETE /api/world-notes/:noteId
```

### 12.7 Foreshadowings

```text
GET    /api/projects/:projectId/foreshadowings
POST   /api/projects/:projectId/foreshadowings
PATCH  /api/foreshadowings/:foreshadowingId
DELETE /api/foreshadowings/:foreshadowingId
```

### 12.8 Plot Threads

```text
GET    /api/projects/:projectId/plot-threads
POST   /api/projects/:projectId/plot-threads
PATCH  /api/plot-threads/:plotThreadId
DELETE /api/plot-threads/:plotThreadId
```

### 12.9 Revision Todos

```text
GET    /api/projects/:projectId/revision-todos
POST   /api/projects/:projectId/revision-todos
PATCH  /api/revision-todos/:todoId
DELETE /api/revision-todos/:todoId
```

### 12.10 Story State Snapshots

```text
GET    /api/projects/:projectId/story-state-snapshots
POST   /api/projects/:projectId/story-state-snapshots
GET    /api/projects/:projectId/story-state/latest
```

### 12.11 Export

```text
GET /api/projects/:projectId/export/markdown
GET /api/projects/:projectId/export/json
```

Freeでは JSON export を禁止する。

---

## 13. MCP風API仕様

### 13.1 方針

MVPでは正式な MCP Server ではなく、将来MCP toolに包みやすいREST APIとして実装する。

ルート例：

```text
/api/mcp/list-private-projects
/api/mcp/create-private-project
/api/mcp/get-private-project-context
/api/mcp/save-generated-scene
/api/mcp/save-character-note
/api/mcp/save-world-note
/api/mcp/save-foreshadowing
/api/mcp/save-plot-thread
/api/mcp/save-revision-todo
/api/mcp/save-story-state-snapshot
/api/mcp/get-next-generation-context
/api/mcp/delete-project-data
/api/mcp/rollback-command
/api/mcp/undo-last-command
```

---

### 13.2 list_private_projects

目的：ログインユーザーの非公開作品一覧を取得する。

Response:

```json
{
  "projects": [
    {
      "id": "project_xxx",
      "title": "火星周回ステーション",
      "genre": "近未来SF",
      "updatedAt": "2026-06-29T10:00:00Z"
    }
  ]
}
```

---

### 13.3 create_private_project

Request:

```json
{
  "title": "火星周回ステーション",
  "genre": "近未来SF",
  "premise": "火星周回ステーションを舞台にした危機対応SF",
  "tone": "淡々、現代延長、説明過多を避ける",
  "forbiddenElements": "過度な恋愛、過剰な超技術"
}
```

処理：

- APIトークン認証
- プラン制限確認
- Project作成
- 必要なら初期StoryStateSnapshot作成

---

### 13.4 get_private_project_context

目的：ChatGPTが続きを生成・レビューするために、作品の現在状態を取得する。

Response:

```json
{
  "project": {
    "id": "project_xxx",
    "title": "火星周回ステーション",
    "genre": "近未来SF",
    "premise": "...",
    "tone": "..."
  },
  "latestStoryState": {
    "summary": "...",
    "recentEvents": "...",
    "characterStates": "...",
    "unresolvedForeshadowings": "...",
    "nextOptions": "..."
  },
  "characters": [
    {
      "id": "char_xxx",
      "name": "整備士",
      "role": "主人公",
      "currentState": "..."
    }
  ],
  "activePlotThreads": [],
  "unresolvedForeshadowings": []
}
```

---

### 13.5 save_generated_scene_to_private_project

Request:

```json
{
  "projectId": "project_xxx",
  "chapterTitle": "第1章",
  "sceneTitle": "燃料輸送船の異常",
  "body": "本文...",
  "summary": "シーン要約...",
  "occurredEvents": "発生した出来事...",
  "generationPrompt": "元になった依頼..."
}
```

処理：

- Project所有者チェック
- 本文量制限チェック
- chapterTitle が存在しなければ作成
- Scene作成

---

### 13.6 save_character_note_to_private_project

Request:

```json
{
  "projectId": "project_xxx",
  "characterName": "通信士",
  "title": "孤独への恐れ",
  "body": "通信士は孤独を恐れているが、職務上は冷静に振る舞う。",
  "category": "INNER",
  "importance": "HIGH"
}
```

処理：

- characterName で検索
- 存在しない場合は Character を最低情報で自動作成
- CharacterNote作成

---

### 13.7 save_world_note_to_private_project

Request:

```json
{
  "projectId": "project_xxx",
  "title": "火星周回ステーション",
  "body": "火星軌道上にある燃料補給拠点。",
  "category": "PLACE",
  "importance": "HIGH"
}
```

---

### 13.8 save_foreshadowing_to_private_project

Request:

```json
{
  "projectId": "project_xxx",
  "title": "圧力センサーの異常値",
  "description": "後に空気漏れの原因につながる伏線。",
  "plannedResolution": "第4章で原因が判明する",
  "importance": "HIGH"
}
```

---

### 13.9 save_plot_thread_to_private_project

Request:

```json
{
  "projectId": "project_xxx",
  "title": "大型燃料輸送船の空気漏れ",
  "description": "物語序盤から続く主要な危機対応プロット。",
  "status": "IN_PROGRESS",
  "currentState": "原因は未特定。圧力センサー異常が確認されている。"
}
```

---

### 13.10 save_revision_todo_to_private_project

Request:

```json
{
  "projectId": "project_xxx",
  "title": "第3章の会話が説明的",
  "problem": "主人公と整備士の会話に設定説明が集中している。",
  "suggestion": "作業描写と短い指示に分散する。",
  "priority": "MEDIUM"
}
```

---

### 13.11 save_story_state_snapshot_to_private_project

Request:

```json
{
  "projectId": "project_xxx",
  "summary": "現在のあらすじ...",
  "recentEvents": "直近の出来事...",
  "characterStates": "キャラ状態...",
  "unresolvedProblems": "未解決問題...",
  "unresolvedForeshadowings": "未回収伏線...",
  "activePlotThreads": "進行中プロット...",
  "nextOptions": "次回候補...",
  "avoidElements": "避ける展開...",
  "writingRules": "文体ルール..."
}
```

---

### 13.12 delete_project_data

目的：MCPクライアントから、作品配下のデータを論理削除する。

MCPからの削除は取り消し可能にするため、必ず `deletedAt` を設定する論理削除とし、物理削除は行わない。

Request:

```json
{
  "projectId": "project_xxx",
  "targetType": "SCENE",
  "targetId": "scene_xxx",
  "reason": "直前に保存したシーンを取り消したい"
}
```

`targetType`:

```text
PROJECT
CHAPTER
SCENE
CHARACTER
CHARACTER_NOTE
WORLD_NOTE
FORESHADOWING
PLOT_THREAD
REVISION_TODO
STORY_STATE_SNAPSHOT
```

処理：

- APIトークン認証
- Project所有者チェック
- 対象データが project 配下にあることを確認
- 対象データの `deletedAt` を現在時刻に更新
- 削除操作を取り消せるよう、MCP操作ログに記録

Response:

```json
{
  "ok": true,
  "deleted": {
    "targetType": "SCENE",
    "targetId": "scene_xxx",
    "deletedAt": "2026-07-04T10:00:00Z"
  },
  "undoToken": "mcp_cmd_xxx"
}
```

---

### 13.13 rollback_command

目的：MCPクライアントまたはWebアプリから実行された保存・更新・論理削除操作を、操作ログに基づいてロールバックする。

対象：

- create-private-project
- save-generated-scene
- save-character-note
- save-world-note
- save-foreshadowing
- save-plot-thread
- save-revision-todo
- save-story-state-snapshot
- delete-project-data

方針：

- 読み取り系 API はロールバック対象にしない。
- 保存・更新・論理削除などのミューテーションは、成功時に必ず rollback 用操作ログを残す。
- 操作ログは `commandId` 単位で記録する。
- 1つのユーザー指令で複数レコードを変更する場合は、同じ `transactionId` を付与し、一括ロールバックできるようにする。
- `commandId` を指定した場合は、その単一操作をロールバックする。
- `transactionId` を指定した場合は、その指令に含まれる全操作を逆順でロールバックする。
- `commandId` / `transactionId` を省略した場合は、同一APIトークン・同一ユーザー・同一projectの最後に成功した未ロールバックのミューテーションを対象にする。
- ロールバック済みの操作は再度ロールバックできない。
- ロールバック自体も操作ログに記録する。
- 作成操作のロールバックは、作成されたデータを論理削除する。
- 論理削除操作のロールバックは、対象データの `deletedAt` を `null` に戻す。
- 更新操作のロールバックは、更新前スナップショットを復元する。
- ロールバック対象の後続操作が同じデータを変更している場合は、原則として競合エラーを返し、`force: true` が指定された場合のみ実行する。

Request:

```json
{
  "projectId": "project_xxx",
  "commandId": "mcp_cmd_xxx",
  "transactionId": "mcp_tx_xxx",
  "force": false
}
```

`commandId` と `transactionId` はどちらも省略可能。ただし、両方指定された場合は `transactionId` を優先し、指令単位でロールバックする。

Response:

```json
{
  "ok": true,
  "rolledBackCommandIds": ["mcp_cmd_xxx"],
  "rolledBackTransactionId": "mcp_tx_xxx",
  "result": {
    "targetType": "SCENE",
    "targetId": "scene_xxx",
    "restored": true
  }
}
```

実装メモ：

- `AuditLog` は本文そのものを保存しない方針のため、ロールバックに必要な最小情報を保存する `MutationLog` などの専用モデルを追加する。
- `MutationLog` には `commandId`, `transactionId`, `userId`, `apiTokenId`, `projectId`, `action`, `targetType`, `targetId`, `beforeSnapshot`, `afterSnapshot`, `rolledBackAt`, `createdAt` を持たせる。
- 本文やメモの全文をログへ残す場合は、通常ログではなくロールバック専用の暗号化されたスナップショットとして扱い、保持期間を短くする。
- MVPでは、作成操作・更新操作・論理削除操作のロールバックを対象にする。

---

### 13.14 undo_last_command

目的：ユーザーが「今の操作を取り消して」と言いやすくするための、`rollback-command` の簡易エイリアス。

`undo-last-command` は `commandId` / `transactionId` を指定しない `rollback-command` と同じ動作をする。

Request:

```json
{
  "projectId": "project_xxx"
}
```

Response は `rollback-command` と同じ。

---

## 14. バリデーション

ZodでAPI入力を検証する。

例：

```ts
const createProjectSchema = z.object({
  title: z.string().min(1).max(120),
  genre: z.string().max(80).optional(),
  premise: z.string().max(5000).optional(),
  tone: z.string().max(1000).optional(),
  forbiddenElements: z.string().max(2000).optional(),
})
```

本文はプラン制限とは別に、単発リクエストサイズ制限を持つ。

```text
1リクエストあたり本文最大：20,000字
```

---

## 15. エクスポート仕様

### 15.1 Markdown Export

構成：

```md
# 作品タイトル

## 概要

## 現在のストーリー状態

## キャラクター

## 世界観メモ

## 伏線

## プロットスレッド

## 本文

### 第1章

#### 第1シーン

本文...
```

### 15.2 JSON Export

Plus以上。

```json
{
  "project": {},
  "chapters": [],
  "scenes": [],
  "characters": [],
  "characterNotes": [],
  "worldNotes": [],
  "plotThreads": [],
  "foreshadowings": [],
  "revisionTodos": [],
  "storyStateSnapshots": []
}
```

---

## 16. 画面構成

### 16.1 ルート

```text
/
/dashboard
/projects
/projects/new
/projects/[projectId]
/projects/[projectId]/scenes/[sceneId]
/settings
/billing
/api/*
/api/mcp/*
```

### 16.2 Project Detail Tabs

- Overview
- Scenes
- Characters
- World Notes
- Foreshadowings
- Plot Threads
- Todos
- Story State
- Export

### 16.3 UI Components

- ProjectCard
- PlanUsageCard
- ProjectTabs
- SceneList
- SceneEditor
- CharacterList
- CharacterForm
- WorldNoteList
- ForeshadowingList
- PlotThreadList
- RevisionTodoList
- StoryStatePanel
- ExportPanel

---

## 17. 検索仕様

MVPではDBのLIKE検索でよい。

対象：

- 作品内シーン検索
- キャラクター名検索
- メモ検索

実装：

```text
PostgreSQL ILIKE
```

将来候補：

- PostgreSQL full-text search
- pg_trgm
- OpenSearch
- Meilisearch

---

## 18. セキュリティ仕様

MVPでも最低限以下を実施する。

- 認証必須
- Project所有者チェック
- APIトークンのハッシュ保存
- CSRF対策
- 入力バリデーション
- レート制限
- 作品データは非公開固定
- RDSはPrivate Subnet
- DB接続情報はSecrets Manager管理
- 本文をログに出さない

禁止：

```text
console.log(req.body)
scene.body のログ出力
API request body 全体のログ出力
token のログ出力
```

許可：

```text
console.log({ userId, action, projectId, bodyLength })
```

---

## 19. レート制限

MVPでは簡易実装でよい。

```text
Web API:
- 1分あたり60リクエスト

MCP保存API:
- 1分あたり30リクエスト
- 1日あたり1000保存操作
```

Proは緩和する。

---

## 20. ログ・監査

保存するログ：

- userId
- action
- targetType
- targetId
- createdAt

本文そのものはAuditLogに保存しない。

---

## 21. 課金連携

### 21.1 Stripe

プラン：

- Plus: $9 / month（税抜） / $9.90 / month（税込）
- Pro: $48 / month（税抜） / $52.80 / month（税込）
- Plus: $90 / year（税抜） / $99 / year（税込）
- Pro: $480 / year（税抜） / $528 / year（税込）

### 21.2 Webhook

受け取るイベント：

- checkout.session.completed
- customer.subscription.created
- customer.subscription.updated
- customer.subscription.deleted
- invoice.payment_failed

### 21.3 Subscription更新

Stripe Webhook を受け、Subscription テーブルを更新する。

MVPではStripe連携をモックにして、DB上の plan を手動変更できる状態から始めてもよい。

---

## 22. 削除仕様

MVPでは論理削除。

Project削除時は Project に `deletedAt` を設定し、通常画面・API・MCP文脈取得・エクスポートから除外する。

Project配下のデータも個別に論理削除できる。Project全体を論理削除した場合、配下データは物理削除せず、Projectの削除状態によって参照不可にする。

WebアプリとMCP風APIの両方から論理削除できる。

MCP風APIからの削除は `delete-project-data` を使う。

MCP風APIからのロールバックは `rollback-command` を使う。

直前操作だけを取り消す簡易操作として `undo-last-command` も用意する。

```ts
deletedAt?: Date
```

物理削除は、アカウント削除、法令・会計上の保持期間経過後のデータ消去、または管理者向けメンテナンス処理に限定する。

---

## 23. MVPでの割り切り

- AI生成はしない
- ChatGPT Apps SDK本実装はしない
- MCP風APIをRESTで用意する
- 課金は初期モック可
- Pro / Plus判定はDBのplan値で行う
- 公開機能なし
- 作品はすべてprivate
- 削除はWebアプリとMCP風APIから可能
- 削除は論理削除
- MCP風APIには操作ログに基づくロールバックAPIを用意する
- エディタはtextareaでよい
- 本文はPostgreSQLに保存
- Exportは同期処理でよい

---

## 24. Codexへの実装指示用チェックリスト

### 24.1 初期セットアップ

- Next.js + TypeScript プロジェクトを作成する
- Tailwind CSS を導入する
- Prisma を導入する
- PostgreSQL 接続を設定する
- Dockerfile を作成する
- docker-compose でローカルPostgreSQLを起動できるようにする

### 24.2 Prisma

- schema.prisma を作成する
- NextAuth互換モデルを作成する
- Subscription / ApiToken / Project / Chapter / Scene / Character / CharacterNote / WorldNote / PlotThread / Foreshadowing / RevisionTodo / StoryStateSnapshot / AuditLog を作成する
- migration を作成する

### 24.3 Web App

- ログイン前トップページを作成する
- dashboard を作成する
- projects 一覧を作成する
- project 詳細画面を作成する
- tabs UI を作成する
- scenes / characters / worldNotes / foreshadowings / todos / storyState のCRUD画面を作成する

### 24.4 API

- Web API CRUD を実装する
- Project所有者チェックを実装する
- Zod validation を実装する
- PlanLimit service を実装する
- Markdown export を実装する
- JSON export をPlus以上に制限する

### 24.5 MCP風API

- APIトークン認証を実装する
- list-private-projects を実装する
- create-private-project を実装する
- get-private-project-context を実装する
- save-generated-scene を実装する
- save-character-note を実装する
- save-world-note を実装する
- save-foreshadowing を実装する
- save-plot-thread を実装する
- save-revision-todo を実装する
- save-story-state-snapshot を実装する
- delete-project-data を実装する
- rollback-command を実装する
- undo-last-command を実装する

### 24.6 AWS CDK

- CDK v2 + TypeScript プロジェクトを作成する
- NetworkStack を作成する
- DatabaseStack を作成する
- AppStack を作成する
- StorageStack を作成する
- DnsStack を作成する
- dev / prod stage を切り替え可能にする
- すべてのリソース名に stage prefix を付ける

---

## 25. 内部仕様の最終定義

StoryCanon の内部設計では、本文生成・レビュー・相談は ChatGPT が行い、StoryCanon は ChatGPT が生成した結果を構造化して保存する。

保存対象は本文だけではなく、キャラクター、世界観、伏線、プロット、修正TODO、ストーリー状態を含む。

次回 ChatGPT で続きを生成するときは、StoryCanon が保存済みの現在状態を返し、ChatGPT がそれをもとに続きを生成する。

MVPのインフラは AWS CDK + App Runner + RDS PostgreSQL を採用し、Next.jsアプリ、Web API、MCP風APIを1つのコンテナとして運用する。
