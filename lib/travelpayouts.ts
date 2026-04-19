import type { FlightResult } from "./types";

const BASE = "https://api.travelpayouts.com/v1/prices/cheap";

interface RawTicket {
  price: number;
  airline: string;
  transfers: number;
  departure_at: string;
  return_at: string;
}

type RawData = Record<string, Record<string, RawTicket>>;

export async function searchFlight(
  origin: string,
  destination: string,
  departDate: string,
  returnDate: string,
  deltaOnly: boolean
): Promise<FlightResult | null> {
  const token = process.env.TRAVELPAYOUTS_TOKEN;
  if (!token) throw new Error("TRAVELPAYOUTS_TOKEN is not set");

  const params = new URLSearchParams({
    origin,
    destination,
    depart_date: departDate,
    return_date: returnDate,
    currency: "usd",
    token,
  });

  let res: Response;
  try {
    res = await fetch(`${BASE}?${params}`, { next: { revalidate: 0 } });
  } catch {
    return null;
  }
  if (!res.ok) return null;

  const json = await res.json() as { success: boolean; data?: RawData };
  if (!json.success || !json.data?.[destination]) return null;

  const byAirline = json.data[destination];

  if (deltaOnly) {
    const dl = byAirline["DL"];
    if (!dl) return null;
    return { price: dl.price, airline: "DL", stops: dl.transfers, deltaFiltered: true };
  }

  const tickets = Object.values(byAirline);
  if (!tickets.length) return null;
  tickets.sort((a, b) => a.price - b.price);
  const best = tickets[0];
  return { price: best.price, airline: best.airline, stops: best.transfers, deltaFiltered: false };
}
