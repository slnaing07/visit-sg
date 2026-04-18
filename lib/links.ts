import type { UseCase } from "./types";

// Delta uses MM/DD/YYYY in its booking URLs
function toDeltaDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${m}/${d}/${y}`;
}

// Add N days to an ISO date string
function addDays(isoDate: string, n: number): string {
  const d = new Date(isoDate + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

/**
 * Round-trip flight link.
 * Use cases 1 & 2 → Delta.com (pre-filtered to Delta flights).
 * Use cases 3 & 4 → Google Flights (all airlines).
 */
export function flightUrl(useCase: UseCase, departureDate: string, returnDate: string): string {
  if (useCase === 1 || useCase === 2) {
    const dep = toDeltaDate(departureDate);
    const ret = toDeltaDate(returnDate);
    return (
      "https://www.delta.com/us/en/flight-search/book-a-flight?" +
      `paxCount=1&adult=1&tripType=roundTrip` +
      `&originCity=SEA&destinationCity=SIN` +
      `&departureDate=${dep}&returnDate=${ret}`
    );
  }
  // Google Flights round-trip hash format
  return (
    `https://www.google.com/travel/flights` +
    `#flt=SEA.SIN.${departureDate}*SIN.SEA.${returnDate};c:USD;e:1;sd:1;t:b`
  );
}

/**
 * Hotel link.
 * Guests arrive in Singapore the day after departing Seattle (time zone + ~17h flight).
 * Check-in = Friday, check-out = Monday = 3 nights.
 * Use cases 1 & 3 → Hyatt.com.
 * Use cases 2 & 4 → Google Hotels (all options).
 */
export function hotelUrl(useCase: UseCase, departureDate: string, returnDate: string): string {
  const checkIn = addDays(departureDate, 1);  // Friday
  const checkOut = returnDate;               // Monday

  if (useCase === 1 || useCase === 3) {
    return (
      `https://www.hyatt.com/shop/search?` +
      `location=Singapore&checkinDate=${checkIn}&checkoutDate=${checkOut}` +
      `&rooms=1&adults=1`
    );
  }
  return (
    `https://www.google.com/travel/hotels?` +
    `q=hotels+in+singapore&dates=${checkIn},${checkOut}`
  );
}
