import type { HotelResult } from "./types";

const BASE = "https://data.xotelo.com/api";

// TripAdvisor g-code for Singapore
const SINGAPORE_LOCATION_KEY = "294265";

export interface XoteloHotel {
  key: string;
  name: string;
}

interface ListResponse {
  result?: { list?: Array<{ key: string; name: string }> };
}

interface SearchResponse {
  result?: { list?: Array<{ key: string; name: string }> };
}

interface RatesResponse {
  result?: { rates?: Array<{ rate: number }> };
}

// For Hyatt-only cases: search Xotelo directly for Hyatt hotels in Singapore
async function searchHyattHotels(): Promise<XoteloHotel[]> {
  try {
    const res = await fetch(
      `${BASE}/search?query=Hyatt+Singapore`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return [];
    const json = await res.json() as SearchResponse;
    return (json.result?.list ?? []).map((h) => ({ key: h.key, name: h.name }));
  } catch {
    return [];
  }
}

// For all-hotels cases: get the full Singapore hotel list
async function listAllHotels(): Promise<XoteloHotel[]> {
  try {
    const res = await fetch(
      `${BASE}/list?location_key=${SINGAPORE_LOCATION_KEY}`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return [];
    const json = await res.json() as ListResponse;
    return (json.result?.list ?? []).slice(0, 30).map((h) => ({ key: h.key, name: h.name }));
  } catch {
    return [];
  }
}

export async function getHotelList(hyattOnly: boolean): Promise<XoteloHotel[]> {
  return hyattOnly ? searchHyattHotels() : listAllHotels();
}

export async function getCheapestHotel(
  hotels: XoteloHotel[],
  checkIn: string,
  checkOut: string,
  nights: number
): Promise<HotelResult | null> {
  if (!hotels.length) return null;

  const results = await Promise.allSettled(
    hotels.map(async (hotel) => {
      try {
        const res = await fetch(
          `${BASE}/rates?hotel_key=${hotel.key}&chk_in=${checkIn}&chk_out=${checkOut}`,
          { next: { revalidate: 0 } }
        );
        if (!res.ok) return null;

        const json = await res.json() as RatesResponse;
        const rates = json.result?.rates ?? [];
        if (!rates.length) return null;

        rates.sort((a, b) => a.rate - b.rate);
        return { name: hotel.name, price: rates[0].rate, nights } as HotelResult;
      } catch {
        return null;
      }
    })
  );

  const valid = results
    .filter(
      (r): r is PromiseFulfilledResult<HotelResult> =>
        r.status === "fulfilled" && r.value !== null
    )
    .map((r) => r.value);

  if (!valid.length) return null;
  valid.sort((a, b) => a.price - b.price);
  return valid[0];
}
