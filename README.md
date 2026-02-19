# UBC Training Board

Training planning board built with React + TypeScript + Vite.

## Tech stack

- React 19
- TypeScript
- Vite
- ESLint

## Local development

Install dependencies:

- `npm ci`

Start dev server:

- `npm run dev`

Lint:

- `npm run lint`

Production build:

- `npm run build`

## Environment variables

Create a local `.env` from `.env.example`.

Expected variables:

- `GOOGLE_MAPS_KEY` (optional if Maps features are not used)
- `PORT` (proxy port, default `5055`)
- `VITE_API_BASE_URL` (optional; use for production frontend to call external proxy)
- `VITE_SUPABASE_URL` (optional; required for cloud sync)
- `VITE_SUPABASE_ANON_KEY` (optional; required for cloud sync)

⚠️ Never commit real API keys.

## 🔒 Security

**⚠️ CRITICAL**: A Google API key was previously exposed in the Git commit history of this repository.

See [SECURITY.md](SECURITY.md) for:

- **Immediate action required** to revoke the exposed key
- Steps to generate and configure a new API key securely
- Best practices for secret management
- Pre-commit hook installation to prevent future exposures

### Quick Setup: Security Hooks

Install pre-commit hooks to prevent accidental credential commits:

```bash
# Install Python tools (if not already installed)
pip install pre-commit detect-secrets

# Install Git hooks (runs automatically during npm install)
npm run prepare
```

The security hooks will:

- ✅ Scan all commits for potential secrets before allowing them
- ✅ Block commits containing API keys, tokens, or credentials
- ✅ Help maintain secure coding practices

**Test the hook** by trying to commit a file with a fake API key - it should be blocked.

For more details, see [SECURITY.md](SECURITY.md).

## GitHub migration

This repository is prepared for GitHub migration:

- CI workflow at `.github/workflows/ci.yml` runs lint + build on push/PR.
- `.gitignore` excludes secrets and local artifacts.

Detailed migration steps:

- `docs/GITHUB_MIGRATION.md`

## GitHub Pages deployment

This project can be deployed via GitHub Actions to GitHub Pages.

- Workflow: `.github/workflows/pages.yml`
- Expected URL: `https://clutchchemist.github.io/Weekplaner/`
- Vite `base` is set automatically with `GITHUB_PAGES=true` during the Pages build.

### Important runtime note

The Vite proxy for `/api` is **dev-only** and works only with `npm run dev`.
For production (GitHub Pages), `/api` requests need either:

- an external backend URL, or
- feature-flagged optional API usage.

## Maps proxy deployment (Render example)

This repo includes `render.yaml` for deploying the Node proxy in `server/maps-proxy.ts`.

### Recommended setup

1. Create a new Render Web Service from this repository.
2. Use settings from `render.yaml` (or import Blueprint).
3. Set environment variable `GOOGLE_MAPS_KEY` in Render dashboard.
4. After deploy, copy service URL (for example `https://weekplaner-maps-proxy.onrender.com`).
5. Set frontend env variable:
   - `VITE_API_BASE_URL=https://<your-render-service>.onrender.com`

### Configure `VITE_API_BASE_URL` in GitHub

Use one of these options in your GitHub repository:

- **Settings → Secrets and variables → Actions → Variables**
  - Name: `VITE_API_BASE_URL`
  - Value: `https://<your-render-service>.onrender.com`
- or **Secrets** with the same name (supported as fallback in workflow).

Then trigger a new Pages deployment:

- Push to `main` **or**
- open **Actions → Deploy Vite App to GitHub Pages → Run workflow**.

Tip: open browser devtools on the deployed site and verify API calls go to:

- `https://<your-render-service>.onrender.com/api/...`

### Local vs production behavior

- Local dev (`npm run dev`): frontend calls `/api/*` through Vite proxy (`vite.config.ts`).
- Production (GitHub Pages): frontend calls `${VITE_API_BASE_URL}/api/*` when `VITE_API_BASE_URL` is set.

## Cloud Sync (Supabase)

The app includes an optional cloud sync in the Profiles dialog:

- Email magic-link sign-in
- Save current session snapshot to cloud
- Load snapshot on another device
- Optional auto-sync while editing

### 1) Set env vars

In `.env`:

- `VITE_SUPABASE_URL=https://<project-ref>.supabase.co`
- `VITE_SUPABASE_ANON_KEY=<public-anon-key>`
- `VITE_SUPABASE_REDIRECT_TO=<optional explicit callback URL>`

Examples for `VITE_SUPABASE_REDIRECT_TO`:

- Local: `http://localhost:5173/`
- GitHub Pages: `https://<user>.github.io/Weekplaner/`

If you leave `VITE_SUPABASE_REDIRECT_TO` empty, the app uses the current page URL automatically.

### 1b) Supabase Auth URL allow-list (required for magic links)

In Supabase Dashboard → **Authentication** → **URL Configuration**:

- set **Site URL** to your app URL
- add your local + production callback URLs to **Redirect URLs**

Without this allow-list, magic-link emails may not be delivered or the sign-in callback will fail.

### 2) Create table + RLS policies

Run this SQL in Supabase SQL editor:

```sql
create table if not exists public.planner_profile_snapshots (
	user_id uuid not null references auth.users(id) on delete cascade,
	profile_id text not null,
	snapshot jsonb not null,
	updated_at timestamptz not null default now(),
	primary key (user_id, profile_id)
);

alter table public.planner_profile_snapshots enable row level security;

create policy "Users can read own profile snapshots"
on public.planner_profile_snapshots
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own profile snapshots"
on public.planner_profile_snapshots
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own profile snapshots"
on public.planner_profile_snapshots
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
```

### 3) Use in app

Open **Profiles** and use **Cloud sync** section:

- enter email + send magic link
- after sign-in: load or save snapshot
- enable auto-sync for seamless device switching
