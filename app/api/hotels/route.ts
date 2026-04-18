import { NextRequest, NextResponse } from "next/server";
import { getHotelIds } from "@/lib/amadeus";
import type { UseCase } from "@/lib/types";

export async function GET(req: NextRequest) {
  const useCaseParam = req.nextUrl.searchParams.get("useCase");
  const useCase = (parseInt(useCaseParam ?? "4") as UseCase);

  // Use cases 1 and 3 restrict to Hyatt hotels
  const hyattOnly = useCase === 1 || useCase === 3;

  try {
    const hotelIds = await getHotelIds(hyattOnly);
    return NextResponse.json({ hotelIds });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ hotelIds: [], error: message }, { status: 500 });
  }
}
