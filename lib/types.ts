export type UseCase = 1 | 2 | 3 | 4;

export interface Weekend {
  departureDate: string; // Thursday YYYY-MM-DD
  returnDate: string;    // Monday YYYY-MM-DD
}

export interface FlightSegment {
  departure: { iataCode: string; at: string };
  arrival: { iataCode: string; at: string };
  carrierCode: string;
  number: string;
  duration: string;
}

export interface FlightItinerary {
  duration: string;
  segments: FlightSegment[];
}

export interface FlightOffer {
  price: number;
  currency: string;
  airline: string;     // primary carrier code
  stops: number;
  duration: string;    // total itinerary duration
  maxLayoverMinutes: number;
  itinerary: FlightItinerary;
}

export interface HotelOffer {
  hotelId: string;
  name: string;
  chainCode: string;
  pricePerNight: number;
  totalPrice: number;  // 4 nights
  currency: string;
  rating: number;
}

export interface WeekendResult {
  weekend: Weekend;
  outbound: FlightOffer | null;
  inbound: FlightOffer | null;
  hotel: HotelOffer | null;
  totalCost: number | null;
  error?: string;
}

export interface SearchResponse {
  result: WeekendResult;
}

export interface HotelsResponse {
  hotelIds: string[];
}
