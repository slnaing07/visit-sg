import type { HotelResult } from "./types";

const BASE = "https://data.xotelo.com/api";
const SINGAPORE_LOCATION_KEY = "294265";
const HYATT_KEYWORDS = ["hyatt", "andaz", "alila"];

export interface XoteloHotel {
  key: string;
  name: string;
  pricePerNight: number; // from price_ranges.minimum in /list response
}

interface HotelListItem {
  key: string;
  name: string;
  price_ranges?: { minimum: number; maximum: number };
}

interface ListResponse {
  result?: { list?: HotelListItem[] };
}

function isHyatt(name: string): boolean {
  const lower = name.toLowerCase();
  return HYATT_KEYWORDS.some((k) => lower.includes(k));
}

async function fetchPage(offset: number): Promise<HotelListItem[]> {
  try {
    const res = await fetch(
      `${BASE}/list?location_key=${SINGAPORE_LOCATION_KEY}&offset=${offset}&limit=30`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return [];
    const json = await res.json() as ListResponse;
    return json.result?.list ?? [];
  } catch {
    return [];
  }
}

// For all-hotels: return cheapest 10 from first page (already priced)
// For Hyatt-only: scan first 5 pages in parallel to find Hyatt-branded hotels
export async function getHotelList(hyattOnly: boolean): Promise<XoteloHotel[]> {
  if (!hyattOnly) {
    const hotels = await fetchPage(0);
    return hotels
      .filter((h) => (h.price_ranges?.minimum ?? 0) > 0)
      .sort((a, b) => a.price_ranges!.minimum - b.price_ranges!.minimum)
      .slice(0, 10)
      .map((h) => ({ key: h.key, name: h.name, pricePerNight: h.price_ranges!.minimum }));
  }

  // Fetch first 5 pages (150 hotels) in parallel to find Hyatt properties
  const pages = await Promise.allSettled(
    [0, 1, 2, 3, 4].map((p) => fetchPage(p * 30))
  );

  const found: XoteloHotel[] = [];
  for (const page of pages) {
    if (page.status !== "fulfilled") continue;
    for (const h of page.value) {
      if (isHyatt(h.name) && (h.price_ranges?.minimum ?? 0) > 0) {
        found.push({ key: h.key, name: h.name, pricePerNight: h.price_ranges!.minimum });
      }
    }
  }
  return found;
}

// Picks cheapest hotel from the already-fetched list — no extra API calls needed
export function getCheapestHotel(hotels: XoteloHotel[], nights: number): HotelResult | null {
  if (!hotels.length) return null;
  const best = [...hotels].sort((a, b) => a.pricePerNight - b.pricePerNight)[0];
  return { name: best.name, price: best.pricePerNight * nights, nights };
}
