import { NextResponse } from "next/server";
import { getThurMondayPairs } from "@/lib/dates";

export const maxDuration = 30;

export async function GET() {
  const key = process.env.RAPIDAPI_KEY;
  const keyStatus = !key
    ? "MISSING"
    : `set (${key.slice(0, 4)}...${key.slice(-4)}, length ${key.length})`;

  const weekends = getThurMondayPairs(new Date(), 4);
  const { departureDate, returnDate } = weekends[0];

  // Test Skyscanner — both directions
  async function testSkyscanner(origin: string, dest: string) {
    if (!key) return { status: "no key", response: null };
    try {
      const url = new URL("https://sky-scrapper.p.rapidapi.com/api/v1/flights/getPriceCalendar");
      const today = new Date().toISOString().slice(0, 10);
      const end = new Date(Date.now() + 210 * 86_400_000).toISOString().slice(0, 10);
      url.searchParams.set("originSkyId", origin);
      url.searchParams.set("destinationSkyId", dest);
      url.searchParams.set("fromDate", today);
      url.searchParams.set("toDate", end);
      url.searchParams.set("currency", "USD");
      const res = await fetch(url.toString(), {
        headers: { "X-RapidAPI-Key": key, "X-RapidAPI-Host": "sky-scrapper.p.rapidapi.com" },
        signal: AbortSignal.timeout(10000),
      });
      const json = await res.json();
      return {
        status: `HTTP ${res.status}`,
        response: {
          apiStatus: json.status,
          message: json.message ?? null,
          dayCount: json.data?.flights?.days?.length ?? 0,
          firstFewDays: json.data?.flights?.days?.slice(0, 3) ?? [],
        },
      };
    } catch (e) {
      return { status: `error: ${e instanceof Error ? e.message : String(e)}`, response: null };
    }
  }

  const [skyscannerOutbound, skyscannerInbound] = await Promise.all([
    testSkyscanner("SEA", "SIN"),
    testSkyscanner("SIN", "SEA"),
  ]);

  // Test Priceline — inspect slice_data structure to verify DL code visibility
  let pricelineStatus = "not tested";
  let pricelineRaw: unknown = null;
  if (key) {
    try {
      const url = new URL("https://priceline-com-provider.p.rapidapi.com/v2/flight/roundTrip");
      url.searchParams.set("sid", "iSiX639");
      url.searchParams.set("adults", "1");
      url.searchParams.set("cabinClass", "ECO");
      url.searchParams.set("departure_date", departureDate);
      url.searchParams.set("return_date", returnDate);
      url.searchParams.set("origin_airport_code", "SEA");
      url.searchParams.set("destination_airport_code", "SIN");
      url.searchParams.set("currency", "USD");
      url.searchParams.set("number_of_itineraries", "5");

      const res = await fetch(url.toString(), {
        headers: { "X-RapidAPI-Key": key, "X-RapidAPI-Host": "priceline-com-provider.p.rapidapi.com" },
        signal: AbortSignal.timeout(10000),
      });
      pricelineStatus = `HTTP ${res.status}`;
      const json = await res.json();
      const itinData = json.getAirFlightRoundTrip?.results?.result?.itinerary_data ?? null;
      const itins = itinData ? Object.values(itinData) as Record<string, unknown>[] : [];

      // Drill into slice_data → flight_data → info to find airline codes
      const itinSummaries = itins.map((it) => {
        const price = (it.price_details as Record<string, unknown>)?.display_total_fare ?? null;
        const slices = Object.values((it.slice_data as Record<string, unknown>) ?? {}) as Record<string, unknown>[];
        const segments = slices.flatMap((sl) =>
          Object.values((sl.flight_data as Record<string, unknown>) ?? {}) as Record<string, unknown>[]
        );
        const codes = segments.map((seg) => {
          const info = seg.info as Record<string, unknown> | undefined;
          return {
            operating: info?.operating_airline_code ?? "?",
            marketing: info?.marketing_airline_code ?? "?",
          };
        });
        return { price, codes };
      });

      pricelineRaw = {
        itineraryCount: itins.length,
        itineraries: itinSummaries,
        deltaFound: itinSummaries.some((it) =>
          it.codes.some((c) => c.operating === "DL" || c.marketing === "DL")
        ),
      };
    } catch (e) {
      pricelineStatus = `error: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  return NextResponse.json({
    keyStatus,
    testDates: { departureDate, returnDate },
    skyscanner: {
      outbound: skyscannerOutbound,
      inbound: skyscannerInbound,
    },
    priceline: { status: pricelineStatus, response: pricelineRaw },
  });
}
