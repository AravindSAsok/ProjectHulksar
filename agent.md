# Hulksar Agent Guide

> **Canonical instructions:** read the root [`AGENTS.md`](./AGENTS.md) first. This legacy filename is retained for compatibility; keep shared contributor rules aligned with `AGENTS.md`.


This file is the working agreement for AI coding agents and human contributors maintaining Hulksar. Read it before making changes.

## 1. Product and priorities

Hulksar is a lightweight, privacy-conscious food diary and calorie tracker. The product helps people record meals, review estimated nutrition, understand daily calorie and macro progress, and ask Hulkie questions about their own diary.

Priorities, in order:

1. Preserve user data, authentication, authorization, and cloud-sync correctness.
2. Preserve all existing food logging and AI workflows.
3. Make the experience reliable and usable on phones, tablets, and desktops.
4. Keep the interface calm, fast, accessible, and uncluttered.
5. Prefer small, reviewable changes over broad rewrites.

Do not replace working behavior with mocks, fixtures, placeholders, or hard-coded account data.

## 2. Technology and architecture

- Framework: Astro 5 with TypeScript.
- Runtime/deployment: Vercel using the Astro Vercel adapter.
- Identity: Supabase Auth via the Supabase JS client.
- Application persistence: MongoDB Atlas via the official MongoDB Node.js driver, accessed only from server-side Astro API routes.
- Server API routes verify the incoming Supabase bearer token with auth.getUser() and scope every MongoDB query by the verified userId.
- AI providers: Groq, Gemini, and OpenRouter. Provider credentials must remain server-side.
- Styling: shared stylesheet at `src/styles/global.css`.
- Main dashboard markup: `src/pages/index.astro`.
- Main diary and food-entry interactions: `src/scripts/app.ts`.
- Account and food-estimation model selector behavior: `src/scripts/ai-account.ts`.
- Hulkie popup and chat client: `src/scripts/hulkie.ts`.
- Shared document shell: `src/layouts/Layout.astro`.
- Server endpoints: `src/pages/api/`.
- Supabase migrations and database policy source: `supabase/migrations/`.

Use the existing modules and storage abstractions. Do not introduce a second competing state-management or persistence layer.

## 3. Non-negotiable product contracts

### Authentication and user data

- Preserve Supabase email/password sign-up, sign-in, sign-out, session persistence, token refresh, and guest/anonymous behavior.
- Supabase is used for authentication only. Never use Supabase Postgres as the active Hulksar application store.
- Send the current Supabase access token as a Bearer token to protected Hulksar API routes. Verify it server-side before accessing MongoDB.
- Never expose service-role keys or provider API keys in browser code, public environment variables, logs, or committed files.
- Every MongoDB document containing user data must include userId. Every read, update and delete must include the verified userId in its MongoDB filter. Never trust a client-supplied user ID.
- Do not change table names, columns, API payload shapes, or migration history unless the task explicitly requires it and the change is reviewed end-to-end.
- Guest/local diary import must not overwrite another user's rows. Use user-scoped IDs and idempotent insert-only operations.
- Do not clear local or cloud data as a side effect of cosmetic UI changes.
- Display the authenticated user's metadata name when present; otherwise derive a readable label from the email local-part. Keep the full email available in account details.

### Food diary

Preserve all of the following:
- Manual food entry, editing, and deletion.
- AI text-based food estimates and the review-before-save step.
- AI photo-based food estimates, progress updates, cancellation, and review-before-save.
- Provider/model discovery and selection for Groq, Gemini, and OpenRouter.
- Automatic provider fallback.
- Local storage fallback and MongoDB cloud synchronization.
- One-time, read-only import of legacy Supabase PostgreSQL food entries and tracker settings into MongoDB. Never write to or delete legacy PostgreSQL rows.
- Daily calorie goal, rolling 24-hour calorie balance, macro totals, meal breakdown, searchable/date-filtered history, and seven-day consistency summary.

Nutrition values are estimates, not medical advice. Do not imply that estimates are exact.

### Hulkie

- Hulkie is a floating popup/chat widget on the dashboard, never a separate page or route.
- Opening or closing Hulkie must not navigate, reload, or replace the dashboard.
- Preserve chat history, suggestions, provider/model selection, authenticated API requests, and message submission.
- Keep the dashboard mounted underneath the mobile overlay.
- Do not automatically open the mobile keyboard when the popup is opened.
- Maintain accessible close controls, sensible focus behavior, and scrollable message history.


## Responsive and optimistic interaction contract
- Every user-facing action button must respond to the tap immediately. For data mutations (task completion, task add/edit/archive, food add/edit/delete, calorie-goal changes), update the visible UI from local state first, then synchronize with the authenticated API/MongoDB in the background. Never make the user wait for the network before showing the intended state.
- Keep non-mutating controls (navigation, opening/closing dialogs, theme/view switches) immediate and local; do not add unnecessary API calls or disable unrelated controls while a mutation is syncing.
- Permit repeated taps on task completion: one tap marks done, the next tap marks not done. Serialize/coalesce per-task/date writes so the last tap wins without duplicate or out-of-order writes. Do not use a page-wide busy flag to block task toggles.
- If cloud synchronization fails, retain the local-first state where the existing storage contract supports it and show exactly: “Unstable network, some data may not be synced” for 2 seconds. Do not claim cloud sync succeeded. Preserve existing auth and user-scoped MongoDB API checks; never bypass server authentication.
- Avoid redundant client-side session round trips before protected API calls; let the API perform its existing authoritative authentication check. Cache one-time MongoDB index initialization per warm server instance rather than calling createIndex on every request.
- Keep feedback accessible (role=status/aria-live), touch targets comfortable, and keyboard activation functional. Do not optimistically discard data on a failed mutation without a clear rollback or local-save behavior.

## 4. Development workflow

Before editing:

1. Read this guide and the relevant source files.
2. Check the current branch and latest commit. Work on the requested branch; the production branch is `main`.
3. Inspect the existing implementation and identify the actual cause of the issue.
4. Trace affected data flow from UI to client logic to API/storage before changing contracts.
5. Check for existing styles and helpers before adding new ones.
6. Define the smallest safe patch and list the behaviors that must remain unchanged.

Documentation and handoff are mandatory for every meaningful task:

- Update the canonical root `AGENTS.md` with durable project knowledge, behavior/API/architecture changes, and instructions future agents need.
- Append a dated entry to `docs/DEVELOPMENT_LOG.md` with the goal/root cause, changed files, behavior and data/API impact, checks actually run, commit/deployment reference, and remaining risks.
- Keep this legacy `agent.md` aligned with shared workflow rules in `AGENTS.md`.
- Do not rely on chat history as the only record of a project change; do not duplicate the entire chronological log in the agent guide.

During implementation:

1. Make targeted changes in the existing architecture.
2. Keep TypeScript types explicit and handle network/auth errors visibly.
3. Avoid duplicated event listeners, global fetch monkey-patches, duplicated CSS declarations, and conflicting media queries.
4. Prefer semantic HTML, accessible labels, keyboard support, and visible focus states.
5. Use stable IDs and existing API contracts.
6. Keep mobile controls touch-friendly and avoid viewport zoom caused by undersized form-control text.
7. Do not introduce new dependencies unless necessary; explain why if one is added.
8. Never commit secrets, local environment files, tokens, or user data.

Before committing:

1. Run `npm ci` when the lockfile is present and dependencies need installing.
2. Run `npm run check`.
3. Run `npm run build`.
4. Run relevant automated tests if present; add focused tests for new non-trivial logic where practical.
5. Review the diff for accidental changes, dead code, debug output, secrets, and unrelated formatting.
6. Verify the working tree and commit only the intended files.

After committing:

1. Push to the intended branch.
2. Confirm the CI/Vercel deployment corresponds to the exact commit.
3. Inspect build logs and wait for a terminal deployment state.
4. Verify the production alias points to the intended deployment.
5. Perform smoke tests against the deployed app when browser tooling is available.
6. Report exactly what was tested. Distinguish build checks from real browser, authenticated-user, provider, and device tests.

## 5. Responsive UI standards

Design for these viewport ranges:
- 320–360px: compact phones.
- 375–430px: standard phones.
- 431–680px: large phones and narrow landscape layouts.
- 681–1024px: tablets.
- 1025px and above: laptops and desktops.

Rules:
- Use mobile-first layout decisions; do not merely scale down desktop layouts.
- Prevent horizontal page overflow and clipped text.
- Keep important account details readable. On narrow screens, use a compact account trigger and put the complete name/email in an expandable or dialog-based profile view.
- Use at least 16px text for mobile form controls to prevent automatic browser focus zoom.
- Respect safe-area insets on devices that expose them.
- Make dialogs and popups fit the available viewport and remain scrollable.
- Keep touch targets comfortable (aim for approximately 44px).
- Avoid fixed heights for content that can grow or be affected by the on-screen keyboard.
- Prefer `dvh` with a sensible fallback where dynamic viewport sizing is needed.
- Respect `prefers-reduced-motion`.
- Test long emails, long names, empty states, loading states, and error messages.

## 6. AI provider and API safety

- Provider keys are read only in server-side API routes.
- Never send secrets to the browser or echo them in API responses.
- Treat provider model catalogs as dynamic; do not hard-code a model as available without checking the provider response.
- Preserve explicit provider/model selection and automatic fallback behavior.
- Validate and bound user input on the server.
- Handle malformed JSON and non-2xx responses without crashing the UI.
- Do not silently swallow meaningful failures; show concise actionable errors without leaking secrets.
- Avoid logging full prompts, food diaries, access tokens, or personal account details.

## 7. Database and migration safety

- Keep MongoDB collection documents versionable and export-friendly. Add indexes for user-scoped queries and common sort/filter paths.
- Never expose MONGODB_URI to browser code or prefix it with PUBLIC_.
- Verify every MongoDB read/write/delete is scoped to the server-verified userId.
- Preserve the one-time, read-only legacy Supabase import. Do not run or modify the copied SQL migrations against the shared Supabase project.
- Do not store uploaded food images or base64 image payloads. Vision requests are processed transiently; persist only reviewed nutrition details.
- Verify local fallback, queued insert retries, legacy import idempotency, and guest-to-account behavior whenever persistence code changes.

## 8. Verification checklist

For UI changes:
- [ ] Check 320px, 360px, 390px, 430px, 768px, 1024px, and desktop widths.
- [ ] Check for horizontal scrolling and clipped content.
- [ ] Check browser zoom/scale and input focus behavior.
- [ ] Check keyboard-open and keyboard-closed states on mobile when possible.
- [ ] Check safe-area spacing and dialog scrolling.
- [ ] Check keyboard navigation, labels, and focus visibility.

For account changes:
- [ ] Guest state still works.
- [ ] Signed-in display name uses available profile metadata.
- [ ] Email fallback is readable.
- [ ] Full email is visible in account details, including long addresses.
- [ ] Sign-up, sign-in, verification resend, sign-out, and session restoration remain intact.

For Hulkie changes:
- [ ] Opens and closes without route changes or page reload.
- [ ] Dashboard remains mounted underneath the overlay.
- [ ] History loads and remains visible after closing/reopening.
- [ ] Provider and model selectors work.
- [ ] Suggestions and Enter-to-send work.
- [ ] Sending, error, and loading states remain usable.
- [ ] Mobile keyboard does not unexpectedly open on launch.

For diary and AI changes:
- [ ] Manual add, edit, and delete work.
- [ ] Text estimate and review-before-save work.
- [ ] Photo estimate, progress/cancel, and review-before-save work.
- [ ] Provider selection and fallback remain intact.
- [ ] Daily totals, macros, meal breakdown, weekly consistency, and goal editing remain correct.
- [ ] Local storage and cloud sync behavior remain intact.

## 9. Git and release conventions

- Keep commits focused and use imperative messages, for example: `Fix mobile account profile display`.
- Do not force-push or rewrite shared history.
- **Always commit and push completed changes directly to `main` by default.** Do not create feature branches or PRs unless the user explicitly asks for them or GitHub protection rules technically block a direct push; if blocked, explain and ask before switching workflows.
- Do not deploy an unbuilt or unverified change when a build check is available.
- If a check cannot be run, say so clearly and do not describe it as passing.
- If production deployment fails, keep the last known-good deployment intact and report the failure; do not claim the release is live.

## 10. Completion report

Every completed task should report:
- Root cause.
- Files changed and why.
- User-visible behavior changed.
- Checks actually run and their results.
- Tests not run and why.
- Commit SHA and link.
- Deployment URL and terminal status, if deployment was requested.

Accuracy is more important than a green-looking report. Never claim a feature, test, commit, or deployment succeeded unless the corresponding result was observed.
