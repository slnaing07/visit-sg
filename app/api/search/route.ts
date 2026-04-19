import { NextRequest, NextResponse } from "next/server";
import { searchFlight } from "@/lib/skyscrapper";
import { getCheapestHotel } from "@/lib/xotelo";
import type { UseCase, WeekendResult } from "@/lib/types";
import type { XoteloHotel } from "@/lib/xotelo";

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const useCase    = parseInt(p.get("useCase") ?? "4") as UseCase;
  const departureDate = p.get("departureDate");
  const returnDate    = p.get("returnDate");
  const hotelsParam   = p.get("hotels");

  if (!departureDate || !returnDate) {
    return NextResponse.json({ error: "Missing dates" }, { status: 400 });
  }

  const deltaOnly = useCase === 1 || useCase === 2;
  const nights    = 3; // Fri check-in → Mon check-out

  const hotels: XoteloHotel[] = hotelsParam ? JSON.parse(hotelsParam) : [];

  // Hotel price comes from the pre-fetched list (no extra API call per weekend)
  const hotel = getCheapestHotel(hotels, nights);

  // Only flight needs a live API call per weekend
  const flightSettled = await Promise.allSettled([
    searchFlight(departureDate, returnDate, deltaOnly),
  ]);

  const flight = flightSettled[0].status === "fulfilled" ? flightSettled[0].value : null;
  const flightError = flightSettled[0].status === "rejected"
    ? String(flightSettled[0].reason) : undefined;

  const totalCost = flight && hotel ? flight.price + hotel.price : null;

  const result: WeekendResult = {
    weekend: { departureDate, returnDate },
    flight,
    hotel,
    totalCost,
    error: flightError,
  };

  return NextResponse.json({ result });
}
