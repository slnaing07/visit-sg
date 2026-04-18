import type { FlightOffer, FlightItinerary, HotelOffer } from "./types";

const BASE_URL = process.env.AMADEUS_BASE_URL ?? "https://test.api.amadeus.com";
const MAX_LAYOVER_MINUTES = 8 * 60;
const DELTA_CODE = "DL";
const HYATT_CHAIN = "HY";

// Module-level token cache (survives warm Lambda invocations)
let cachedToken: string | null = null;
let tokenExpiresAt = 0;

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;

  const res = await fetch(`${BASE_URL}/v1/security/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.AMADEUS_API_KEY!,
      client_secret: process.env.AMADEUS_API_SECRET!,
    }),
  });

  if (!res.ok) throw new Error(`Amadeus auth failed: ${res.status}`);
  const data = await res.json();
  cachedToken = data.access_token as string;
  tokenExpiresAt = Date.now() + (data.expires_in - 30) * 1000;
  return cachedToken;
}

async function amadeusGet(path: string, params: Record<string, string>): Promise<unknown> {
  const token = await getToken();
  const url = new URL(`${BASE_URL}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Amadeus ${path} failed ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

// ── Layover helpers ────────────────────────────────────────────────────────────

function isoToMs(isoDatetime: string): number {
  return new Date(isoDatetime).getTime();
}

function maxLayoverMinutes(itinerary: FlightItinerary): number {
  let max = 0;
  const segs = itinerary.segments;
  for (let i = 0; i < segs.length - 1; i++) {
    const layover = (isoToMs(segs[i + 1].departure.at) - isoToMs(segs[i].arrival.at)) / 60000;
    if (layover > max) max = layover;
  }
  return max;
}

function parseDurationMinutes(isoDuration: string): number {
  const m = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!m) return 0;
  return (parseInt(m[1] ?? "0") * 60) + parseInt(m[2] ?? "0");
}

// ── Flight search ──────────────────────────────────────────────────────────────

interface RawFlightData {
  data?: RawFlightOffer[];
}

interface RawFlightOffer {
  itineraries: FlightItinerary[];
  price: { grandTotal: string; currency: string };
  validatingAirlineCodes?: string[];
}

export async function searchFlights(
  origin: string,
  destination: string,
  date: string,
  deltaOnly: boolean
): Promise<FlightOffer | null> {
  const params: Record<string, string> = {
    originLocationCode: origin,
    destinationLocationCode: destination,
    departureDate: date,
    adults: "1",
    currencyCode: "USD",
    max: "20",
  };
  if (deltaOnly) params.includedAirlineCodes = DELTA_CODE;

  let raw: RawFlightData;
  try {
    raw = (await amadeusGet("/v2/shopping/flight-offers", params)) as RawFlightData;
  } catch {
    return null;
  }

  if (!raw.data?.length) return null;

  // Filter: max layover, then pick cheapest
  const valid = raw.data.filter((offer) => {
    const itin = offer.itineraries[0];
    return maxLayoverMinutes(itin) <= MAX_LAYOVER_MINUTES;
  });

  if (!valid.length) return null;

  valid.sort((a, b) => parseFloat(a.price.grandTotal) - parseFloat(b.price.grandTotal));
  const best = valid[0];
  const itin = best.itineraries[0];

  return {
    price: parseFloat(best.price.grandTotal),
    currency: best.price.currency,
    airline: best.validatingAirlineCodes?.[0] ?? itin.segments[0].carrierCode,
    stops: itin.segments.length - 1,
    duration: itin.duration,
    maxLayoverMinutes: maxLayoverMinutes(itin),
    itinerary: itin,
  };
}

// ── Hotel search ───────────────────────────────────────────────────────────────

interface RawHotelListData {
  data?: RawHotelItem[];
}

interface RawHotelItem {
  hotelId: string;
  name: string;
  chainCode: string;
  rating?: number;
}

export async function getHotelIds(hyattOnly: boolean): Promise<string[]> {
  const params: Record<string, string> = {
    cityCode: "SIN",
    hotelSource: "ALL",
    ratings: "3,4,5",
  };
  if (hyattOnly) params.chains = HYATT_CHAIN;

  let raw: RawHotelListData;
  try {
    raw = (await amadeusGet("/v1/reference-data/locations/hotels/by-city", params)) as RawHotelListData;
  } catch {
    return [];
  }

  return (raw.data ?? []).slice(0, 250).map((h) => h.hotelId);
}

interface RawHotelOffersData {
  data?: RawHotelOfferItem[];
}

interface RawHotelOfferItem {
  hotel: { hotelId: string; name: string; chainCode?: string; rating?: number };
  offers?: RawHotelOfferDetail[];
}

interface RawHotelOfferDetail {
  price: { total: string; currency: string };
}

export async function searchHotels(
  hotelIds: string[],
  checkIn: string,
  checkOut: string
): Promise<HotelOffer | null> {
  if (!hotelIds.length) return null;

  // API allows max 250 hotel IDs per call
  const ids = hotelIds.slice(0, 250).join(",");

  let raw: RawHotelOffersData;
  try {
    raw = (await amadeusGet("/v3/shopping/hotel-offers", {
      hotelIds: ids,
      checkInDate: checkIn,
      checkOutDate: checkOut,
      adults: "1",
      roomQuantity: "1",
      currencyCode: "USD",
      bestRateOnly: "true",
    })) as RawHotelOffersData;
  } catch {
    return null;
  }

  if (!raw.data?.length) return null;

  // Collect all offers across hotels, pick cheapest
  const allOffers: HotelOffer[] = [];
  for (const item of raw.data) {
    if (!item.offers?.length) continue;
    const offer = item.offers[0];
    const total = parseFloat(offer.price.total);
    const checkInDate = new Date(checkIn + "T12:00:00");
    const checkOutDate = new Date(checkOut + "T12:00:00");
    const nights = Math.round((checkOutDate.getTime() - checkInDate.getTime()) / 86400000);

    allOffers.push({
      hotelId: item.hotel.hotelId,
      name: item.hotel.name,
      chainCode: item.hotel.chainCode ?? "",
      pricePerNight: nights > 0 ? total / nights : total,
      totalPrice: total,
      currency: offer.price.currency,
      rating: item.hotel.rating ?? 0,
    });
  }

  if (!allOffers.length) return null;
  allOffers.sort((a, b) => a.totalPrice - b.totalPrice);
  return allOffers[0];
}
