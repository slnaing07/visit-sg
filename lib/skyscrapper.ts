import type { FlightResult } from "./types";

const BASE = "https://sky-scrapper.p.rapidapi.com/api/v1/flights";
const HOST = "sky-scrapper.p.rapidapi.com";

// Module-level cache for airport entity IDs (survives warm invocations)
const entityCache = new Map<string, { skyId: string; entityId: string }>();

interface AirportData {
  skyId: string;
  entityId: string;
  presentation?: { title: string };
  navigation?: { entityId: string };
}

interface ItineraryCarrier {
  alternateId: string;
  name: string;
}

interface ItineraryLeg {
  stopCount: number;
  carriers: { marketing: ItineraryCarrier[] };
}

interface Itinerary {
  price: { raw: number };
  legs: ItineraryLeg[];
}

function headers() {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) throw new Error("RAPIDAPI_KEY is not set");
  return { "X-RapidAPI-Key": key, "X-RapidAPI-Host": HOST };
}

async function getAirportEntity(query: string, iataCode: string) {
  if (entityCache.has(iataCode)) return entityCache.get(iataCode)!;

  const url = new URL(`${BASE}/searchAirport`);
  url.searchParams.set("query", query);
  url.searchParams.set("locale", "en-US");

  const res = await fetch(url.toString(), { headers: headers() });
  if (!res.ok) throw new Error(`Airport lookup failed: ${res.status}`);

  const json = await res.json() as { status: boolean; data: AirportData[] };
  const airports: AirportData[] = json.data ?? [];

  // Prefer an exact IATA match; fall back to first result
  const match =
    airports.find((a) => a.skyId === iataCode) ??
    airports.find((a) => a.navigation?.entityId) ??
    airports[0];

  if (!match) throw new Error(`No airport found for: ${query}`);

  const result = {
    skyId: match.skyId ?? iataCode,
    entityId: match.entityId ?? match.navigation?.entityId ?? "",
  };
  entityCache.set(iataCode, result);
  return result;
}

export async function searchFlight(
  departDate: string,
  returnDate: string,
  deltaOnly: boolean
): Promise<FlightResult | null> {
  const [sea, sin] = await Promise.all([
    getAirportEntity("Seattle", "SEA"),
    getAirportEntity("Singapore", "SIN"),
  ]);

  const url = new URL(`${BASE}/searchFlights`);
  const p = url.searchParams;
  p.set("originSkyId", sea.skyId);
  p.set("destinationSkyId", sin.skyId);
  p.set("originEntityId", sea.entityId);
  p.set("destinationEntityId", sin.entityId);
  p.set("date", departDate);
  p.set("returnDate", returnDate);
  p.set("adults", "1");
  p.set("cabinClass", "economy");
  p.set("currency", "USD");
  p.set("countryCode", "US");
  p.set("market", "en-US");
  p.set("locale", "en-US");

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      headers: headers(),
      next: { revalidate: 0 },
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;

  const json = await res.json() as { status: boolean; data?: { itineraries?: Itinerary[] } };
  const itineraries: Itinerary[] = json.data?.itineraries ?? [];
  if (!itineraries.length) return null;

  // For Delta-only: every leg must have DL as a marketing carrier
  const candidates = deltaOnly
    ? itineraries.filter((it) =>
        it.legs?.every((leg) =>
          leg.carriers?.marketing?.some((c) => c.alternateId === "DL")
        )
      )
    : itineraries;

  if (!candidates.length) return null;

  candidates.sort((a, b) => (a.price?.raw ?? Infinity) - (b.price?.raw ?? Infinity));
  const best = candidates[0];
  const firstLeg = best.legs?.[0];

  return {
    price: best.price.raw,
    airline: firstLeg?.carriers?.marketing?.[0]?.alternateId ?? "—",
    stops: firstLeg?.stopCount ?? 0,
  };
}
