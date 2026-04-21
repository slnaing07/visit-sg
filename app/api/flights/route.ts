import { NextRequest, NextResponse } from "next/server";
import { searchDeltaFlight } from "@/lib/google-flights";
import { getFlightCalendar } from "@/lib/skyscanner-calendar";
import { getThurMondayPairs } from "@/lib/dates";
import type { UseCase, FlightResult } from "@/lib/types";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const useCase = parseInt(req.nextUrl.searchParams.get("useCase") ?? "4") as UseCase;
  const deltaOnly = useCase === 1 || useCase === 2;

  const weekends = getThurMondayPairs(new Date(), 4);
  const results: Record<string, FlightResult | null> = {};

  if (!deltaOnly) {
    const calendar = await getFlightCalendar();
    for (const w of weekends) {
      const outPrice = calendar.outbound.get(w.departureDate);
      const inPrice = calendar.inbound.get(w.returnDate);
      results[w.departureDate] = outPrice && inPrice
        ? { price: outPrice + inPrice, deltaFiltered: false }
        : null;
    }
  } else {
    // Delta tabs: Google Flights with preferred_airlines=DL, all weekends in parallel
    await Promise.all(
      weekends.map(async (w) => {
        results[w.departureDate] = await searchDeltaFlight(w.departureDate, w.returnDate);
      })
    );
  }

  return NextResponse.json({ flights: results });
}
