# Security Policy

## 🚨 CRITICAL ALERT: Git History Exposure

**A Google Maps API key was exposed in the Git commit history of this repository.**

### Exposed Key Pattern

```
AIzaSyD6C3RUtIB1QDjZRWBIRyR*
```

⚠️ **IMPORTANT**: While this key is no longer in the current codebase, **it remains accessible in Git history** and must be revoked immediately to prevent unauthorized use.

## Immediate Action Required

### 1. Revoke the Exposed API Key

**You must revoke the exposed key immediately:**

1. Navigate to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Go to **APIs & Services** → **Credentials**
4. Find the API key matching the pattern `AIzaSyD6C3RUtIB1QDjZRWBIRyR*`
5. Click on the key and select **Delete** or **Regenerate**
6. Confirm the deletion

### 2. Generate a New API Key

After revoking the old key, create a new one:

1. In **APIs & Services** → **Credentials**, click **Create Credentials**
2. Select **API Key**
3. Copy the new key immediately
4. **Recommended**: Click **Restrict Key** and add:
   - Application restrictions (e.g., HTTP referrers for web apps)
   - API restrictions (e.g., only Maps JavaScript API)

### 3. Configure the New Key Securely

**Never commit API keys to Git.** Use environment variables instead:

1. Copy `.env.example` to `.env`:

   ```bash
   cp .env.example .env
   ```

2. Add your new API key to `.env`:

   ```bash
   GOOGLE_MAPS_KEY=your_new_api_key_here
   ```

3. Verify `.env` is in `.gitignore` (it should be by default)

4. For production deployments (e.g., Render, Vercel):
   - Set `GOOGLE_MAPS_KEY` as an environment variable in your deployment platform
   - Never hardcode keys in deployment configuration files

## Best Practices for Secret Management

### DO ✅

- **Use environment variables** for all sensitive data
- **Add `.env` to `.gitignore`** (already configured)
- **Use `.env.example`** with placeholder values for documentation
- **Rotate API keys regularly** (every 90 days recommended)
- **Restrict API keys** with application and API restrictions
- **Use secret management tools** (e.g., GitHub Secrets, AWS Secrets Manager)
- **Enable pre-commit hooks** to catch secrets before they're committed (see below)

### DON'T ❌

- Never commit `.env` files with real values
- Never hardcode API keys in source code
- Never share API keys in chat, email, or documentation
- Never commit credentials to Git (even in "private" repos)
- Never ignore security warnings from secret scanning tools

## Pre-commit Security Hooks

This repository uses `detect-secrets` to prevent accidental credential commits.

### Installation

Install the security hooks automatically:

```bash
npm install
```

This runs the `prepare` script which sets up Git hooks.

### Manual Installation

If hooks aren't installed automatically:

```bash
npm run prepare
```

### Scanning for Secrets

To scan the repository for potential secrets:

```bash
npm run security:scan
```

To audit the baseline file:

```bash
npm run security:audit
```

### How It Works

- **Pre-commit hook**: Scans staged files before each commit
- **Blocks commits**: If a potential secret is detected, the commit is blocked
- **Baseline file**: `.secrets.baseline` tracks known false positives
- **Manual override**: If a detection is incorrect, add it to the baseline

### Testing the Hook

Try committing a file with a test API key pattern:

```bash
echo "AIzaSyTest123456789012345678901234567" > test-secret.txt
git add test-secret.txt
git commit -m "Test security hook"
```

The commit should be blocked with a warning about the detected secret.

## Removing Sensitive Data from Git History

⚠️ **Advanced users only**: Rewriting Git history can be destructive.

If you need to remove the exposed key from Git history:

1. **Option 1 - GitHub's Guide (Recommended)**:
   - Follow [GitHub's official guide](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)
   - Uses `git filter-repo` or `BFG Repo-Cleaner`

2. **Option 2 - Start Fresh**:
   - Create a new repository without the compromised history
   - Copy current codebase to the new repo
   - Migrate issues, PRs, and documentation manually

3. **After rewriting history**:
   - All collaborators must re-clone the repository
   - Force-push is required: `git push --force`
   - Existing clones and forks will still contain the old history

**Note**: Even after rewriting history, the exposed key should still be revoked since Git history may have been cached or cloned elsewhere.

## Reporting Security Issues

If you discover a security vulnerability in this project:

1. **Do NOT** open a public issue
2. Email the repository maintainer directly (check repository settings for contact)
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if available)

We take security seriously and will respond as quickly as possible.

## Resources

- [GitHub: Removing sensitive data from a repository](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)
- [Google Cloud: Best practices for API keys](https://cloud.google.com/docs/authentication/api-keys)
- [OWASP: Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [detect-secrets Documentation](https://github.com/Yelp/detect-secrets)
- [Pre-commit Framework](https://pre-commit.com/)

## Security Update History

| Date       | Update                                                                  |
| ---------- | ----------------------------------------------------------------------- |
| 2026-02-18 | Initial security documentation created; Git history exposure documented |
