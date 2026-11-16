# ProjectHulksar

**Your life, in sync.** A personal lifestyle hub, starting with nutrition and designed to grow into routines, wellbeing, activity and everyday life tracking.

This repository is an independent copy of TrackCake's current application. Existing food diary, AI-assisted food estimates, calorie and macro tracking, editable history, and Calkie assistant are retained as the first lifestyle module.

## Current foundation
- Manual, text-assisted and photo-assisted food logging
- Calorie goals, macro summaries, meal breakdowns and history search
- Food history edit/delete actions through a compact row menu
- Supabase Auth and user-scoped PostgreSQL persistence
- Calkie assistant and configurable AI providers
- Dark red/black default theme with a saved light-theme toggle

## Shared identity and data
ProjectHulksar is intended to use the same Supabase project as TrackCake. When configured with the same Supabase project URL and public anon/publishable key, users sign in with the same account and both apps access the same user-owned records under the existing Row Level Security policies. There is no password migration or user duplication.

Do not run the copied SQL migrations against the existing shared database again. They are retained for reference and fresh-environment setup only. Keep TrackCake's current Supabase Auth Site URL unchanged, and add `https://projecthulksar.vercel.app/**` to the Auth Redirect URLs allowlist alongside TrackCake's existing redirect URLs. This is needed for email verification and password recovery links to return to the correct app.

## Local setup
Requirements: Node.js 22 and npm.

```bash
npm install
cp .env.example .env
npm run dev
```

Open http://localhost:4321.

## Environment
Add your keys later in Vercel and your local .env file. The names are documented in `.env.example`. Never commit real API keys or a Supabase service-role key. The browser only receives the Supabase URL and public anon/publishable key; RLS remains the security boundary.

## Build and checks
```bash
npm run check
npm run build
```

## Original project
The starting point is [AravindSAsok/tracKcake](https://github.com/AravindSAsok/tracKcake). ProjectHulksar is maintained independently; future lifestyle modules should be added here without changing TrackCake.
