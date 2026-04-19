import { NextRequest, NextResponse } from "next/server";
import { searchFlightPriceline } from "@/lib/priceline";
import { getThurMondayPairs } from "@/lib/dates";
import type { UseCase, FlightResult } from "@/lib/types";

export const maxDuration = 60; // seconds — requires Vercel Pro or higher

// Sequential delay to avoid hitting Priceline rate limits
function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function GET(req: NextRequest) {
  const useCase = parseInt(req.nextUrl.searchParams.get("useCase") ?? "4") as UseCase;
  const deltaOnly = useCase === 1 || useCase === 2;

  const weekends = getThurMondayPairs(new Date(), 6);
  const results: Record<string, FlightResult | null> = {};

  for (const w of weekends) {
    results[w.departureDate] = await searchFlightPriceline(
      w.departureDate,
      w.returnDate,
      deltaOnly
    );
    await sleep(200); // 200ms between calls — stays under 5 req/sec
  }

  return NextResponse.json({ flights: results });
}
