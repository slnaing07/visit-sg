import { NextRequest, NextResponse } from "next/server";
import { searchFlights, searchHotels } from "@/lib/amadeus";
import type { UseCase, WeekendResult } from "@/lib/types";

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const useCase = (parseInt(p.get("useCase") ?? "4") as UseCase);
  const departureDate = p.get("departureDate");
  const returnDate = p.get("returnDate");
  const hotelIdsParam = p.get("hotelIds") ?? "";

  if (!departureDate || !returnDate) {
    return NextResponse.json({ error: "Missing dates" }, { status: 400 });
  }

  const deltaOnly = useCase === 1 || useCase === 2;
  const hotelIds = hotelIdsParam ? hotelIdsParam.split(",") : [];

  try {
    const [outbound, inbound, hotel] = await Promise.all([
      searchFlights("SEA", "SIN", departureDate, deltaOnly),
      searchFlights("SIN", "SEA", returnDate, deltaOnly),
      hotelIds.length > 0
        ? searchHotels(hotelIds, departureDate, returnDate)
        : Promise.resolve(null),
    ]);

    const flightTotal =
      outbound && inbound ? outbound.price + inbound.price : null;
    const totalCost =
      flightTotal !== null && hotel
        ? flightTotal + hotel.totalPrice
        : null;

    const result: WeekendResult = {
      weekend: { departureDate, returnDate },
      outbound,
      inbound,
      hotel,
      totalCost,
    };

    return NextResponse.json({ result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const result: WeekendResult = {
      weekend: { departureDate, returnDate },
      outbound: null,
      inbound: null,
      hotel: null,
      totalCost: null,
      error: message,
    };
    return NextResponse.json({ result });
  }
}
