import type { UseCase } from "./types";

function addDays(isoDate: string, n: number): string {
  const d = new Date(isoDate + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

export function flightUrl(useCase: UseCase, departureDate: string, returnDate: string): string {
  const base = `https://www.kayak.com/flights/SEA-SIN/${departureDate}/${returnDate}?cabin=economy&travelers=1a`;
  return (useCase === 1 || useCase === 2) ? base + "&airline=DL" : base;
}

export function hotelUrl(useCase: UseCase, departureDate: string, returnDate: string): string {
  const checkIn = addDays(departureDate, 1); // Friday
  const checkOut = returnDate;               // Monday
  const base = `https://www.kayak.com/hotels/Singapore-c20828/${checkIn}/${checkOut}/1adults;map?sort=rank_a`;
  return (useCase === 1 || useCase === 3)
    ? base + "&fs=hotelchain=brg-370"
    : base;
}
