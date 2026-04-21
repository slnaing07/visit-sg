import type { FlightResult } from "./types";

const BASE = "https://priceline-api-pro.p.rapidapi.com";
const HOST = "priceline-api-pro.p.rapidapi.com";

function headers() {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) throw new Error("RAPIDAPI_KEY is not set");
  return { "X-RapidAPI-Key": key, "X-RapidAPI-Host": HOST };
}

interface Airline { code: string }
interface PriceEntry { type: string; amount: number }
interface Listing {
  airlines: Airline[];
  totalPriceWithDecimal: { price: number };
  price: PriceEntry[];
  slices: { stops: number }[];
}
interface ApiResponse {
  success: boolean;
  data: { flightListings: Listing[] | null };
}

function toMDY(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${m}-${d}-${y}`;
}

export async function searchDeltaFlight(
  departDate: string,
  returnDate: string
): Promise<FlightResult | null> {
  const url = new URL(`${BASE}/round-trip-search-flights`);
  url.searchParams.set("origin_airport_code", "SEA");
  url.searchParams.set("destination_airport_code", "SIN");
  url.searchParams.set("departure_date", toMDY(departDate));
  url.searchParams.set("return_date", toMDY(returnDate));
  url.searchParams.set("num_adults", "1");
  url.searchParams.set("cabin_class", "ECO");
  url.searchParams.set("slice_key", "");

  try {
    const res = await fetch(url.toString(), {
      headers: headers(),
      cache: "no-store",
      signal: AbortSignal.timeout(25000),
    });
    if (!res.ok) return null;

    const json = (await res.json()) as ApiResponse;
    const listings = json.data?.flightListings;
    if (!listings?.length) return null;

    const deltaListings = listings.filter((l) =>
      l.airlines?.some((a) => a.code === "DL")
    );
    if (!deltaListings.length) return null;

    const best = deltaListings.reduce((a, b) =>
      a.totalPriceWithDecimal.price <= b.totalPriceWithDecimal.price ? a : b
    );

    const stops = best.slices?.[0]?.stops ?? 1;

    return {
      price: best.totalPriceWithDecimal.price,
      airline: "DL/KE",
      stops,
      deltaFiltered: true,
    };
  } catch {
    return null;
  }
}
