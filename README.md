# Project Hulksar

**Your life, in sync.** A personal lifestyle hub, starting with nutrition and designed to grow into routines, wellbeing, activity and everyday life tracking.

This repository is an independent application based on TrackCake's food diary experience. Hulksar keeps the existing nutrition UI and AI workflows while using MongoDB Atlas as its primary application database.

## Current foundation

- Manual, text-assisted and photo-assisted food logging.
- Calorie goals, macro summaries, meal breakdowns and searchable food history.
- Food history editing and deletion.
- Supabase Auth for email/password and anonymous sessions.
- MongoDB Atlas for user-scoped application data.
- Hulkie assistant and configurable AI providers.
- Dark red/black default theme with a saved light-theme toggle.

## Multi-app platform

Hulksar now includes **messCulator**, a separate budget and shared-expense calculator at `/messculator`.

- Set an original budget and track total spending, remaining budget, and negative overspending.
- Add borrowed funds separately. The available-cash figure includes borrowing, while the original budget balance remains visible so borrowed money is never mistaken for budget.
- Add people to a shared budget. Expenses split equally by default, with optional custom per-person amounts that must sum exactly to the expense total.
- Review expense history and each person's cumulative share; remove expenses and people when needed. Existing saved allocations retain the person's name even if that person is later removed from the active list.
- messCulator is intentionally local-first and currently saves to this browser/device using `localStorage`. It does not use Hulksar sign-in, MongoDB, or cross-device cloud sync. Clearing browser site data or using another browser/device will not carry this budget over, so users should keep that limitation in mind.

Open it from the dashboard navigation or visit `/messculator` directly. It shares Hulksar's saved theme and responsive app shell while keeping its budget data separate from nutrition and task records.

## Technology

- Astro 5 + TypeScript.
- Astro API routes running on the server.
- MongoDB Atlas using the official MongoDB Node.js driver.
- Supabase Auth for identity only.
- Groq, Gemini and OpenRouter for AI features.
- Open Food Facts and USDA FoodData Central for nutrition research.
- Vercel for hosting.

## Database and account separation

MongoDB Atlas is the primary database for Hulksar. Food entries, calorie goals and Hulkie conversation history are stored in MongoDB documents scoped by the authenticated Supabase user ID.

Supabase is retained for authentication only. The browser sends its Supabase access token to Hulksar API routes; the server verifies the token and applies the verified user ID to every MongoDB query. The MongoDB URI and AI provider keys must never be exposed to browser code.

### Existing TrackCake data

On the first authenticated Hulksar tracker request, the API performs a one-time, read-only import of that user's existing food_entries and tracker_settings from the legacy shared Supabase PostgreSQL database into MongoDB. It records a per-user migration marker so the import is not repeated.

The import does not update or delete any Supabase rows. TrackCake remains untouched. After import, new Hulksar food entries, goals and Hulkie messages are stored in MongoDB and are not automatically synchronized back to TrackCake's PostgreSQL database.

Keep the existing Supabase Auth project and add https://projecthulksar.vercel.app/** to its Auth Redirect URLs allowlist. Do not change the existing Auth Site URL if TrackCake still uses it.

The supabase/migrations directory is retained as historical reference for the legacy PostgreSQL schema. **Do not run those SQL migrations again** against the shared Supabase project.

## Image privacy

Food photos are processed in memory by the server-side vision endpoint and sent to the selected AI provider. Hulksar does not upload them to permanent file storage or save image bytes/base64 data in MongoDB. Only the returned nutrition details are eligible to be saved as a food entry. Avoid logging image payloads, and review each AI provider's own request-retention policy.

## Local setup

Requirements: Node.js 22 and npm.

```bash
npm install
cp .env.example .env
npm run dev
```

Open http://localhost:4321.

## Environment

Add these values to your local .env and Vercel project settings:

| Variable | Purpose |
|---|---|
| MONGODB_URI | MongoDB Atlas connection string (server-only) |
| MONGODB_DB_NAME | Database name; defaults to hulksar |
| PUBLIC_SUPABASE_URL | Supabase Auth project URL |
| PUBLIC_SUPABASE_ANON_KEY | Supabase public anon/publishable key |
| GEMINI_API_KEY | Optional Gemini AI provider |
| GROQ_API_KEY | Optional Groq AI provider |
| OPENROUTER_API_KEY | Optional OpenRouter AI provider |
| USDA_FDC_API_KEY | Optional USDA nutrition lookup key |

Add model overrides only when needed; the names are listed in .env.example. Never commit real API keys, MongoDB connection strings, or service-role keys. MongoDB and AI credentials must not use a PUBLIC_ prefix.

## Data model

MongoDB collections currently used:

- food_entries: food details and nutrition values, with userId ownership.
- tracker_settings: per-user calorie goal.
- assistant_messages: per-user Hulkie conversation history.
- migration_state: one-time legacy import markers.

Indexes are created by the API on first use. Every user-owned query is filtered by the verified Supabase user ID.

## Build and checks

```bash
npm run check
npm run build
```

## Original project

The starting point is [AravindSAsok/tracKcake](https://github.com/AravindSAsok/tracKcake). Project Hulksar is maintained independently; future lifestyle modules should be added here without changing TrackCake.
