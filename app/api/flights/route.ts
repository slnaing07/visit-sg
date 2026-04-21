import { NextRequest, NextResponse } from "next/server";
import { searchDeltaFlight } from "@/lib/priceline-pro";
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
    // Delta tabs: priceline-api-pro, batch 5 parallel (~17s/batch → ~51s for 13 weekends)
    const BATCH_SIZE = 5;
    for (let i = 0; i < weekends.length; i += BATCH_SIZE) {
      const batch = weekends.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (w) => {
          results[w.departureDate] = await searchDeltaFlight(w.departureDate, w.returnDate);
        })
      );
    }
  }

  return NextResponse.json({ flights: results });
}
