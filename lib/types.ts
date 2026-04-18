export type UseCase = 1 | 2 | 3 | 4;

export interface Weekend {
  departureDate: string; // Thursday YYYY-MM-DD (depart SEA)
  returnDate: string;    // Monday  YYYY-MM-DD (depart SIN)
}

export interface UseCaseConfig {
  id: UseCase;
  label: string;
  description: string;
  flightSite: string;
  hotelSite: string;
}
