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
