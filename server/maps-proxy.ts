import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

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

/** Places Autocomplete (New) -> predictions */
app.post("/api/places/autocomplete", async (req, res) => {
  try {
    const { input, sessionToken } = req.body as { input: string; sessionToken: string };
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
app.listen(PORT, () => console.log(`🗺️  Maps proxy running on :${PORT}`));
