import type { FlightResult } from "./types";

const BASE = "https://priceline-com-provider.p.rapidapi.com/v2/flight";
const HOST = "priceline-com-provider.p.rapidapi.com";

function headers() {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) throw new Error("RAPIDAPI_KEY is not set");
  return { "X-RapidAPI-Key": key, "X-RapidAPI-Host": HOST };
}

interface SegmentInfo {
  operating_airline_code: string;
  marketing_airline_code: string;
  stop_count: number;
}

interface Segment { info: SegmentInfo }
interface Slice { flight_data: Record<string, Segment> }
interface Itinerary {
  price_details: { display_total_fare: number };
  slice_data: Record<string, Slice>;
}
interface PricelineResponse {
  getAirFlightRoundTrip: {
    results: {
      result: {
        itinerary_data: Record<string, Itinerary>;
      };
    };
  };
}

function hasDelta(it: Itinerary): boolean {
  return Object.values(it.slice_data).some((sl) =>
    Object.values(sl.flight_data).some(
      (f) =>
        f.info.operating_airline_code === "DL" ||
        f.info.marketing_airline_code === "DL"
    )
  );
}

function totalStops(it: Itinerary): number {
  return Object.values(it.slice_data).reduce(
    (sum, sl) => sum + Object.values(sl.flight_data).length - 1,
    0
  );
}

// Per date-pair cache to avoid redundant calls within a server warm period
const cache = new Map<string, { result: FlightResult | null; fetchedAt: number }>();
const CACHE_TTL = 3_600_000;

export async function searchFlightPriceline(
  departDate: string,
  returnDate: string,
  deltaOnly: boolean
): Promise<FlightResult | null> {
  const cacheKey = `${departDate}|${returnDate}|${deltaOnly}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) return cached.result;

  const url = new URL(`${BASE}/roundTrip`);
  url.searchParams.set("sid", "iSiX639");
  url.searchParams.set("adults", "1");
  url.searchParams.set("cabinClass", "ECO");
  url.searchParams.set("departure_date", departDate);
  url.searchParams.set("return_date", returnDate);
  url.searchParams.set("origin_airport_code", "SEA");
  url.searchParams.set("destination_airport_code", "SIN");
  url.searchParams.set("currency", "USD");
  url.searchParams.set("number_of_itineraries", "30");

  let result: FlightResult | null = null;

  try {
    const res = await fetch(url.toString(), {
      headers: headers(),
      next: { revalidate: 0 },
    });
    if (!res.ok) throw new Error(`Priceline error: ${res.status}`);

    const json = (await res.json()) as PricelineResponse;
    const itinData = json.getAirFlightRoundTrip?.results?.result?.itinerary_data ?? {};
    const itins = Object.values(itinData);

    const candidates = deltaOnly ? itins.filter(hasDelta) : itins;
    if (!candidates.length) {
      cache.set(cacheKey, { result: null, fetchedAt: Date.now() });
      return null;
    }

    candidates.sort(
      (a, b) => a.price_details.display_total_fare - b.price_details.display_total_fare
    );
    const best = candidates[0];

    result = {
      price: best.price_details.display_total_fare,
      airline: deltaOnly ? "DL/KE" : undefined,
      stops: totalStops(best),
      deltaFiltered: deltaOnly,
    };
  } catch {
    // leave result as null
  }

  cache.set(cacheKey, { result, fetchedAt: Date.now() });
  return result;
}
