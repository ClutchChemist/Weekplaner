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

⚠️ Never commit real API keys.

## GitHub migration

This repository is prepared for GitHub migration:

- CI workflow at `.github/workflows/ci.yml` runs lint + build on push/PR.
- `.gitignore` excludes secrets and local artifacts.

Detailed migration steps:

- `docs/GITHUB_MIGRATION.md`
