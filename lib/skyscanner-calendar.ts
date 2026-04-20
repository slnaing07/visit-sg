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

let calendarCache: {
  outbound: Map<string, number>;
  inbound: Map<string, number>;
  fetchedAt: number;
} | null = null;

const CACHE_TTL = 3_600_000;

async function fetchCalendar(originSkyId: string, destinationSkyId: string): Promise<Map<string, number>> {
  const today = new Date().toISOString().slice(0, 10);
  const end = new Date(Date.now() + 210 * 86_400_000).toISOString().slice(0, 10);

  const url = new URL(`${BASE}/getPriceCalendar`);
  url.searchParams.set("originSkyId", originSkyId);
  url.searchParams.set("destinationSkyId", destinationSkyId);
  url.searchParams.set("fromDate", today);
  url.searchParams.set("toDate", end);
  url.searchParams.set("currency", "USD");

  try {
    const res = await fetch(url.toString(), { headers: headers(), next: { revalidate: 3600 } });
    if (!res.ok) return new Map();
    const json = (await res.json()) as CalendarResponse;
    const days = json.data?.flights?.days ?? [];
    return new Map(days.map((d) => [d.day, d.price]));
  } catch {
    return new Map();
  }
}

export async function getFlightCalendar() {
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
