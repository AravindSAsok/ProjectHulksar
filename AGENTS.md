# Hulksar Agent Guide (canonical)

**This is the canonical repository-wide instruction file.** Every coding agent and human contributor must read this file before changing code. Keep it current when architecture, workflows, product behavior, or operational requirements change. The older \`agent.md\` is retained for compatibility; update this file first and keep both aligned when changing shared rules.

## Product purpose
Hulksar is a privacy-conscious personal lifestyle hub. Its current modules are a food diary and nutrition tracker, daily tasks and habit check-ins, and Hulkie, a personal assistant. The product should help users understand progress across dates without turning estimates into medical claims.

Priorities: (1) protect user data and account boundaries, (2) preserve existing food/task/assistant behavior, (3) show accurate, explainable progress, (4) responsive accessible UI, (5) small reviewable changes. Never use fake user data, mocks, or hard-coded personal results in production.

## Stack and architecture
- Astro 5 + TypeScript; Node.js 22; Vercel deployment.
- Supabase Auth establishes identity. MongoDB Atlas is the application database.
- API routes in \`src/pages/api/\` authenticate requests with \`authenticateRequest\` and scope every user-data query by the verified \`user.id\`.
- Food diary: \`src/pages/api/tracker.ts\`, \`src/lib/store.ts\`, \`src/scripts/app.ts\`.
- Tasks: \`src/pages/api/tasks.ts\`, \`src/scripts/tasks.ts\`, \`src/components/TaskTracker.astro\`.
- Unified analytics: \`src/pages/api/analytics.ts\`, \`src/scripts/analytics.ts\`, \`src/components/ProgressAnalytics.astro\`, \`src/styles/analytics.css\`.
- Hulkie: \`src/pages/api/assistant.ts\`, \`src/scripts/hulkie.ts\`.
- Main page: \`src/pages/index.astro\`; global styles: \`src/styles/global.css\`.
- Environment variable examples: \`.env.example\`. Never commit real secrets or local \`.env\` files.

## Data ownership and security (non-negotiable)
- Supabase is authentication only; do not introduce new Supabase Postgres application writes.
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
- Supabase email/password and anonymous auth/session behavior.
- Task creation, rename/archive, date-specific check-ins, monthly calendar and historical logs.
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

## Development workflow
1. Read this file, \`README.md\`, the latest relevant docs, and the source files being changed.
2. Inspect current branch, latest commit, working tree and open PRs. Work on a feature branch unless the user explicitly requests a direct main push.
3. Trace the complete UI → client script → API → storage flow before editing.
4. Define data contracts and user-visible behavior. Identify regressions that must be prevented.
5. Reuse existing styles, helpers, auth and persistence. Avoid duplicate listeners, duplicate state stores and unnecessary dependencies.
6. Keep TypeScript strict, validate untrusted inputs, escape user-generated HTML, and surface useful errors without leaking secrets.
7. Update documentation and \`docs/DEVELOPMENT_LOG.md\` when behavior, architecture, data contracts, setup, deployment or known limitations change.
8. Add or update focused tests for non-trivial calculations, date boundaries, ownership and edge cases.

## Before commit / push
Run:
- \`npm ci\` when dependencies/lockfile require it.
- \`npm run check\`
- \`npm run build\`
- Relevant tests (including \`npm run test:food\` when food logic is affected).
Review the complete diff for unrelated changes, secrets, debug statements, accessibility and mobile overflow. Never claim a check passed unless it actually ran and passed. Do not force-push or rewrite shared history.

## Release and deployment
After pushing, confirm CI for the exact commit, inspect Vercel deployment state and production alias, and smoke-test the deployed app when browser tooling is available. Separate build verification from authenticated-user, provider, mobile-device and production runtime testing. Keep the last known-good deployment intact if a release fails.

## Change log maintenance
Record each meaningful update in \`docs/DEVELOPMENT_LOG.md\`: date, summary, changed files, data/API impact, tests actually run, deployment/commit reference, and remaining risks. Append entries; do not erase historical entries. Update this guide whenever a rule or architecture changes.

## Completion report
Every agent task must report: root cause or goal, files changed, user-visible behavior, data/security impact, checks actually run, checks not run, commit SHA/link, deployment URL/status if applicable, and known limitations. Be precise. Accuracy is more important than a green-looking report.
