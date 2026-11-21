# Project Hulksar

**Your life, in sync.** Hulksar is a multi-app personal lifestyle platform. Each mini-app has its own UI, data model and app-prefixed MongoDB collections while sharing one Hulksar account system and one MongoDB Atlas database.

## Platform apps

- **TrackCake / nutrition tracker** — food diary, calorie goals, macros, searchable food history and AI-assisted food logging.
- **Hulksar Tasks** — daily tasks, habit check-ins and history.
- **Hulkie** — personal assistant with configurable AI providers.
- **messCulator** — budget manager, expenses, borrowed funds, people, equal/custom expense splitting and month-based financial reports at `/messculator`.
- **Custom app launcher** — `/apps` lets each user reorder registered apps and choose the default landing app (Hulksar or messCulator). Future apps register in `src/lib/apps.ts`.

New mini-apps should be added as independent sections and must not duplicate or interfere with another app's data.

## Shared database architecture

All Hulksar apps use the same MongoDB Atlas database. The default database name is `hulksar` (overridable through the server-only `MONGODB_DB_NAME` variable). Do not create a separate MongoDB database for each mini-app.

**Collection naming rule:** every new app-specific collection must use the app slug as a prefix, in lowercase snake_case: `<app_slug>_<entity>`. Examples: `messculator_budgets`, `messculator_people`, `messculator_expenses`. Shared platform collections such as `users` and `auth_sessions` are platform-level and do not belong to an individual mini-app.

Existing Hulksar collections such as `food_entries`, `tracker_settings`, `assistant_messages`, `daily_tasks` and `daily_task_logs` are legacy names used by live API routes. Keep them unchanged for compatibility; do not rename, drop or copy live records without a separately reviewed, idempotent migration and verification plan. All newly introduced app-specific collections must follow the prefix rule.

Every user-owned document stores `userId`. API routes derive that value only from the authenticated server session and include it in every read, update and delete filter. Never trust a user ID supplied by the browser. MongoDB credentials stay server-side.

### messCulator collections

messCulator uses five app-prefixed collections in the shared `hulksar` database:

| Collection | Purpose |
|---|---|
| `messculator_budgets` | One budget record per account, stored in integer paise |
| `messculator_people` | People attached to the account's budget |
| `messculator_expenses` | Expense records and timestamps |
| `messculator_expense_splits` | Per-expense person allocations, stored in integer paise |
| `messculator_borrowings` | Individually timestamped borrowing transactions, plus a preserved legacy aggregate record where applicable |

The API creates the collections and their indexes on the first authenticated messCulator request. Budget, people, expense, borrowing and split updates are committed together in a MongoDB transaction. Each query is scoped to the verified account's `userId`.

### Monthly financial reports

- Select a calendar month to review expenses, timestamped borrowing transactions, net cash movement, transaction count and per-person expense shares. Expense history follows the selected month; top-level budget and cash balances remain all-time totals.
- New borrowing transactions are stored individually with timestamps. Old aggregate borrowing is preserved in all-time totals but is not attributed to a month because its historical transaction dates are unavailable.

### App launcher preferences

- `/apps` provides default-home selection and up/down ordering controls. The root dashboard opens messCulator directly when it is the saved default.
- Preferences are stored in user-scoped `hulksar_app_preferences` and cached locally for guest/offline fallback. Register future apps in `src/lib/apps.ts`; do not duplicate app registries across UI/API.

### messCulator data sync

- Signed-in users load and save their budget through the authenticated `/api/messculator` endpoint.
- Existing browser-only messCulator data is not silently assigned to an account. On first sync, the app asks before uploading device data or replacing a local copy with an existing account budget.
- Local browser storage remains a fallback when the user is signed out or the database is temporarily unavailable.
- Once synced, the budget is available on other devices after signing into the same Hulksar account.
- Resetting the budget removes only that account's messCulator records; it does not touch another app's collections.

## Progress tracking for contributors

Every meaningful implementation must update `AGENTS.md`, `agent.md`, `README.md`, and append a dated entry to `docs/DEVELOPMENT_LOG.md`. Track completed work, current state, checks actually run, remaining risks, and commit/deployment status. Read the latest progress entry before continuing a task.

## Technology

- Astro 5 + TypeScript, Node.js 22 and Vercel.
- MongoDB Atlas using the official MongoDB Node.js driver.
- Hulksar server-managed accounts and HttpOnly session cookies; account and session records live in the shared MongoDB database.
- Groq, Gemini and OpenRouter for AI features.
- Open Food Facts and USDA FoodData Central for nutrition research.

Supabase migration files under `supabase/migrations/` are retained as historical reference for the legacy TrackCake PostgreSQL schema. They are not the active messCulator database and must not be reapplied to the shared Supabase project.

## Image privacy

Food photos are processed in memory by the server-side vision endpoint and sent to the selected AI provider. Hulksar does not upload them to permanent file storage or save image bytes/base64 data in MongoDB. Only returned nutrition details are eligible to be saved as a food entry. Avoid logging image payloads, and review each AI provider's own request-retention policy.

## Local setup

Requirements: Node.js 22 and npm.

```bash
npm install
cp .env.example .env
npm run dev
```

Open http://localhost:4321.

## Environment

Add these values to your local `.env` and Vercel project settings:

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | MongoDB Atlas connection string (server-only) |
| `MONGODB_DB_NAME` | Database name; defaults to `hulksar` |
| `GEMINI_API_KEY` | Optional Gemini AI provider |
| `GROQ_API_KEY` | Optional Groq AI provider |
| `OPENROUTER_API_KEY` | Optional OpenRouter AI provider |
| `USDA_FDC_API_KEY` | Optional USDA nutrition lookup key |

Add model overrides only when needed; the names are listed in `.env.example`. Never commit real API keys, MongoDB connection strings, or service credentials. MongoDB and AI credentials must not use a `PUBLIC_` prefix.

## Build and checks

```bash
npm run check
npm run build
```

## Original project

The starting point is [AravindSAsok/tracKcake](https://github.com/AravindSAsok/tracKcake). Project Hulksar is maintained independently; new lifestyle apps should be added here using the shared database and app-prefixed collection contract.
