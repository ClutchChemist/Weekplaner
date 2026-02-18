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

⚠️ Never commit real API keys.

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
