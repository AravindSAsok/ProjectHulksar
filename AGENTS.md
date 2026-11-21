# Hulksar Agent Guide (canonical)

**This is the canonical repository-wide instruction file.** Every coding agent and human contributor must read this file before changing code. Keep it current when architecture, workflows, product behavior, or operational requirements change. The older \`agent.md\` is retained for compatibility; update this file first and keep both aligned when changing shared rules.

## Product purpose
Hulksar is a privacy-conscious personal lifestyle hub. Its current modules are a food diary and nutrition tracker, daily tasks and habit check-ins, and Hulkie, a personal assistant. The product should help users understand progress across dates without turning estimates into medical claims.

Priorities: (1) protect user data and account boundaries, (2) preserve existing food/task/assistant behavior, (3) show accurate, explainable progress, (4) responsive accessible UI, (5) small reviewable changes. Never use fake user data, mocks, or hard-coded personal results in production.

## Stack and architecture
- Astro 5 + TypeScript; Node.js 22; Vercel deployment.
- MongoDB Atlas is the shared application database and current Hulksar account/session store. The server verifies the existing Hulksar session through `authenticateRequest`; Supabase migration files are historical legacy references, not the active messCulator store.
- API routes in \`src/pages/api/\` authenticate requests with \`authenticateRequest\` and scope every user-data query by the verified \`user.id\`.
- Food diary: \`src/pages/api/tracker.ts\`, \`src/lib/store.ts\`, \`src/scripts/app.ts\`.
- Tasks: \`src/pages/api/tasks.ts\`, \`src/scripts/tasks.ts\`, \`src/components/TaskTracker.astro\`.
- Unified analytics: \`src/pages/api/analytics.ts\`, \`src/scripts/analytics.ts\`, \`src/components/ProgressAnalytics.astro\`, \`src/styles/analytics.css\`.
- Hulkie: \`src/pages/api/assistant.ts\`, \`src/scripts/hulkie.ts\`.
- Main page: \`src/pages/index.astro\`; global styles: \`src/styles/global.css\`.
- Environment variable examples: \`.env.example\`. Never commit real secrets or local \`.env\` files.

## Shared database and collection naming contract
- Shared app registry and launcher preferences: `src/lib/apps.ts`, `/apps`, and `/api/app-preferences`. Register each future mini-app in `HULKSAR_APPS`; the launcher cards, ordering controls, and default-home options are generated from that registry. Preserve user-selected app ordering and default landing app. Preferences use user-scoped `hulksar_app_preferences` plus local fallback.

- All mini-apps share the same MongoDB Atlas database configured by `MONGODB_DB_NAME` (default `hulksar`). Do not create one database per app.
- Every new app-specific MongoDB collection must use `<app_slug>_<entity>` in lowercase snake_case, for example `messculator_budgets` or `messculator_expenses`. Shared platform collections such as `users` and `auth_sessions` are not app-owned.
- Existing unprefixed collections (`food_entries`, `tracker_settings`, `assistant_messages`, `daily_tasks`, `daily_task_logs`) are live legacy contracts. Do not rename/drop them or change their readers/writers without a separately reviewed, idempotent data migration and verification. New app collections must follow the prefix rule.
- Every user-owned record includes `userId`; derive it only from `authenticateRequest` and scope every query/mutation to that verified ID.
- messCulator collection contract: `messculator_budgets`, `messculator_people`, `messculator_expenses`, `messculator_expense_splits`, and `messculator_borrowings`. Create indexes on first authenticated API access. Its full snapshot writes must run in a MongoDB transaction; do not run parallel operations inside a transaction.
- messCulator stores money as integer paise, keeps borrowed funds separate from original budget, validates custom allocations to equal the expense total, and retains historical split names after a person is removed.

## Data ownership and security (non-negotiable)
- Use the shared MongoDB Atlas database (default name `hulksar`) for current application and account data. Do not create a separate database per mini-app or introduce new Supabase Postgres application writes.
- Never trust a userId supplied by the browser. Derive it only from the verified auth result.
- Every MongoDB read, update, delete, and aggregation involving personal data must include the verified \`userId\`.
- Keep MongoDB URI, AI provider keys and service credentials server-side. Never prefix them with \`PUBLIC_\`.
- Never log tokens, full diary content, prompts, or personal account information.
- Preserve local-only/guest behavior and cloud sync semantics. Do not silently import guest data into another account.
- Food photos are transient; do not persist image bytes or base64 payloads.
- Never clear, rewrite, or migrate user data as a side effect of UI work.
- Nutrition data is an estimate, not medical advice.

## Existing behavior that must remain intact
- Manual, AI text and photo food entry; review-before-save; edit/delete; meal assignment; food history filters and pagination.
- Calorie goal, macro totals, daily meal breakdown, seven-day consistency, local fallback and MongoDB sync.
- Hulksar account sign-in, sign-out and HttpOnly server session behavior.
- Task creation, rename/archive, date-specific check-ins, monthly calendar and historical logs. Both the checkbox and task title must toggle completion with one click/tap; preserve native button keyboard accessibility and provide a comfortable mobile hit target. Task editing uses the in-app theme-aware dialog with separate Save/Delete actions and an explicit delete confirmation; do not reintroduce browser-native prompt/confirm dialogs for task editing.
- Hulkie popup, chat history, provider/model choice, fallback and authenticated requests.
- Responsive dark/light/leveling themes, keyboard accessibility and mobile-friendly dialogs.

## Unified analytics contract
- Analytics are read-only. Never create a parallel copy of food or task data.
- Use existing \`food_entries\`, \`daily_tasks\`, and \`daily_task_logs\` MongoDB collections.
- Analytics API must authenticate the request and filter every collection query by verified userId.
- Date filters are explicit; use local calendar dates in the UI and ISO boundaries for food timestamps. Task logs use YYYY-MM-DD date keys.
- Food-only, tasks-only, and combined views must be independently selectable.
- Show chart axes and units. Distinguish a true zero from an unavailable/empty dataset. Avoid implying missing check-ins are failures.
- Task completion denominator includes only tasks active on that date (created by that day and not archived before that day).
- Charts must be responsive and keyboard/screen-reader understandable; provide a daily tabular breakdown.
- Progress analytics must stay collapsed by default to preserve dashboard space, remember the user's expanded/collapsed choice locally, and show one selected chart/report at a time. Switching chart views must reuse the already-loaded analytics payload and must not trigger another API request.
- Do not add a charting dependency unless the existing SVG/CSS implementation cannot meet the requirement.
- Analytics must remain a view of existing records; never change food/task write APIs merely to support charts.


## Responsive and optimistic interaction contract
- Every user-facing action button must respond to the tap immediately. For data mutations (task completion, task add/edit/archive, food add/edit/delete, calorie-goal changes), update the visible UI from local state first, then synchronize with the authenticated API/MongoDB in the background. Never make the user wait for the network before showing the intended state.
- Keep non-mutating controls (navigation, opening/closing dialogs, theme/view switches) immediate and local; do not add unnecessary API calls or disable unrelated controls while a mutation is syncing.
- Permit repeated taps on task completion: one tap marks done, the next tap marks not done. Serialize/coalesce per-task/date writes so the last tap wins without duplicate or out-of-order writes. Do not use a page-wide busy flag to block task toggles.
- If cloud synchronization fails, retain the local-first state where the existing storage contract supports it and show exactly: “Unstable network, some data may not be synced” for 2 seconds. Do not claim cloud sync succeeded. Preserve existing auth and user-scoped MongoDB API checks; never bypass server authentication.
- Avoid redundant client-side session round trips before protected API calls; let the API perform its existing authoritative authentication check. Cache one-time MongoDB index initialization per warm server instance rather than calling createIndex on every request.
- Keep feedback accessible (role=status/aria-live), touch targets comfortable, and keyboard activation functional. Do not optimistically discard data on a failed mutation without a clear rollback or local-save behavior.
- Task deletion is a soft archive: it must disappear from the user's current/future local-calendar checklists immediately after a successful API sync, while past-date checklists and completed check-ins remain available. Compare ISO timestamps as local calendar dates in task UI logic; do not slice UTC date strings for local-day visibility. The delete endpoint must support legacy documents with missing, null, or empty archivedAt values, verify the MongoDB update matched (or the task was already archived), and preserve userId scoping. If a DELETE request has an ambiguous network outcome, re-fetch the month from the authenticated API before rolling back the optimistic archive; only restore the task when the server confirms it remains active or reconciliation itself fails.
- Task editor/delete actions must not be blocked by an unrelated task creation or check-in request. Use task-specific pending state; disable edit/delete only for a task whose create request is still pending. Surface API errors instead of disguising every failure as a network outage.


## messCulator module
- Monthly reports filter expenses and timestamped borrowing transactions by their recorded `createdAt` month. New borrowing records are timestamped individually; legacy aggregate borrowed totals remain in all-time totals but must not be assigned to an invented month.

- Route: `src/pages/messculator.astro`; authenticated persistence API: `src/pages/api/messculator.ts`; shared MongoDB client: `src/lib/mongodb.ts`.
- messCulator uses five app-prefixed collections in the shared `hulksar` database: `messculator_budgets`, `messculator_people`, `messculator_expenses`, `messculator_expense_splits`, and `messculator_borrowings`.
- The API derives `userId` from `authenticateRequest`, validates the full state, and atomically replaces only that user's messCulator records in a MongoDB transaction. The browser serializes writes and keeps localStorage as a fallback.
- Existing device-only data must not be silently assigned to an account. Ask before uploading it on first sync; if the account already has a budget, ask before replacing the device copy.
- Monetary values are integer paise. Custom allocations must total the expense amount exactly; equal splits distribute remainder paise deterministically. Borrowed funds are separate from the original budget.
- The original budget balance is `budget - expenses` and may be negative. Available cash is `budget + borrowed - expenses`. Preserve historical allocation names when a person is removed. Validate user-entered amounts and escape names/expense labels before rendering HTML.

## Development workflow
- Always track progress: after every meaningful implementation, update `AGENTS.md`, `agent.md`, `README.md`, and append a dated entry to `docs/DEVELOPMENT_LOG.md`. Record completed work, current status, checks actually run, known gaps, and latest commit/deployment reference. Read these progress notes before resuming work.

1. Read this file, README.md, agent.md, the latest relevant docs, and the source files being changed.
2. Inspect the current main commit, working tree and open PRs/issues before editing. **The default and required destination for all completed code and documentation changes is main: commit and push directly to main.** Do not create feature branches or PRs unless the user explicitly asks for a branch/PR or a repository protection rule technically prevents a direct push. If direct push is blocked, explain the blocker and ask before using a PR workflow.
3. Trace the complete UI → client script → API → storage flow before editing.
4. Define data contracts and user-visible behavior. Identify regressions that must be prevented.
5. Reuse existing styles, helpers, auth and persistence. Avoid duplicate listeners, duplicate state stores and unnecessary dependencies.
6. Keep TypeScript strict, validate untrusted inputs, escape user-generated HTML, and surface useful errors without leaking secrets.
7. **For every meaningful task, update AGENTS.md with durable current project knowledge, changed behavior, architecture/contracts, or agent instructions so the next agent/chat can continue without relying on chat history. Also append a dated entry to docs/DEVELOPMENT_LOG.md recording the goal, root cause, changed files, behavior/data/API impact, checks actually run, commit/deployment reference, and remaining risks.** Keep agent.md aligned with shared workflow rules. Do not add transient chatter or duplicate the full chronological log into AGENTS.md.
8. Add or update focused tests for non-trivial calculations, date boundaries, ownership and edge cases.

## Before commit / push
Run:
- \`npm ci\` when dependencies/lockfile require it.
- \`npm run check\`
- \`npm run build\`
- Relevant tests (including \`npm run test:food\` when food logic is affected).
Review the complete diff for unrelated changes, secrets, debug statements, accessibility and mobile overflow. Never claim a check passed unless it actually ran and passed. Do not force-push or rewrite shared history. Push completed changes directly to main by default; use another branch only when the user explicitly requests it or GitHub protection rules make a direct push impossible.

## Release and deployment
After pushing, confirm CI for the exact commit, inspect Vercel deployment state and production alias, and smoke-test the deployed app when browser tooling is available. Separate build verification from authenticated-user, provider, mobile-device and production runtime testing. Keep the last known-good deployment intact if a release fails.

## Change log maintenance
Record each meaningful update in docs/DEVELOPMENT_LOG.md: date, summary, changed files, data/API impact, tests actually run, deployment/commit reference, and remaining risks. Append entries; do not erase historical entries. Update AGENTS.md with durable knowledge and current instructions so every future agent/chat can pick up the project state. Keep agent.md aligned with shared workflow rules. Never treat a chat reply as a substitute for repository documentation.

## Completion report
Every agent task must report: root cause or goal, files changed, user-visible behavior, data/security impact, checks actually run, checks not run, commit SHA/link, deployment URL/status if applicable, and known limitations. Be precise. Accuracy is more important than a green-looking report.
