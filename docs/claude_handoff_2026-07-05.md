# Claude Handoff

Date: 2026-07-05

## Repository

- GitHub repository: `git@github.com:exp3/StoryCanon.git`
- Local workspace: `D:\dev\StoryCanon`

## Current goal

Continue implementation and stabilization of StoryCanon with focus on:

- Web authentication and login flow
- Web UI completion
- AWS deployment stability
- GitHub Actions based deployment

## What was completed recently

### Web authentication and page protection

- Added login page:
  - `apps/web/src/app/login/page.tsx`
- Added shared site header:
  - `apps/web/src/components/site-header.tsx`
- Added session helper:
  - `apps/web/src/server/session.ts`
- Updated Auth.js configuration:
  - `apps/web/src/auth.ts`
  - added session callback to expose `user.id`
  - added `trustHost: true`
  - added `pages.signIn = "/login"`
- Protected these pages with session checks:
  - `/dashboard`
  - `/projects`
  - `/projects/new`
  - `/projects/[projectId]`

### Web API authentication

- Updated:
  - `apps/web/src/server/http.ts`
  - `apps/web/src/app/api/[[...path]]/route.ts`
- Current behavior:
  - production: session required for Web API
  - non-production: `x-storycanon-user-id` / `local-user` fallback still allowed

### Web UI progress

- Reworked:
  - `apps/web/src/app/page.tsx`
  - `apps/web/src/app/dashboard/page.tsx`
  - `apps/web/src/app/projects/page.tsx`
  - `apps/web/src/app/projects/new/page.tsx`
  - `apps/web/src/app/projects/[projectId]/page.tsx`
- Current UI improvements:
  - public top page redirects authenticated users to `/dashboard`
  - dashboard shows project / todo / foreshadowing counts
  - projects page loads real data from Prisma
  - new project page creates project and redirects to detail
  - project detail page loads real project, scenes, latest story state

### AWS infrastructure review

- Changed dev-oriented VPC design:
  - `infra/lib/network-stack.ts`
    - `natGateways: 0`
    - private subnets changed to `PRIVATE_ISOLATED`
  - `infra/lib/database-stack.ts`
    - RDS moved to `PRIVATE_ISOLATED`
- Updated docs/scripts to match reduced-NAT design:
  - `docs/infrastructure.md`
  - `scripts/stop-aws-dev.ps1`
  - `scripts/delete-aws-dev.ps1`
  - `docs/aws_test_payment_mock_tasks.md`

### GitHub Actions deployment scaffolding

- Added workflow:
  - `.github/workflows/deploy-main.yml`
- Added deploy script:
  - `scripts/deploy-ecs-express.sh`
- Added GitHub/AWS setup docs:
  - `docs/github_actions_main_deploy.md`
- Added IAM policy templates:
  - `scripts/github/aws-github-oidc-trust-policy.json`
  - `scripts/github/aws-github-actions-policy.json`

## Verified recently

- `npm run build -w apps/web` passed
- `npm run build -w infra` passed
- `npm run test:integration` passed

## Important unresolved issues

### 1. Google login currently still failing

Observed by user:

- Clicking `Google でログイン` leads to failure around `auth/signin/google?`
- User could not see a clear browser/devtools error message

Recent attempted fixes:

- switched login page to link directly to:
  - `/api/auth/signin/google?callbackUrl=...`
- enabled `trustHost: true`
- set custom sign-in page to `/login`

What Claude should check next:

- whether actual deployed URL is `/api/auth/signin/google?...` or `/auth/signin/google?...`
- whether `NEXTAUTH_URL` matches deployed app URL exactly
- whether Google OAuth callback URI includes:
  - `https://<app-domain>/api/auth/callback/google`
- whether Auth.js is reading expected env vars in deployed container
- whether custom `pages.signIn` and route base path are interacting unexpectedly
- CloudWatch / runtime logs around auth request handling

Likely files:

- `apps/web/src/auth.ts`
- `apps/web/src/app/login/page.tsx`
- `apps/web/src/app/api/auth/[...nextauth]/route.ts`

### 2. Text mojibake remains in several files

There are still mojibake issues in some docs and possibly UI files.

Known docs with mixed or broken encoding history:

- `docs/implementation_review_after_completion.md`
- `docs/implementation_review_remaining_tasks.md`
- `docs/aws_test_payment_mock_tasks.md` may have partly cleaned sections and partly broken sections
- `README.md` also appears mojibake-heavy

Please normalize to UTF-8 clean Japanese or English as appropriate.

### 3. GitHub Actions deploy script is unexecuted

The workflow and script were added but not run.

Important note:

- local `bash -n` validation was not available because WSL/bash was not installed in this Windows environment
- YAML file was inspected manually
- shell script should be reviewed on a Linux runner before relying on it

Files:

- `.github/workflows/deploy-main.yml`
- `scripts/deploy-ecs-express.sh`

### 4. “Blue/green” is approximate, not CodeDeploy-style strict blue/green

Current GitHub Actions deployment approach:

- build new image
- push SHA-tagged image
- update ECS Express service
- rely on deployment monitoring and health checks

This behaves like service-level cutover with old runtime preserved until new deployment is healthy, but it is not a full formal CodeDeploy blue/green implementation with explicit dual environments.

If stricter blue/green is required, Claude should reassess architecture.

### 5. Web UI still incomplete

Still missing or partial:

- `/settings`
- `/billing`
- CRUD UI for scenes / characters / notes / todos / etc.
- richer project detail tab behavior
- API token management UI/API

## High-priority next steps for Claude

1. Fix Google login flow end-to-end
2. Clean remaining mojibake in user-facing UI/docs
3. Review and harden `scripts/deploy-ecs-express.sh`
4. Add `/settings` with API token management
5. Continue project detail CRUD UI

## Helpful context from recent AWS work

- AWS App Runner is now legacy for this repo; ECS Express Mode is the active direction
- Old environments may still contain NAT Gateway leftovers from earlier infra versions
- New infra changes are intended to avoid NAT in newly created environments
- Deletion script:
  - `scripts/delete-aws-dev.ps1`
- Creation script:
  - `scripts/create-aws-dev-ecs-express.ps1`

## Important docs to read first

- `docs/storycanon_external_spec.md`
- `docs/storycanon_internal_spec.md`
- `docs/infrastructure.md`
- `docs/github_actions_main_deploy.md`
- `docs/auth_navigation_remaining_tasks_2026-07-05.md`

## Suggested first commands for Claude

```powershell
npm run build -w apps/web
npm run build -w infra
npm run test:integration
```

Then inspect:

```powershell
Get-Content apps/web/src/auth.ts
Get-Content apps/web/src/app/login/page.tsx
Get-Content -LiteralPath apps/web/src/app/api/auth/[...nextauth]/route.ts
Get-Content scripts/deploy-ecs-express.sh
```
