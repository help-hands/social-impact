# social-impact

Mobile-friendly charity donation record system for managing charity donation records.

Planned stack:

- GitHub Pages frontend
- Supabase authentication and database
- Google Apps Script API
- Google Drive document storage

## Local Setup

```bash
pnpm install
cp .env.example .env.local
supabase start
pnpm run migration
pnpm dev
```

Add real Supabase and Apps Script values to `.env.local`. Do not commit `.env.local`.

Only `VITE_` values are available to the browser app. Keep the database URL as a server/CLI-only variable:

```bash
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

The local database must be the Supabase local database, not plain PostgreSQL. Supabase local development creates the `auth` schema used by this project.

For GitHub Actions, set the Supabase database connection string as the `DATABASE_URL` repository secret.

Run database migrations intentionally:

```bash
pnpm run migration
```

This reads `DATABASE_URL` from `.env` or `.env.local` and applies pending SQL files in `supabase/migrations/`. GitHub Actions uses the same `DATABASE_URL` secret when migration files are pushed to `main`, including after PR merges.

Locally, the migration command shows the target database URL with the password masked and asks you to type `yes` before applying changes. In GitHub Actions, the confirmation is skipped because CI already runs against the configured `DATABASE_URL` secret.

## Apps Script

The Apps Script API lives in `apps-script/`. It stores files in Google Drive, links uploaded documents to Supabase records, and can create admin-only Google Sheet snapshots before migrations.

Set real Apps Script secrets in Apps Script project properties, not in GitHub Pages frontend code.
