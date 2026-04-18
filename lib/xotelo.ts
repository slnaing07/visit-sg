import type { HotelResult } from "./types";

const BASE = "https://data.xotelo.com/api";

// TripAdvisor g-code for Singapore (from tripadvisor.com/Hotels-g294265-Singapore-Hotels.html)
const SINGAPORE_LOCATION_KEY = "294265";

const HYATT_KEYWORDS = ["hyatt", "andaz", "alila"];

export interface XoteloHotel {
  key: string;
  name: string;
}

function isHyatt(name: string): boolean {
  const lower = name.toLowerCase();
  return HYATT_KEYWORDS.some((k) => lower.includes(k));
}

export async function getHotelList(hyattOnly: boolean): Promise<XoteloHotel[]> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/list?location_key=${SINGAPORE_LOCATION_KEY}`, {
      next: { revalidate: 3600 }, // cache hotel list for 1 hour
    });
  } catch {
    return [];
  }
  if (!res.ok) return [];

  const json = await res.json() as {
    result?: { list?: Array<{ key: string; name: string }> };
  };

  const list = json.result?.list ?? [];
  if (hyattOnly) return list.filter((h) => isHyatt(h.name));
  return list.slice(0, 30); // top 30 for all-hotels case
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
      let res: Response;
      try {
        res = await fetch(
          `${BASE}/rates?hotel_key=${hotel.key}&chk_in=${checkIn}&chk_out=${checkOut}`,
          { next: { revalidate: 0 } }
        );
      } catch {
        return null;
      }
      if (!res.ok) return null;

      const json = await res.json() as {
        result?: { rates?: Array<{ rate: number }> };
      };

      const rates = json.result?.rates ?? [];
      if (!rates.length) return null;

      rates.sort((a, b) => a.rate - b.rate);
      return { name: hotel.name, price: rates[0].rate, nights };
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
