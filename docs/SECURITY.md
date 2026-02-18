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
  - Optional feature - app works without it

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

To verify no secrets are exposed:

```bash
# Search for potential API key patterns
git log --all -p | grep -i "api.*key\|secret\|token" | grep -v "\.example\|placeholder"

# Check current files
grep -r "AIza" . --exclude-dir=node_modules --exclude-dir=.git
```

### 📚 Additional Resources

- [Google Maps API Security Best Practices](https://developers.google.com/maps/api-security-best-practices)
- [Supabase Security Best Practices](https://supabase.com/docs/guides/api/securing-your-api)
- [GitHub Actions Security](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
