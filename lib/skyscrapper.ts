import type { FlightResult } from "./types";

const BASE = "https://sky-scrapper.p.rapidapi.com/api/v1/flights";
const HOST = "sky-scrapper.p.rapidapi.com";

function headers() {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) throw new Error("RAPIDAPI_KEY is not set");
  return { "X-RapidAPI-Key": key, "X-RapidAPI-Host": HOST };
}

interface CalendarDay { day: string; price: number }
interface CalendarResponse {
  status: boolean;
  data?: { flights?: { days?: CalendarDay[] } };
}

// Module-level cache — survives warm serverless invocations (~1 hr TTL)
let calendarCache: {
  outbound: Map<string, number>;
  inbound: Map<string, number>;
  fetchedAt: number;
} | null = null;

const CACHE_TTL = 3_600_000;

async function fetchCalendar(
  originSkyId: string,
  destinationSkyId: string
): Promise<Map<string, number>> {
  const today = new Date().toISOString().slice(0, 10);
  const end = new Date(Date.now() + 210 * 86_400_000).toISOString().slice(0, 10);

  const url = new URL(`${BASE}/getPriceCalendar`);
  url.searchParams.set("originSkyId", originSkyId);
  url.searchParams.set("destinationSkyId", destinationSkyId);
  url.searchParams.set("fromDate", today);
  url.searchParams.set("toDate", end);
  url.searchParams.set("currency", "USD");

  try {
    const res = await fetch(url.toString(), {
      headers: headers(),
      next: { revalidate: 0 },
    });
    if (!res.ok) return new Map();
    const json = (await res.json()) as CalendarResponse;
    const days = json.data?.flights?.days ?? [];
    return new Map(days.map((d) => [d.day, d.price]));
  } catch {
    return new Map();
  }
}

async function getCalendar() {
  if (calendarCache && Date.now() - calendarCache.fetchedAt < CACHE_TTL) {
    return calendarCache;
  }
  const [outbound, inbound] = await Promise.all([
    fetchCalendar("SEA", "SIN"),
    fetchCalendar("SIN", "SEA"),
  ]);
  calendarCache = { outbound, inbound, fetchedAt: Date.now() };
  return calendarCache;
}

// deltaOnly is retained in the signature for API compatibility, but the price
// calendar endpoint doesn't support airline-level filtering. For Delta use
// cases the price returned is the market minimum for that day; the UI shows a
// disclaimer so the user can verify on Delta.com.
export async function searchFlight(
  departDate: string,
  returnDate: string,
  _deltaOnly: boolean
): Promise<FlightResult | null> {
  const { outbound, inbound } = await getCalendar();

  const outPrice = outbound.get(departDate);
  const inPrice = inbound.get(returnDate);

  if (!outPrice || !inPrice) return null;

  return { price: outPrice + inPrice, deltaFiltered: false };
}
