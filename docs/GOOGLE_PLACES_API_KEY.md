# Google Places API Key Setup

## Where is the API key stored?

The Google Places API key is stored in a local `.env` file in the repository root.

### File: `.env`

```
GOOGLE_MAPS_KEY=AIzaSyD6C3RUtIB1QDjZRWBIRyRfsyyB97k-bJ4
PORT=5055
```

## Security

✅ **The `.env` file is already in `.gitignore` and will NOT be committed to the repository.**

The actual API key is kept secure locally and not pushed to GitHub.

## Setup for other developers

When other developers clone the repository, they should:

1. Copy `.env.example` to `.env`
2. Replace the placeholder with the actual API key
3. The key can be shared securely via password manager or other secure channel

```bash
cp .env.example .env
# Then edit .env and add the real API key
```

## Usage

The API key is used by the maps proxy server (`server/maps-proxy.ts`) which provides:

- **Places Autocomplete API** - for location search
- **Place Details API** - for getting formatted addresses
- **Routes API** - for computing travel times

The server reads the key from `process.env.GOOGLE_MAPS_KEY` at startup.

## Current API Key

**Key ID**: AIzaSyD6C3RUtIB1QDjZRWBIRyRfsyyB97k-bJ4

This key should be:
- Restricted to specific APIs (Places API, Routes API)
- Restricted to specific domains/IPs if possible
- Monitored for usage in Google Cloud Console

## Running the server

To start the maps proxy server with the API key:

```bash
# Make sure dependencies are installed
npm ci

# Run the server (it will automatically load .env)
tsx server/maps-proxy.ts
```

Or set the environment variable directly:

```bash
GOOGLE_MAPS_KEY=AIzaSyD6C3RUtIB1QDjZRWBIRyRfsyyB97k-bJ4 tsx server/maps-proxy.ts
```
