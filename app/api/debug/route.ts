import { NextResponse } from "next/server";
import { getThurMondayPairs } from "@/lib/dates";

export const maxDuration = 30;

export async function GET() {
  const key = process.env.RAPIDAPI_KEY;
  const keyStatus = !key
    ? "MISSING"
    : `set (${key.slice(0, 4)}...${key.slice(-4)}, length ${key.length})`;

  const weekends = getThurMondayPairs(new Date(), 6);
  const { departureDate, returnDate } = weekends[0];

  // Test Skyscanner
  let skyscannerStatus = "not tested";
  let skyscannerRaw: unknown = null;
  if (key) {
    try {
      const url = new URL("https://sky-scrapper.p.rapidapi.com/api/v1/flights/getPriceCalendar");
      const today = new Date().toISOString().slice(0, 10);
      const end = new Date(Date.now() + 210 * 86_400_000).toISOString().slice(0, 10);
      url.searchParams.set("originSkyId", "SEA");
      url.searchParams.set("destinationSkyId", "SIN");
      url.searchParams.set("fromDate", today);
      url.searchParams.set("toDate", end);
      url.searchParams.set("currency", "USD");

      const res = await fetch(url.toString(), {
        headers: { "X-RapidAPI-Key": key, "X-RapidAPI-Host": "sky-scrapper.p.rapidapi.com" },
        signal: AbortSignal.timeout(10000),
      });
      skyscannerStatus = `HTTP ${res.status}`;
      const json = await res.json();
      // Return just the top-level shape to avoid huge payloads
      skyscannerRaw = {
        status: json.status,
        hasData: !!json.data,
        dataKeys: json.data ? Object.keys(json.data) : [],
        flightsKeys: json.data?.flights ? Object.keys(json.data.flights) : [],
        sampleDayCount: json.data?.flights?.days?.length ?? 0,
        firstDay: json.data?.flights?.days?.[0] ?? null,
      };
    } catch (e) {
      skyscannerStatus = `error: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  // Test Priceline
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
      pricelineRaw = {
        topLevelKeys: Object.keys(json),
        hasGetAirFlightRoundTrip: !!json.getAirFlightRoundTrip,
        hasResults: !!json.getAirFlightRoundTrip?.results,
        hasResult: !!json.getAirFlightRoundTrip?.results?.result,
        itineraryCount: itinData ? Object.keys(itinData).length : 0,
        firstItinKeys: itinData ? Object.keys(Object.values(itinData)[0] as object) : [],
      };
    } catch (e) {
      pricelineStatus = `error: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  return NextResponse.json({
    keyStatus,
    testDates: { departureDate, returnDate },
    skyscanner: { status: skyscannerStatus, response: skyscannerRaw },
    priceline: { status: pricelineStatus, response: pricelineRaw },
  });
}
