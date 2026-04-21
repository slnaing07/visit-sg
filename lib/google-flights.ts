import type { FlightResult } from "./types";

const BASE = "https://google-flights8.p.rapidapi.com/api/v1";
const HOST = "google-flights8.p.rapidapi.com";

function headers() {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) throw new Error("RAPIDAPI_KEY is not set");
  return { "X-RapidAPI-Key": key, "X-RapidAPI-Host": HOST };
}

interface GoogleFlightListing {
  name: string;
  stops: string;
  price: string;
}

interface GoogleFlightsResponse {
  success: boolean;
  flights: GoogleFlightListing[];
}

function parsePrice(s: string): number {
  return parseFloat(s.replace(/,/g, ""));
}

function parseStops(s: string): number {
  if (s.toLowerCase().includes("nonstop")) return 0;
  return parseInt(s) || 1;
}

export async function searchDeltaFlight(
  departDate: string,
  returnDate: string
): Promise<FlightResult | null> {
  const url = new URL(`${BASE}/roundtrip`);
  url.searchParams.set("origin", "SEA");
  url.searchParams.set("destination", "SIN");
  url.searchParams.set("departureDate", departDate);
  url.searchParams.set("returnDate", returnDate);
  url.searchParams.set("adults", "1");
  url.searchParams.set("cabinClass", "ECONOMY");
  url.searchParams.set("currency", "USD");
  url.searchParams.set("preferred_airlines", "DL");

  try {
    const res = await fetch(url.toString(), {
      headers: headers(),
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;

    const json = (await res.json()) as GoogleFlightsResponse;
    if (!json.success || !json.flights?.length) return null;

    const deltaFlights = json.flights.filter((f) =>
      f.name.toLowerCase().includes("delta")
    );
    if (!deltaFlights.length) return null;

    const best = deltaFlights.reduce((a, b) =>
      parsePrice(a.price) <= parsePrice(b.price) ? a : b
    );

    return {
      price: parsePrice(best.price),
      airline: "DL/KE",
      stops: parseStops(best.stops),
      deltaFiltered: true,
    };
  } catch {
    return null;
  }
}
