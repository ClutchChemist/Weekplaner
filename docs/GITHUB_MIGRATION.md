# GitHub Migration Guide (Public Repo)

## What is already prepared

- `.gitignore` blocks secrets and local artifacts (`.env`, zips, backups, dist, etc.).
- `.env.example` exists as safe template.
- CI is configured in `.github/workflows/ci.yml`:
  - `npm ci`
  - `npm run lint`
  - `npm run build`

## One-time manual steps (you)

Because GitHub account actions require your authentication, these steps must be done by you:

1. Create a new repository on GitHub.
   - Name suggestion: `ubc-training-board`
   - Visibility: **Public**
   - Do **not** initialize with README/.gitignore/license (repo should be empty)
2. Copy the remote URL (HTTPS or SSH).
3. In your local project folder, add remote and push.
4. In GitHub repo settings, verify visibility is Public.

## Recommended branch protections (optional, but useful)

- Protect `main` branch:
  - require PR before merge
  - require status check `CI / lint-and-build`

## Secrets / API keys

This project can run without API key for basic workflows.
For Maps features, use local `.env` (never commit secrets):

- `GOOGLE_MAPS_KEY=...`
- `PORT=5055`

Public repos are searchable, so never place real keys in code, commits, or issue text.
