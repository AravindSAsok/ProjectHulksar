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
