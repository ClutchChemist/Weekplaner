# VS Code Setup Guide - API Key Setup

## What You Need to Do in VS Code

### ✅ Step 1: Pull Changes from GitHub

Open VS Code and the terminal (Ctrl+` or View → Terminal).

```bash
# Run in terminal:
git pull origin copilot/improve-github-pages-deployment
```

This downloads the new documentation:
- `docs/GOOGLE_PLACES_API_KEY.md` (instructions)
- Updates to other files

---

### ✅ Step 2: Create Local .env File

**IMPORTANT:** The `.env` file with the actual API key was **not** uploaded to GitHub (for security reasons). You must create this file locally.

#### Option A: Create in VS Code

1. Open VS Code
2. Click "New File" or press Ctrl+N
3. Save the file as `.env` in the project root directory
4. Add the following content:

```env
# Google Maps/Places API Key
GOOGLE_MAPS_KEY=AIzaSyD6C3RUtIB1QDjZRWBIRyRfsyyB97k-bJ4

# Server port
PORT=5055
```

#### Option B: Create in Terminal

```bash
# In the project root directory:
cat > .env << 'EOF'
# Google Maps/Places API Key
GOOGLE_MAPS_KEY=AIzaSyD6C3RUtIB1QDjZRWBIRyRfsyyB97k-bJ4

# Server port
PORT=5055
EOF
```

Or simpler:

```bash
cp .env.example .env
```

Then open the `.env` file and replace the placeholder with:
```
GOOGLE_MAPS_KEY=AIzaSyD6C3RUtIB1QDjZRWBIRyRfsyyB97k-bJ4
```

---

### ✅ Step 3: Verify the .env File is Ignored

The `.env` file should **not** appear in Git (it's in `.gitignore`).

Check:

```bash
git status
```

**Expected result:** The `.env` file should **not** be listed.

If it does appear, something is wrong. It should not be committed!

---

### ✅ Step 4: Test That the Server Works

After creating the `.env` file, you can test:

```bash
# Install dependencies (if not already done)
npm ci

# Start the server
npx tsx server/maps-proxy.ts
```

**Expected output:**
```
🗺️  Maps proxy running on :5055
```

If you see this message, everything works! ✅

If you see an error "Missing GOOGLE_MAPS_KEY", the `.env` file was not created correctly.

---

## Summary

**What you need to do:**

1. ✅ **Git Pull** - Get changes from GitHub
2. ✅ **Create `.env` file** - Locally in project root with API key
3. ✅ **Verify** - Use `git status` to ensure `.env` is not tracked
4. ✅ **Test** - Start server and check if it runs

**What you DON'T need to do:**

- ❌ Add/commit the `.env` file to Git
- ❌ Store the API key anywhere else

---

## Quick Guide (Copy & Paste)

```bash
# 1. Pull changes
git pull origin copilot/improve-github-pages-deployment

# 2. Create .env file
cat > .env << 'EOF'
GOOGLE_MAPS_KEY=AIzaSyD6C3RUtIB1QDjZRWBIRyRfsyyB97k-bJ4
PORT=5055
EOF

# 3. Verify
git status  # .env should NOT appear

# 4. Test
npm ci
npx tsx server/maps-proxy.ts
```

---

## Troubleshooting

**Problem:** "Missing GOOGLE_MAPS_KEY in .env"
**Solution:** The `.env` file was not created or has wrong content

**Problem:** `.env` appears in `git status`
**Solution:** This should not happen (it's in `.gitignore`). Don't commit it!

**Problem:** "Cannot find module 'express'"
**Solution:** Run `npm ci` to install dependencies

---

## File Overview

```
Weekplaner/
├── .env               ← NEW: Create locally, DON'T commit
├── .env.example       ← Template (already exists)
├── .gitignore         ← Contains .env (already exists)
├── docs/
│   └── GOOGLE_PLACES_API_KEY.md  ← NEW: Documentation (pulled)
└── server/
    └── maps-proxy.ts  ← Uses the API key
```
