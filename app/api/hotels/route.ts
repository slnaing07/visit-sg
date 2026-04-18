import { NextRequest, NextResponse } from "next/server";
import { getHotelList } from "@/lib/xotelo";
import type { UseCase } from "@/lib/types";

export async function GET(req: NextRequest) {
  const useCase = parseInt(req.nextUrl.searchParams.get("useCase") ?? "4") as UseCase;
  const hyattOnly = useCase === 1 || useCase === 3;

  try {
    const hotels = await getHotelList(hyattOnly);
    return NextResponse.json({ hotels });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ hotels: [], error: message }, { status: 500 });
  }
}
