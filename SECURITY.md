# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it responsibly:

1. **For general security concerns**: Open an issue with the `security` label
2. **For sensitive vulnerabilities**: Contact the maintainer directly (avoid posting sensitive details publicly)

We take security seriously and will respond to reports promptly.

## Security Best Practices

This project follows security best practices for handling sensitive data:

- ✅ No hardcoded API keys or secrets in source code
- ✅ Environment variables for all sensitive configuration
- ✅ `.gitignore` properly configured to exclude `.env` files
- ✅ Server-side API key usage only (never exposed to clients)
- ✅ GitHub Secrets for CI/CD pipelines

For detailed information about our security measures and API key management, see:
- [docs/SECURITY.md](docs/SECURITY.md)
- [docs/GITHUB_MIGRATION.md](docs/GITHUB_MIGRATION.md)

## Supported Versions

This is an actively maintained project. Security updates will be applied to the main branch.

## Additional Information

For questions about security or secure deployment:
- Review our [documentation](docs/)
- Check [GitHub Discussions](https://github.com/ClutchChemist/Weekplaner/discussions)
- Open an issue for clarification
