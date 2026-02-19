import { uid } from "./id";

const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL ?? "")
  .trim()
  .replace(/\/+$/, "");

const MAPS_PROXY_TOKEN = String(import.meta.env.VITE_MAPS_PROXY_TOKEN ?? "").trim();

function apiUrl(path: string): string {
  return API_BASE_URL ? `${API_BASE_URL}${path}` : path;
}

function apiHeaders(): HeadersInit {
  if (!MAPS_PROXY_TOKEN) {
    return { "Content-Type": "application/json" };
  }

  return {
    "Content-Type": "application/json",
    "X-Proxy-Token": MAPS_PROXY_TOKEN,
  };
}

export function generateSessionToken(): string {
  return uid();
}

export async function fetchPlacePredictions(input: string, sessionToken: string) {
  const r = await fetch(apiUrl("/api/places/autocomplete"), {
    method: "POST",
    headers: apiHeaders(),
    body: JSON.stringify({ input, sessionToken }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function fetchPlaceDetails(placeId: string, sessionToken: string) {
  const r = await fetch(apiUrl("/api/places/details"), {
    method: "POST",
    headers: apiHeaders(),
    body: JSON.stringify({ placeId, sessionToken }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function fetchTravelMinutes(
  originAddress: string,
  destinationAddress: string,
  departureTimeIso?: string
): Promise<number | null> {
  const r = await fetch(apiUrl("/api/routes/compute"), {
    method: "POST",
    headers: apiHeaders(),
    body: JSON.stringify({ originAddress, destinationAddress, departureTimeIso }),
  });
  if (!r.ok) throw new Error(await r.text());
  const j = await r.json();
  return j.minutes as number | null;
}
