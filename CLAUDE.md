# Singapore Trip Finder — Project Context for Claude Code

## What This Is
A personal Next.js website that shows the cheapest Thu–Mon 4-day weekend trips from Seattle (SEA) to Singapore (SIN) over the next 6 months. Deployed on Vercel at a custom domain (whenshouldivisitsingapore.com).

## Tech Stack
- **Framework**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Deployment**: Vercel (Pro plan — required for 60s function timeout)
- **Flight prices (any airline)**: Skyscanner price calendar via Sky Scrapper API on RapidAPI
- **Flight prices (Delta)**: Priceline API on RapidAPI
- **Hotel prices**: Xotelo API (free, no auth required)
- **Booking links**: Kayak (flights + hotels)

## Environment Variables
Must be set in Vercel → Settings → Environment Variables:
```
RAPIDAPI_KEY=<key>   # Used by both Sky Scrapper and Priceline APIs
```
The Xotelo hotel API requires no key.

## Four Use Cases (Tabs)
| Tab | Label | Flights | Hotels |
|-----|-------|---------|--------|
| 1 | Delta + Hyatt | Delta only (DL/KE codeshare) | Hyatt-branded only |
| 2 | Delta + Any Hotel | Delta only | All hotels |
| 3 | Any Airline + Hyatt | All airlines | Hyatt-branded only |
| 4 | All Options | All airlines | All hotels |

## Architecture

### Flight Pricing
- **Use cases 1 & 2 (Delta)**: `/api/flights` calls Priceline in batches of 5 with 500ms between batches. Filters itineraries where any leg has `operating_airline_code === "DL"`. Delta flies SEA→SIN as a codeshare with Korean Air (DL leg SEA→ICN, then KE→SIN). Displayed as "DL/KE".
- **Use cases 3 & 4 (any airline)**: `/api/flights` fetches the Skyscanner `getPriceCalendar` endpoint for both directions (SEA→SIN outbound, SIN→SEA inbound) — just 2 API calls for all 25 weekends. Round-trip price = outbound Thursday price + inbound Monday price.

### Hotel Pricing
- `/api/hotels` calls Xotelo `/list` endpoint with `price_ranges.minimum` per hotel.
- Hyatt filter: scans first 5 pages (150 hotels) in parallel and filters by name keywords: "hyatt", "andaz", "alila". Finds 2 Hyatt properties in Singapore: **Grand Hyatt** (~$338/night) and **Andaz** (~$294/night).
- All-hotels: first page only, sorted by price, top 10.
- Hotel price = cheapest hotel's `pricePerNight × 3 nights` (Fri check-in → Mon check-out).

### Frontend Flow (`app/page.tsx`)
1. On tab switch, check 4-hour localStorage cache. If hit, render immediately.
2. Fetch `/api/hotels?useCase=X` — fast (Xotelo, no auth).
3. Fetch `/api/flights?useCase=X` — slow for Delta (25 Priceline calls), fast for any-airline (2 Skyscanner calls).
4. Combine locally: for each weekend, pair `flights[departureDate]` with the cheapest hotel.
5. Save to localStorage cache (4-hour TTL).

### Booking Links (`lib/links.ts`)
- **Flights**: Kayak — `kayak.com/flights/SEA-SIN/{dep}/{ret}?cabin=economy&travelers=1a`
  - Delta tabs add `&fs=airlines=DL`
- **Hotels**: Kayak — `kayak.com/hotels/Singapore-c20828/{checkIn}/{checkOut}/1adults;map?sort=rank_a`
  - Hyatt tabs add `&fs=hotelchain=brg-370`

## Key Files
```
app/
  page.tsx                  — Main UI: tabs, fetch logic, result cards
  api/
    flights/route.ts        — Batch flight fetcher (Priceline + Skyscanner)
    hotels/route.ts         — Hotel list fetcher (Xotelo)
    search/route.ts         — Legacy per-weekend endpoint (still used for hotel combining)
    debug/route.ts          — Temporary debug endpoint, can be removed
lib/
  priceline.ts              — Priceline API client (Delta flights, per date-pair, with cache + retry)
  skyscanner-calendar.ts    — Skyscanner price calendar client (any-airline, module-level cache)
  xotelo.ts                 — Xotelo hotel list client
  links.ts                  — Booking deep link generators (Kayak)
  dates.ts                  — getThurMondayPairs(), formatDateRange()
  types.ts                  — FlightResult, HotelResult, WeekendResult, UseCase
```

## Issues Faced and Solved

### 1. Amadeus API Decommissioned
Planned to use Amadeus for flights. User found the self-service portal shuts down July 2026 and couldn't create an account. Pivoted to other APIs.

### 2. Travelpayouts (Aviasales) — No SEA→SIN Data
Travelpayouts is Eastern European market focused. SEA→SIN has no cached price data. Abandoned.

### 3. Sky Scrapper `searchFlights` — CAPTCHA Blocked
The `searchFlights` endpoint is blocked by Skyscanner's PerimeterX bot protection. Returns CAPTCHA HTML instead of flight data. The `getPriceCalendar` endpoint works fine and is used instead for any-airline pricing.

### 4. Kiwi.com Tequila API — No Longer Public
As of May 2024, Kiwi restricted Tequila to B2B partners only.

### 5. Wrong Sky Scrapper API
User initially subscribed to `sky-scrapper3` (a generic web scraper) instead of the correct Sky Scrapper by apiheya. Fixed by subscribing to the correct API.

### 6. Xotelo `/search` Requires RapidAPI (401)
Tried using `/search?query=Hyatt+Singapore` for Hyatt filtering — it returned 401. Fixed by paginating the public `/list` endpoint and filtering by hotel name keywords.

### 7. Xotelo `/rates` Not Needed
Originally planned per-hotel rate calls. Discovered that `/list` already includes `price_ranges.minimum`. Eliminated all per-rate calls.

### 8. `Promise.all` Bug
Original code used `Promise.all` for flight+hotel fetching — if flight threw, hotel results were silenced. Fixed to `Promise.allSettled`.

### 9. Delta Doesn't Fly SEA→SIN Directly
Delta has no direct or solo-operated route. It codeshares with Korean Air: DL operates SEA→ICN, KE operates ICN→SIN. Priceline filters for itineraries where any leg has `operating_airline_code === "DL"`.

### 10. Delta.com and Hyatt.com Reject Deep Links
Both sites block query-parameter deep links (Akamai WAF, bot protection). Switched to Kayak for flights (supports `&fs=airlines=DL` filter) and Kayak for hotels (supports `&fs=hotelchain=brg-370` for Hyatt).

### 11. Google Flights/Hotels Deep Links Don't Pre-fill
Tried multiple Google Flights URL formats — none reliably pre-populate destination and dates. Kayak is the reliable alternative.

### 12. Priceline Rate Limiting — 25 Parallel Calls
Initially called Priceline once per weekend (25 parallel calls from browser). Hit the plan rate limit, causing most calls to fail. Fixed by moving to a single `/api/flights` batch endpoint that calls Priceline sequentially/in controlled batches server-side.

### 13. Vercel 60s Function Timeout
Sequential Priceline calls for 25 weekends took ~50s locally and timed out on Vercel. Partially mitigated by using `export const maxDuration = 60` and batching 5 calls at a time with 500ms gaps. Still borderline.

### 14. `next.config.ts` Not Supported
Next.js 14.2 requires `next.config.mjs`, not `.ts`. Renamed.

## Current Known Issue: Flight Prices Not Showing on Deployed Site

**Symptom**: Hotels load correctly but no flight prices appear on any tab in production. Works locally (25/25 weekends).

**Most likely causes (in order of probability)**:

1. **`RAPIDAPI_KEY` not set in Vercel environment variables** — Both Skyscanner and Priceline calls need this key. If missing, all flight API calls fail and the frontend silently shows no prices (the catch block sets `flights = {}` without showing an error). **Check Vercel → Project → Settings → Environment Variables.**

2. **Stale localStorage cache** — If the page was loaded before a fix was deployed, old empty results may be cached for 4 hours. User should click "Refresh prices" to bypass.

3. **Vercel function timeout** — The Delta tabs (`/api/flights?useCase=1` or `2`) make 25 Priceline calls and can take 40-50 seconds. On Vercel Pro with `maxDuration = 60` this should be within limits, but production network latency to Priceline could push it over. Any-airline tabs (3 & 4) should be fast (~2s via Skyscanner calendar).

**To diagnose**: Open browser DevTools → Network tab → look at the `/api/flights` response. If it's a 500 error or the response body is `{"flights":{}}`, the RAPIDAPI_KEY is the culprit.

## Delta Availability Note
Delta only has availability on ~14 of 25 weekends. This is expected — the DL/KE codeshare isn't scheduled every week. The UI shows "No Delta flights" for unavailable dates.

## RapidAPI Subscriptions Needed
- **Sky Scrapper** by apiheya — for Skyscanner price calendar (any-airline tabs)
- **Priceline** by tipsters — for Delta-filtered itineraries (Delta tabs); user is on plan above Basic

Both use the same `RAPIDAPI_KEY`.
