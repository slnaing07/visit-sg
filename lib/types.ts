export type UseCase = 1 | 2 | 3 | 4;

export interface Weekend {
  departureDate: string; // Thursday YYYY-MM-DD (depart SEA)
  returnDate: string;    // Monday  YYYY-MM-DD (depart SIN)
}

export interface UseCaseConfig {
  id: UseCase;
  label: string;
  description: string;
}

export interface FlightResult {
  price: number;        // USD, round trip total (sum of two one-way calendar prices)
  airline?: string;     // IATA code — not available from price calendar
  stops?: number;       // not available from price calendar
  deltaFiltered: boolean; // true only if result is verified Delta-only
}

export interface HotelResult {
  name: string;
  price: number;   // USD, total for stay
  nights: number;
}

export interface WeekendResult {
  weekend: Weekend;
  flight: FlightResult | null;
  hotel: HotelResult | null;
  totalCost: number | null;
  error?: string;
}
