import { NextRequest, NextResponse } from "next/server";
import { searchFlight } from "@/lib/travelpayouts";
import { getCheapestHotel } from "@/lib/xotelo";
import type { UseCase, WeekendResult } from "@/lib/types";
import type { XoteloHotel } from "@/lib/xotelo";

// Hotel check-in is the day after departure (SEA→SIN is an overnight flight)
function addDays(isoDate: string, n: number): string {
  const d = new Date(isoDate + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const useCase = parseInt(p.get("useCase") ?? "4") as UseCase;
  const departureDate = p.get("departureDate");
  const returnDate = p.get("returnDate");
  const hotelsParam = p.get("hotels");

  if (!departureDate || !returnDate) {
    return NextResponse.json({ error: "Missing dates" }, { status: 400 });
  }

  const deltaOnly = useCase === 1 || useCase === 2;
  const checkIn = addDays(departureDate, 1); // Friday
  const checkOut = returnDate;               // Monday
  const nights = 3;

  const hotels: XoteloHotel[] = hotelsParam ? JSON.parse(hotelsParam) : [];

  try {
    const [flight, hotel] = await Promise.all([
      searchFlight("SEA", "SIN", departureDate, returnDate, deltaOnly),
      getCheapestHotel(hotels, checkIn, checkOut, nights),
    ]);

    const totalCost =
      flight && hotel ? flight.price + hotel.price : null;

    const result: WeekendResult = {
      weekend: { departureDate, returnDate },
      flight,
      hotel,
      totalCost,
    };

    return NextResponse.json({ result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const result: WeekendResult = {
      weekend: { departureDate, returnDate },
      flight: null,
      hotel: null,
      totalCost: null,
      error: message,
    };
    return NextResponse.json({ result });
  }
}
