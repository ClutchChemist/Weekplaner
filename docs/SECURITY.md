# Security Policy

## Supported Versions

This project follows security best practices for handling API keys and sensitive data.

## Reporting a Vulnerability

If you discover a security vulnerability, please report it by:
1. Opening an issue with the tag `security` (for low-risk issues)
2. For sensitive security issues, contact the maintainer directly

## API Key Management

### ✅ Current Security Measures

This project implements the following security measures:

1. **No Hardcoded Secrets**: All API keys are loaded from environment variables
2. **Git Protection**: `.gitignore` excludes all `.env` files from version control
3. **Example Template**: `.env.example` provides a template with placeholder values only
4. **GitHub Actions Security**: CI/CD workflows use GitHub Secrets for sensitive data
5. **Server-Side Protection**: API keys are only used server-side, never exposed to clients

### 🔑 API Keys Used

- **Google Maps API Key** (`GOOGLE_MAPS_KEY`): Used server-side only in `server/maps-proxy.ts`
  - Never exposed to the client
  - Loaded from environment variables
  - Required for Maps features (optional for basic functionality)

- **Supabase Keys** (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`): Used for cloud sync
  - Anon key is public-safe (protected by Row Level Security policies)
  - Optional feature - enables profile cloud synchronization across devices
  - Core scheduling and planning features work without Supabase configuration

### 📋 Setup Instructions

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Add your actual API keys to `.env`:
   ```
   GOOGLE_MAPS_KEY=your_actual_key_here
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

3. **IMPORTANT**: Never commit the `.env` file to version control

### ⚠️ Best Practices

- ✅ Use environment variables for all secrets
- ✅ Keep `.env` in `.gitignore`
- ✅ Use different API keys for development and production
- ✅ Rotate keys periodically
- ✅ Use GitHub Secrets for CI/CD pipelines
- ❌ Never hardcode API keys in source code
- ❌ Never commit `.env` files
- ❌ Never share API keys in issues or pull requests

### 🔍 Verification

To verify no secrets are exposed, you can use these methods:

#### Quick Manual Check

```bash
# Check current files for Google Maps API keys (AIza pattern)
grep -rE "AIza[0-9A-Za-z_-]{35}" . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=docs

# Check for other common secret patterns (OpenAI, AWS, GitHub tokens)
grep -rE "(sk-[a-zA-Z0-9]{40,}|AKIA[0-9A-Z]{16}|ghp_[a-zA-Z0-9]{36})" . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=docs

# Search git history for patterns (review results manually)
git log --all -p | grep -E "(AIza[0-9A-Za-z_-]{35}|sk-[a-zA-Z0-9]{40,})"
```

#### Recommended Tools

For comprehensive secret scanning, consider using specialized tools:

- **[gitleaks](https://github.com/gitleaks/gitleaks)**: Scan git repositories for secrets
  ```bash
  # Install: brew install gitleaks (macOS) or see GitHub releases
  gitleaks detect --source . --verbose
  ```

- **[truffleHog](https://github.com/trufflesecurity/trufflehog)**: Find leaked credentials
  ```bash
  # Install: brew install trufflehog (macOS) or see GitHub releases
  trufflehog git file://. --only-verified
  ```

- **[git-secrets](https://github.com/awslabs/git-secrets)**: Prevent committing secrets
  ```bash
  # Install and configure hooks to prevent future leaks
  git secrets --install
  git secrets --register-aws
  ```

**Note**: Manual grep commands may produce false positives in documentation. Specialized tools provide better accuracy and can differentiate between actual secrets and references.

### 📚 Additional Resources

- [Google Maps API Security Best Practices](https://developers.google.com/maps/api-security-best-practices)
- [Supabase Security Best Practices](https://supabase.com/docs/guides/api/securing-your-api)
- [GitHub Actions Security](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
