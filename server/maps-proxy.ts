import express from "express";
import cors from "cors";
import "dotenv/config";

const app = express();

const NODE_ENV = String(process.env.NODE_ENV ?? "development").trim().toLowerCase();
const IS_PRODUCTION = NODE_ENV === "production";

function parseCsvEnv(name: string): string[] {
  const normalized = String(process.env[name] ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((raw) => {
      try {
        return new URL(raw).origin;
      } catch {
        return raw.replace(/\/+$/, "");
      }
    });

  return Array.from(new Set(normalized));
}

const allowedOrigins = parseCsvEnv("ALLOWED_ORIGINS");
if (IS_PRODUCTION && allowedOrigins.length === 0) {
  throw new Error("Missing ALLOWED_ORIGINS in production. Refusing to start insecure maps proxy.");
}

const corsOriginSet = new Set(
  allowedOrigins.length > 0
    ? allowedOrigins
    : ["http://localhost:5173", "https://clutchchemist.github.io"]
);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (corsOriginSet.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Origin not allowed by CORS"));
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-Proxy-Token"],
    maxAge: 600,
  })
);

app.use(express.json({ limit: "64kb" }));

const proxyToken = String(process.env.MAPS_PROXY_TOKEN ?? "").trim();
if (proxyToken) {
  app.use((req, res, next) => {
    const headerToken = String(req.header("X-Proxy-Token") ?? "").trim();
    if (!headerToken || headerToken !== proxyToken) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    next();
  });
}

const rateLimitWindowMs = Math.max(5_000, Number(process.env.MAPS_PROXY_RATE_LIMIT_WINDOW_MS ?? 60_000));
const rateLimitMax = Math.max(5, Number(process.env.MAPS_PROXY_RATE_LIMIT_MAX ?? 120));
const rateStore = new Map<string, { count: number; resetAt: number }>();

app.use((req, res, next) => {
  const now = Date.now();
  const key = `${req.ip ?? "unknown"}:${req.path}`;
  const cur = rateStore.get(key);

  if (!cur || now >= cur.resetAt) {
    rateStore.set(key, { count: 1, resetAt: now + rateLimitWindowMs });
    next();
    return;
  }

  cur.count += 1;
  if (cur.count > rateLimitMax) {
    res.status(429).json({ error: "Too many requests" });
    return;
  }

  next();
});

const GOOGLE_KEY = process.env.GOOGLE_MAPS_KEY!;
if (!GOOGLE_KEY) throw new Error("Missing GOOGLE_MAPS_KEY in .env");

async function gFetch(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res.json();
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

/** Places Autocomplete (New) -> predictions */
app.post("/api/places/autocomplete", async (req, res) => {
  try {
    const { input, sessionToken } = req.body as { input: string; sessionToken: string };
    if (!input?.trim()) {
      res.status(400).json({ error: "Missing input" });
      return;
    }

    const url = `https://places.googleapis.com/v1/places:autocomplete`;
    const body = {
      input,
      regionCode: "DE", // optional: bias to Germany
    };

    const data = await gFetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-FieldMask": "suggestions.placePrediction.placeId,suggestions.placePrediction.text",
        "X-Goog-Api-Key": GOOGLE_KEY,
        "X-Goog-Session-Token": sessionToken || "",
      },
      body: JSON.stringify(body),
    });

    res.json(data);
  } catch (err: unknown) {
    const msg = errorMessage(err);
    console.error("Autocomplete error:", msg);
    res.status(500).json({ error: msg });
  }
});

/** Place Details (New) -> formattedAddress for placeId */
app.post("/api/places/details", async (req, res) => {
  try {
    const { placeId, sessionToken } = req.body as { placeId: string; sessionToken: string };
    if (!placeId?.trim()) {
      res.status(400).json({ error: "Missing placeId" });
      return;
    }

    const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`;
    const data = await gFetch(url, {
      method: "GET",
      headers: {
        "X-Goog-FieldMask": "id,formattedAddress,displayName",
        "X-Goog-Api-Key": GOOGLE_KEY,
        "X-Goog-Session-Token": sessionToken || "",
      },
    });
    res.json(data);
  } catch (err: unknown) {
    const msg = errorMessage(err);
    console.error("Place details error:", msg);
    res.status(500).json({ error: msg });
  }
});

/** Routes computeRoutes -> travel minutes (driving) */
app.post("/api/routes/compute", async (req, res) => {
  try {
    const { originAddress, destinationAddress, departureTimeIso } = req.body as {
      originAddress: string;
      destinationAddress: string;
      departureTimeIso?: string;
    };

    if (!originAddress?.trim() || !destinationAddress?.trim()) {
      res.status(400).json({ error: "Missing originAddress or destinationAddress" });
      return;
    }

    const url = "https://routes.googleapis.com/directions/v2:computeRoutes";
    const body: {
      origin: { address: string };
      destination: { address: string };
      travelMode: "DRIVE";
      routingPreference: "TRAFFIC_AWARE";
      departureTime?: string;
    } = {
      origin: { address: originAddress },
      destination: { address: destinationAddress },
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE",
    };

    if (departureTimeIso) body.departureTime = departureTimeIso;

    const data = await gFetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-FieldMask": "routes.duration,routes.travelAdvisory",
        "X-Goog-Api-Key": GOOGLE_KEY,
      },
      body: JSON.stringify(body),
    });

    // duration is e.g. "1234s"
    const dur = data?.routes?.[0]?.duration as string | undefined;
    const seconds = dur ? Number(String(dur).replace("s", "")) : null;
    const minutes = seconds != null ? Math.max(0, Math.round(seconds / 60)) : null;

    res.json({ minutes, raw: data });
  } catch (err: unknown) {
    const msg = errorMessage(err);
    console.error("Routes compute error:", msg);
    res.status(500).json({ error: msg });
  }
});

const PORT = process.env.PORT || 5055;
app.listen(PORT, () => {
  console.log(`🗺️  Maps proxy running on :${PORT}`);
  console.log(`🌐 CORS origins configured: ${Array.from(corsOriginSet).join(", ")}`);
  if (proxyToken) console.log("🔐 Proxy token auth enabled");
  console.log(`🚦 Rate limit: ${rateLimitMax} req / ${Math.round(rateLimitWindowMs / 1000)}s per IP+route`);
});
