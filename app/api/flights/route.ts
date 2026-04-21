import { NextRequest, NextResponse } from "next/server";
import { searchFlightPriceline } from "@/lib/priceline";
import { getFlightCalendar } from "@/lib/skyscanner-calendar";
import { getThurMondayPairs } from "@/lib/dates";
import type { UseCase, FlightResult } from "@/lib/types";

export const maxDuration = 60;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

const BATCH_SIZE = 10;

export async function GET(req: NextRequest) {
  const useCase = parseInt(req.nextUrl.searchParams.get("useCase") ?? "4") as UseCase;
  const deltaOnly = useCase === 1 || useCase === 2;

  const weekends = getThurMondayPairs(new Date(), 6);
  const results: Record<string, FlightResult | null> = {};

  if (!deltaOnly) {
    // Any-airline tabs: use Skyscanner price calendar (2 API calls for all weekends)
    const calendar = await getFlightCalendar();
    for (const w of weekends) {
      const outPrice = calendar.outbound.get(w.departureDate);
      const inPrice = calendar.inbound.get(w.returnDate);
      results[w.departureDate] = outPrice && inPrice
        ? { price: outPrice + inPrice, deltaFiltered: false }
        : null;
    }
  } else {
    // Delta tabs: use Priceline in small batches (supports airline-level filtering)
    for (let i = 0; i < weekends.length; i += BATCH_SIZE) {
      const batch = weekends.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (w) => {
          results[w.departureDate] = await searchFlightPriceline(
            w.departureDate,
            w.returnDate,
            true
          );
        })
      );
      if (i + BATCH_SIZE < weekends.length) await sleep(200);
    }
  }

  return NextResponse.json({ flights: results });
}
