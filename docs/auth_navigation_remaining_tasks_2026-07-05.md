# Authentication Navigation Remaining Tasks

Date: 2026-07-05

## Background

In the current deployed StoryCanon environment, unauthenticated users can open the top page and navigate to `/dashboard` and `/projects` without being redirected into the login flow.

Authentication is configured with NextAuth and Google OAuth, but the page-level navigation and guard behavior are still incomplete.

## Observed Behavior

- `/` opens the public StoryCanon top page.
- The top page links to `/dashboard` and `/projects`.
- `/dashboard` and `/projects` are reachable without a visible login step.
- The UI does not expose a clear login button or logout button.

## Required Implementation Tasks

### P1: Authentication entry points

- [ ] Add a visible login entry point for unauthenticated users.
- [ ] Add a visible logout entry point for authenticated users.
- [ ] Decide whether `/api/auth/signin` is used directly or wrapped by a dedicated `/login` page.

### P1: Protected page routing

- [ ] Redirect unauthenticated access to `/dashboard` into the login flow.
- [ ] Redirect unauthenticated access to `/projects` into the login flow.
- [ ] Redirect unauthenticated access to `/projects/new` into the login flow.
- [ ] Redirect unauthenticated access to `/projects/[projectId]` into the login flow.

### P1: Top page behavior

- [ ] Decide whether `/` remains a public landing page.
- [ ] If `/` remains public, show login CTA clearly.
- [ ] If the user is already authenticated, decide whether `/` stays visible or redirects to `/dashboard`.
- [ ] Reflect the final decision in docs and route behavior.

### P1: Verification

- [ ] Add automated coverage for unauthenticated page access.
- [ ] Add automated coverage for authenticated navigation to `/dashboard` and `/projects`.
- [ ] Add a manual verification checklist for login, logout, redirect, and deep-link access.

## Affected Files

- `apps/web/src/app/page.tsx`
- `apps/web/src/app/dashboard/page.tsx`
- `apps/web/src/app/projects/page.tsx`
- `apps/web/src/app/projects/new/page.tsx`
- `apps/web/src/app/projects/[projectId]/page.tsx`
- `apps/web/src/auth.ts`

## Notes

- This is not only a UI improvement. It is a specification gap in the authentication flow.
- Tightening Web API authorization alone is not enough; page navigation also needs explicit guard behavior.
