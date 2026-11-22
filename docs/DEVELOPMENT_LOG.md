# Hulksar Development Log

Append-only record of meaningful implementation and operational changes.

## 2026-11-19 — Unified progress analytics (implementation branch)
- Added a read-only analytics API design that reads existing MongoDB food entries, task definitions and task check-ins under the authenticated user ID.
- Added a dashboard analytics section with date presets, custom date range, food/tasks/combined scope, daily trend charts with explicit X/Y axes, meal-distribution donut chart, task completion bars and a daily breakdown table.
- Added root \`AGENTS.md\` as the canonical contributor/agent guide. The existing \`agent.md\` remains for compatibility.
- No new database collections, migrations, write paths or dependencies are intended.
- Verification and deployment status must be appended after checks and CI complete. Do not treat this planning/implementation note as proof of a successful build or release.

- Date-boundary handling was tightened for positive-offset time zones by sending local calendar date keys separately from ISO timestamp boundaries. Scope-specific active-day metrics and percentage chart scaling were also corrected.

## Verification update — 2026-11-19
- GitHub Actions run [#37](https://github.com/AravindSAsok/ProjectHulksar/actions/runs/44478364970) passed for application commit `e29df19aada05d969e8081e6fb7187b13e7063e4`: food tests (4/4), `npm run check`, and `npm run build`.
- Vercel preview deployment for that application commit reached `READY`: https://projecthulksar-git-feat-unified-progress-analytics-kukki.vercel.app
- This is a preview deployment only. Production/main has not been changed. Authenticated end-to-end testing with real account data and device-width checks still need to be completed before production release.


## 2026-11-19 — Repair food-log layout and save preferred AI model
- Corrected the Quick food log layout with a dedicated controls grid and a three-column action-button row; constrained the sidebar and diary children to prevent grid overflow.
- Styled model status as compact muted helper text and normalized diary/footer heading/icon sizing.
- Added an explicit Save preference action for the food-log AI provider/model. The preference is stored in browser localStorage, restored when the matching provider model catalog loads, and reused by text and photo estimates through the existing request flow.
- No API keys, MongoDB records, Supabase data, or provider credentials are stored in browser storage. No server/API contract or database schema changes.
- Verification: source-level review only at commit preparation; automated checks and deployed browser/device testing are pending CI/deployment.


## 2026-11-19 — Foldable, single-view progress analytics
- Reworked the Progress Analytics header into a compact collapsible section. It starts collapsed to reduce dashboard height and remembers the expanded/collapsed preference in browser localStorage.
- Added a focused view selector for Calories trend, Meal distribution, Task consistency and Daily breakdown. Only the selected report is displayed; options unavailable under Food-only or Tasks-only scope are disabled and the selection moves to a valid view.
- The selected report is also remembered locally. Changing the report only switches already-rendered panels and does not issue another analytics API request; changing the date range still uses the existing Update charts action.
- Kept the existing read-only analytics API, MongoDB ownership filters, calculations, date controls, scope filters, summary metrics and daily data. No database writes, schema changes, dependencies or Supabase data changes.
- Accessibility: native button/select controls, `aria-expanded` and `aria-controls`, visible keyboard focus, and live status feedback.
- Verification: source review completed. Automated CI/build and production/browser checks are pending for this commit.


## 2026-11-19 — Gemini and Groq production provider setup
- Confirmed Vercel production has sensitive server-side `GEMINI_API_KEY` and `GROQ_API_KEY` variables. Both provider model-list endpoints return HTTP 200 from the deployed app. Existing `GEMINI_MODEL=gemini-3.6-flash` and `GROQ_MODEL=openai/gpt-oss-20b` settings are already present; no secret values were copied into source control or exposed to the browser.
- Restricted the Gemini picker to four stable text-generation models with a documented free Standard tier: Gemini 3.6 Flash, 3.5 Flash, 3.5 Flash-Lite and 3.1 Flash-Lite. Paid-only, media-only and unsupported aliases are no longer presented as free text choices.
- Kept Gemini 3.6 Flash as the default because it is available in the current API key's model catalogue and is documented as free on the Gemini API Standard tier. The existing Vercel `GEMINI_MODEL` already points to it.
- Set Gemini as the initial provider for Quick food log and Hulkie; explicit saved food-log model preferences still take precedence. The model dropdown now labels the server-configured default clearly.
- Verification limitation: live model catalogue connectivity was checked for Gemini and Groq, but per-model generation benchmarks could not be run from the available browser runner (runner wallet unavailable) and the Vercel secret API did not return decrypted values for safe direct testing. Do not describe individual generation models as benchmark-passed.


## 2026-11-19 — Easier one-click task completion
- Root cause: the task title was a non-interactive span, so only the small 23px checkbox could toggle completion.
- Made the task title its own accessible button using the same existing `data-task-toggle` action as the checkbox. Clicking either target now toggles the same date-specific completion state once; clicking the task edit control still only opens edit/delete.
- Increased the checkbox hit area to 32px (36px on narrow screens), gave the title a comfortable minimum height, visible keyboard focus, and touch-friendly interaction. Existing single-click PATCH behavior and the current busy guard remain in place to prevent duplicate requests while a save is in flight.
- No API, MongoDB, auth, schema, or dependency changes. The existing authenticated PATCH still writes only the selected task/date completion.
- Verification: source review; automated check/build and authenticated mouse/touch testing pending deployment.


## 2026-11-19 — Instant optimistic actions and task-sync latency
- Task completion now updates the checklist, progress, calendar and streak immediately on the first tap; a second tap immediately reverses it. Per-task/date writes are serialized/coalesced so the latest tap wins. Failed sync rolls back to the last confirmed state and shows “Unstable network, some data may not be synced” for 2 seconds.
- Removed the redundant browser-side /api/auth/me request before task API calls. The protected task endpoint continues to perform authoritative authentication and user-scoped MongoDB access.
- Task MongoDB indexes are now initialized once per warm server instance rather than issuing four createIndex calls on every task request. Existing indexes and query filters are unchanged.
- Food add/edit/delete and calorie-goal changes now render from local-first state before awaiting background MongoDB sync. Existing local persistence and pending-add retry behavior are preserved; sync warnings use the same 2-second toast duration.
- Updated AGENTS.md and legacy agent.md with the app-wide optimistic interaction, network warning, auth and index-initialization rules.
- Verification: source-level patch review only in this GitHub-connected environment. npm run check, npm run build, automated tests, race-condition simulation, authenticated browser testing and production deployment verification remain pending.


## 2026-11-19 — Themed task editing and reliable archive action
- Replaced the browser-native `window.prompt` task editor (which exposed an unthemed Android/browser dialog and overloaded the word DELETE) with an accessible in-app dialog using Hulksar's shared dialog styling.
- Added separate Save and Delete task actions, followed by an explicit in-app delete confirmation. Cancel/close leaves the task unchanged; successful deletion removes it from future checklists while preserving prior daily check-ins.
- Kept task edits and deletes optimistic with rollback and the existing authenticated task API. No database schema, auth, dependency, or collection changes.
- Hardened the DELETE endpoint to treat an already-archived task as a successful idempotent archive without overwriting its original archive timestamp; ownership remains scoped by the verified userId.
- Verification: source-level review only in GitHub-connected environment. `npm run check`, `npm run build`, automated tests, authenticated browser testing, mobile-device testing, CI and deployment verification remain pending.


## 2026-11-19 — Mandatory agent handoff documentation and main-branch workflow
- Updated the canonical `AGENTS.md` and compatibility `agent.md` so every coding agent/chat is instructed to read the project guidance, record durable discoveries and behavior changes in `AGENTS.md`, and append a dated, detailed entry to `docs/DEVELOPMENT_LOG.md` for every meaningful task.
- Set the repository's default Git workflow to commit and push directly to `main` after checks. Feature branches and PRs are exceptions only when explicitly requested by the user or when GitHub branch protection technically blocks direct pushes; in the latter case, agents must explain the blocker and ask before changing workflow.
- Added the task editor contract: use the theme-aware in-app edit/delete dialog and explicit delete confirmation; do not reintroduce browser-native prompts for task editing.
- Clarified that `AGENTS.md` is the durable current handoff/instructions source, while `docs/DEVELOPMENT_LOG.md` is the append-only chronological record. Keep legacy `agent.md` shared workflow rules aligned.
- Changed files: `AGENTS.md`, `agent.md`, `docs/DEVELOPMENT_LOG.md`.
- Data/API impact: documentation and contributor workflow only; no application code, database, auth, or API behavior changed.
- Verification: reviewed the current repository guidance and checked the updated instruction text for conflicting branch/PR rules. Application tests/build are not applicable to this documentation-only change.
- Commit/deployment: pending commit and push to `main`; deployment not applicable.
- Remaining risks: GitHub branch protection may still require an approved PR; agents must not bypass repository protections.


## 2026-11-19 — Fix task deletion visibility and action blocking
- Investigated the complete task editor → confirmation → DELETE API → MongoDB archive flow on main. The UI uses soft deletion to preserve historical check-ins.
- Identified two concrete client-side weaknesses: task visibility compared UTC date slices against local calendar dates (which can leave a just-archived task visible around local midnight), and the shared global busy flag blocked task editor/delete actions while unrelated task requests were pending. A pending optimistic task was also rendered with an active edit affordance before it had a server ID.
- Task visibility and analytics now compare task timestamps using the user's local calendar date. Task editor/delete requests use a dialog-specific pending guard, unrelated task creation/check-in requests no longer block existing task actions, and unsaved temporary tasks have edit disabled until creation is confirmed.
- Hardened the MongoDB archive filter to handle legacy null/missing/empty archive fields, check matchedCount and confirm an already-archived state before reporting success. All queries remain scoped by the authenticated userId; no physical deletion or historical log deletion occurs.
- Delete failures now show the actual API error; only network-level failures show the standard 2-second unstable-network warning.
- Changed files: src/scripts/tasks.ts, src/pages/api/tasks.ts, AGENTS.md, agent.md, docs/DEVELOPMENT_LOG.md.
- Verification: Vercel production `npm run build` completed successfully for this commit; deployment reached READY and the production aliases were assigned. Source-level checks confirmed local-date filtering, task-specific action state, legacy archive-field handling and MongoDB matchedCount verification. `npm run check`, automated API tests, and authenticated browser/mobile delete testing were not run.
- Commit: `eb72e746cf8d00a54473320274b1c4da1150fda9` — https://github.com/AravindSAsok/ProjectHulksar/commit/eb72e746cf8d00a54473320274b1c4da1150fda9
- Production deployment: READY — https://projecthulksar-2v1qa83wu-kukki.vercel.app (production aliases include https://projecthulksar.vercel.app).
- Remaining risks: no access to the complaining user's authenticated browser session or task document, so the exact production failure has not been reproduced against that account. A real-user delete confirmation is still needed.


## 2026-11-19 — Task deletion state reconciliation
- Goal: prevent a task that was successfully archived from reappearing after a transient DELETE response/network failure.
- Root-cause assessment: the client optimistically sets `archivedAt`, then restores the old value on any DELETE error. If MongoDB commits the archive but the response is lost, that rollback can temporarily contradict server state. This matches the reported disappear-then-return symptom but is not confirmed without the user's network/API trace.
- Changed files: `src/scripts/tasks.ts` (re-fetch the selected month after a DELETE error and reconcile against the authoritative server state); `AGENTS.md` and `agent.md` (document the reconciliation contract).
- Data/API impact: no schema, endpoint, authentication, or database changes. Historical check-ins remain preserved; reconciliation uses the existing authenticated GET endpoint.
- Checks: source-level patch and exact replacement verified before commit. `npm run check`, `npm run build`, automated tests, CI, and live authenticated deletion were not run from this GitHub-only session.
- Deployment: pending GitHub CI and Vercel deployment after the main push.
- Remaining risk: a failed reconciliation request still requires rollback and may leave the user needing to retry; verify with an authenticated device test and inspect API responses if the symptom persists.


## 2026-11-21 — Add messCulator as a separate Hulksar mini-app
- Goal: expand Hulksar into a multi-app hub while preserving the existing nutrition, tasks, analytics and Hulkie experience.
- Added `src/pages/messculator.astro`, a responsive standalone budget calculator with original budget editing, expense creation/removal, optional expense names, separately recorded borrowed funds, a people list, equal default splits, custom per-person allocations, expense history, and cumulative per-person breakdowns.
- Budget balance is calculated as original budget minus expenses and can become negative. Available cash is calculated separately as budget plus borrowed funds minus expenses; remaining borrowed funds are shown separately. Monetary values are represented as integer paise/cents to avoid floating-point allocation drift. Equal-split remainder paise are distributed deterministically, and custom allocations are accepted only when their sum exactly matches the expense.
- Added a dashboard navigation link to `/messculator`. Updated `README.md`, canonical `AGENTS.md`, and compatibility `agent.md` with the new module and its data contract.
- Data/security impact: this first version stores messCulator data only in browser localStorage under `hulksar-messculator-v1`. It does not call APIs, access MongoDB/Supabase, or sync across devices. Existing Hulksar data stores and auth flows are untouched. User-entered labels are HTML-escaped before rendering.
- Verification: source was reviewed for budget arithmetic, paise-safe equal/custom splits, input validation, local-only persistence and separation from existing stores. Automated `npm run check`, `npm run build`, mobile-browser interaction tests and CI/deployment status are pending because this GitHub-connected session does not provide a local project runtime/browser.
- Commit/deployment: documentation and navigation commits were pushed directly to `main`; final feature commit and CI/Vercel status are to be recorded after completion.
- Remaining limitations: no cloud sync, export/import, settlement tracking or cross-device sharing in this initial version. Removing a person affects the active list only; prior expense allocations retain their saved name and amount.


### Verification update — 2026-11-21
- GitHub Actions run [#69](https://github.com/AravindSAsok/ProjectHulksar/actions/runs/44891186124) passed for feature-fix commit `acc2c2fcce3895c0644d1fafd6885ed5e95d87d5`: existing food tests (4/4), `npm run check`, and `npm run build` all completed successfully.
- The first CI attempt exposed an apostrophe inside a single-quoted HTML string in the new page. The script-rendered empty-state text was escaped as an HTML entity and the subsequent CI run passed. The remaining two Astro check hints are pre-existing unused declarations in `src/scripts/app.ts` and `src/scripts/tasks.ts`.
- Vercel production deployment for the fixed application commit reached `READY`: https://projecthulksar-n7idm1ufj-kukki.vercel.app. Production aliases include https://projecthulksar.vercel.app.
- Authenticated browser/device interaction testing was not available in this GitHub-connected session. messCulator's localStorage persistence, budget arithmetic, equal/custom allocation flows and mobile layout still need a hands-on smoke test.


## 2026-11-21 — Shared Hulksar database and messCulator cloud persistence
- Confirmed the active application database from the repository contract: MongoDB Atlas, database name `hulksar` by default. Supabase migration files are historical legacy references; the current server API authenticates using the existing Hulksar session implementation and accesses MongoDB. No new Supabase PostgreSQL app tables were created.
- Added authenticated `GET`/`PUT /api/messculator` endpoints. Ownership is derived only from `authenticateRequest`; every app-data query is scoped by the verified `userId`.
- Added five app-prefixed MongoDB collections: `messculator_budgets`, `messculator_people`, `messculator_expenses`, `messculator_expense_splits`, and `messculator_borrowings`. Indexes are created on the first authenticated API request, which also creates the collections in MongoDB. Borrowed money remains separate from the original budget; amounts and splits are integer paise.
- Full-state saves use a MongoDB transaction across the five collections. The browser serializes cloud writes, keeps localStorage as an offline fallback, and asks before uploading existing device-only data or replacing it with an account budget. Reset deletes only the current user's messCulator documents.
- Exposed the shared MongoDB client helper for transaction sessions. Existing unprefixed collections and their API contracts were deliberately left unchanged to avoid an unsafe rename of live data. New app-specific collections must use the `<app_slug>_<entity>` naming convention; shared account/session collections remain platform-level.
- Updated `README.md`, canonical `AGENTS.md`, and legacy `agent.md` with the shared-database architecture, collection naming rule, ownership/security requirements and messCulator storage contract.
- Verification pending: GitHub Actions `npm run check`, existing tests and production build; deployment and authenticated live database creation should be confirmed after the first signed-in messCulator page load. No direct MongoDB console connection is exposed in this session, so physical collection/index listing cannot be independently queried here.


### Verification update — 2026-11-21
- GitHub Actions passed for the messCulator API, client sync, transaction fix, README and both agent-guide updates. In particular, runs [#44892416436](https://github.com/AravindSAsok/ProjectHulksar/actions/runs/44892416436), [#44892456503](https://github.com/AravindSAsok/ProjectHulksar/actions/runs/44892456503), [#44892502090](https://github.com/AravindSAsok/ProjectHulksar/actions/runs/44892502090), and [#44892703151](https://github.com/AravindSAsok/ProjectHulksar/actions/runs/44892703151) completed successfully. The CI workflow runs the existing food tests, `npm run check`, and `npm run build`.
- Latest Vercel production deployment for `main` reached `READY`; the public `/messculator` route was fetched successfully and displayed the new account-sync status.
- The production smoke fetch had no authenticated browser session and therefore correctly displayed “Saved on this device · sign in to sync”. The first signed-in visit calls the protected API, creates the five collections/indexes, and enables cloud persistence. A direct Atlas collection listing was not available in this session, so live collection existence and signed-in read/write remain to be confirmed from an authenticated app session.
- Existing legacy unprefixed collections remain unchanged to protect live data. The app-prefix naming convention is enforced for all newly added app-specific collections; renaming existing collections requires a separate copy-and-verify migration.


## 2026-11-21 — Monthly messCulator reports and customizable Hulksar app launcher
- Goal: enable month-based financial review and let each account choose its default app and app order.
- Added a month selector with monthly expense totals, timestamped new borrowings, net cash movement, transaction count and per-person allocations. Expense history is filtered to the selected month; overall budget/cash metrics remain all-time.
- Updated messCulator persistence to store borrowing transactions individually. Existing aggregate borrowing records remain in the all-time borrowed total but are not assigned to a month because historical dates cannot be trusted.
- Added shared app registry (`src/lib/apps.ts`), authenticated preferences API (`/api/app-preferences`), and `/apps` settings page for default-home and app ordering. Preferences are stored per user in `hulksar_app_preferences`, with local fallback. Root dashboard redirects to messCulator when selected as default.
- Added navigation links and updated README, AGENTS.md and agent.md. Future apps must register in the shared registry.
- Data/security: all account preference and messCulator API queries are scoped to the server-verified userId. No existing app collections are renamed or dropped.
- Verification: GitHub source changes staged for commit; automated check/build, CI, Vercel deployment and authenticated browser/month-boundary testing are pending.
- Commit/deployment: pending.
- Remaining risks: historical aggregate borrowings cannot be reliably allocated to past months; verify monthly totals and cross-device preferences after deployment.


### Follow-up correction — 2026-11-21
- Corrected monthly expense rendering so the selected month is read before filtering the expense list.
- Made the app launcher consume `HULKSAR_APPS` directly for its app cards, default-home options and allowed ordering IDs. Future app registration now has one canonical source rather than a hard-coded duplicate list.
- Verification remains pending CI/build and authenticated browser testing.

- Follow-up: wired the launcher script to the Astro-provided app registry at runtime and corrected the month-filter empty state. CI/build verification still pending.


### Verification update — 2026-11-21
- Vercel production deployment for commit `286fba35b4a24e8ab97f9669508a7ef27b0f95bf` reached `READY`: https://projecthulksar.vercel.app (deployment: https://projecthulksar-osxabhkoa-kukki.vercel.app).
- Live unauthenticated smoke checks returned the `/apps` launcher and `/messculator` monthly report UI successfully. `/api/app-preferences` correctly returned HTTP 401 while signed out.
- `npm run build` completed successfully in the Vercel production build. `npm run check`, authenticated data persistence, multi-account isolation, real month-boundary calculations, and mobile interaction tests were not independently run in this session.
- Follow-up hardening: month grouping now uses the browser local calendar month (not UTC month slicing), and ordered launcher rows include direct Open links so the selected order controls the actual launcher.
- Current follow-up commit/deployment status: this verification note and hardening patch are being committed now; recheck deployment after push.


### Release status clarification — 2026-11-21
- Latest code commit on `main`: `4145fb4f31456d32b0817512b3358ae2b724f805` — https://github.com/AravindSAsok/ProjectHulksar/commit/4145fb4f31456d32b0817512b3358ae2b724f805.
- The Vercel production deployment for prior feature commit `286fba35b4a24e8ab97f9669508a7ef27b0f95bf` is `READY` and owns `https://projecthulksar.vercel.app`. The deployed version includes the monthly report and app customization core.
- A deployment for `4145fb4f31456d32b0817512b3358ae2b724f805` was not created. The Vercel deployment API returned HTTP 402 `api-deployments-free-per-day` (resource limit: more than 100 deployments; retry after 1 day). No CLI fallback is available in this session. Do not claim the final local-month grouping and direct Open links are live until the latest SHA has a READY deployment.
- Live smoke checks on the prior READY deployment: `/apps` rendered the app-order/default-home settings; `/messculator` rendered the month report; unauthenticated `/api/app-preferences` returned 401 as expected. Authenticated persistence and real user data remain untested.
- `npm run build` passed for commit `286fba35b4a24e8ab97f9669508a7ef27b0f95bf`; `npm run check` and automated test suites were not independently run here.



## 2026-11-22 — Monthly messCulator workspaces, lender names and app-switch reliability
- Goal: make each month an independent editable workspace, record who borrowed money from when known, and make Hulksar/messCulator switching reliable and visible.
- Changed `src/pages/messculator.astro`: the month selector now controls the active workspace; each month has its own starting budget, and new expenses/borrowings are timestamped into the selected month. Past-month expense and borrowing records can be edited or removed. Expense amount edits rebalance the existing recipients evenly. Borrowing entries include an optional lender name and show “Lender not specified” for blank/legacy records.
- Changed `src/pages/api/messculator.ts`: validate and persist the month-keyed `monthlyBudgets` map in the existing user-scoped budget document; preserve legacy single-budget records by assigning their value to the current month in the client migration path. Borrowing records accept an optional bounded `lender` field. Existing five collection names, authentication, userId filters and transaction-based full-snapshot saves remain unchanged.
- Fixed app switching in `src/pages/index.astro` and `src/pages/messculator.astro`: an explicit `/?app=hulksar` choice bypasses the saved default-app redirect, and both the Hulksar brand and back link use that explicit destination. The Messculator nav link is now bold and visually emphasized.
- Updated `README.md`, `AGENTS.md`, and `agent.md` with month-workspace, lender and backward-compatibility behavior.
- Data/security impact: no collections were added, renamed or dropped. Monthly budgets share the existing per-user budget document; all API reads/writes remain scoped to the authenticated user. Existing borrowing records without a lender remain valid.
- Verification: source-level inspection completed for client/API contracts, monthly budget migration, optional lender validation, edit handlers and explicit app-switch routing. Automated `npm run check`, `npm run build`, automated tests, CI, authenticated multi-month persistence, and real-device navigation tests have not yet been run in this GitHub-connected session.
- Commit/deployment: implementation and documentation were pushed as sequential commits directly to `main`; this log entry is being appended now. Vercel deployment status for the latest SHA is not yet verified.
- Remaining risks: monthly people lists remain shared across months; expense amount edits redistribute the updated total evenly across the saved recipients rather than preserving custom allocation ratios. Historical month editing and cross-device behavior still need authenticated browser testing.


### Verification update — 2026-11-22
- Vercel production deployment for implementation commit `79069bd237d5460615079665777c9e19798e4265` reached `READY`; GitHub's Vercel commit status is `success`. Deployment: https://projecthulksar-iuh7vcexa-kukki.vercel.app. Production aliases include https://projecthulksar.vercel.app.
- Vercel's production build is the build verification for that exact implementation SHA. A separate local `npm run check`, `npm run build`, and automated test run were not performed in this session.
- Authenticated month-to-month read/write, historical editing, lender persistence, and interactive switching still require a signed-in browser/device smoke test; build readiness alone does not prove those live data flows.
- A documentation-only verification note is being committed after the successful implementation deployment; recheck the deployment for the final documentation SHA before reporting the final release state.


## 2026-11-22 — Export all messCulator data as readable TXT
- Goal: let a user download a portable plain-text copy of all messCulator records that a person or language model can understand without needing the app.
- Changed `src/pages/messculator.astro`: added an “Export all data (.txt)” action in the monthly report. The client creates a UTF-8 text file locally; it includes account-wide context, instructions for interpreting the data, current people, all month summaries, monthly budgets, every expense and its per-person allocations, all dated borrowings and optional lender names, and legacy undated borrowed money. Records include stable IDs, month keys, ISO timestamps, INR values and exact integer paise.
- Export covers every available month, not just the selected month. It waits for the initial account/cloud load to finish so a signed-in user does not accidentally export only a pre-sync local snapshot. It does not send the generated file to a server.
- Updated `README.md`, `AGENTS.md`, and `agent.md` with the export contents, privacy behavior and implementation contract.
- Data/security impact: no schema/API/collection changes. Export uses the already-loaded state belonging to the current signed-in account or local device; no additional data is requested or uploaded. The downloaded file contains personal names and financial details and should be handled carefully.
- Verification: source-level inspection only so far. Local `npm run check`, `npm run build`, browser download verification, and authenticated multi-month export comparison have not yet been run in this GitHub-connected session.
- Commit/deployment: implementation and documentation are being pushed directly to `main`; production deployment status for the final commit is pending.
- Remaining risks: browser download behavior and completeness should be smoke-tested on desktop and Android, including signed-in cloud data and offline local-only data.


### Verification update — 2026-11-22
- Implementation commit `4a6bc2e71a08927a553654b0298f868428f74b62` has a successful Vercel production deployment (`READY`) with production aliases including https://projecthulksar.vercel.app. The deployment built the exact implementation commit containing the corrected UTF-8 line endings and BOM.
- The export button waits for the initial account fetch/sync promise before creating the download. The export is generated client-side as a UTF-8 `.txt` file; the app does not upload it.
- No standalone local `npm run check` or manual browser download test was run in this session. The Vercel production build is the observed build verification; signed-in account data completeness and Android download behavior still need manual smoke testing.
- This verification note is documentation-only and will produce a newer deployment SHA; the feature implementation itself is on the READY deployment above.


## 2026-11-22 — User-defined messCulator calculation periods

- Goal: replace automatic calendar-month budget cycles with calculation periods that each user starts when they choose.
- Changed `src/pages/messculator.astro`: replaced the month picker with a calculation-period selector and a “New calculation” flow. A period has a required start date, optional end date and optional name. Budgets, expenses and borrowings are scoped to the selected period; the user explicitly decides when to start another calculation. Updated report/export wording to describe periods.
- Changed `src/pages/api/messculator.ts`: added validated `periods` metadata to the existing budget document and optional `periodId` on expense/borrowing records. Existing user-scoped collections and snapshot transaction behavior remain unchanged.
- Backward compatibility: existing `monthlyBudgets` are migrated client-side into `legacy-YYYY-MM` periods; old expense/borrowing records without `periodId` are assigned to their timestamp month. Existing amounts, splits, lender names and timestamps are retained. No collections were added, renamed or dropped.
- Data/security impact: period data remains inside the existing authenticated per-user messCulator snapshot. Period dates, names and budgets are validated server-side; no account ownership or auth behavior was changed.
- Documentation: updated README, AGENTS.md and agent.md with the manual-period contract and migration rules.
- Verification: source-level review only. Local `npm run check`, `npm run build`, automated tests, authenticated legacy-data migration, cross-device persistence and mobile interaction tests have not been run in this GitHub-connected session.
- Commits: implementation changes pushed sequentially to `main`; documentation commits and exact production deployment verification are pending.
- Remaining risks: period summaries/export and historical data should be smoke-tested with an authenticated account containing pre-existing monthly records. Shared people list remains account-wide rather than period-specific.


### Verification update — user-defined calculation periods
- Latest implementation commit `98b26a0e54916da574e1bd37807b8a0c89bcbd08` reached Vercel production state `READY`; production alias: https://projecthulksar.vercel.app.
- Vercel build logs confirm `npm run build` completed and the server/client bundles were generated successfully.
- The change preserves legacy month budgets and transactions by migrating them into `legacy-YYYY-MM` periods, including months that contain transactions but had no saved budget. Existing expense splits, borrowing amounts, lender names and timestamps remain intact.
- Local `npm run check`, standalone local `npm run build`, authenticated account migration/persistence tests and Android/desktop interaction tests were not run in this session. Complete those smoke tests before relying on the new flow for critical financial records.
