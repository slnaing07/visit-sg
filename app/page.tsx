"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getThurMondayPairs, formatDateRange } from "@/lib/dates";
import { flightUrl, hotelUrl } from "@/lib/links";
import type { UseCase, UseCaseConfig, WeekendResult, Weekend } from "@/lib/types";
import type { XoteloHotel } from "@/lib/xotelo";

const USE_CASES: UseCaseConfig[] = [
  { id: 1, label: "Delta + Hyatt",       description: "Delta flights · Hyatt hotels only" },
  { id: 2, label: "Delta + Any Hotel",   description: "Delta flights · All hotels" },
  { id: 3, label: "Any Airline + Hyatt", description: "All airlines · Hyatt hotels only" },
  { id: 4, label: "All Options",         description: "All airlines · All hotels" },
];

type ResultEntry = WeekendResult | "loading";
type ResultMap  = Map<string, ResultEntry>;

const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

function cacheKey(useCase: UseCase) {
  return `visit-sg-results-v1-uc${useCase}`;
}

function loadCache(useCase: UseCase): WeekendResult[] | null {
  try {
    const raw = localStorage.getItem(cacheKey(useCase));
    if (!raw) return null;
    const { ts, results } = JSON.parse(raw) as { ts: number; results: WeekendResult[] };
    if (Date.now() - ts > CACHE_TTL_MS) return null;
    return results;
  } catch {
    return null;
  }
}

function saveCache(useCase: UseCase, results: WeekendResult[]) {
  try {
    localStorage.setItem(cacheKey(useCase), JSON.stringify({ ts: Date.now(), results }));
  } catch { /* storage full — ignore */ }
}

function daysUntil(isoDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(isoDate + "T12:00:00").getTime() - today.getTime()) / 86400000);
}

export default function Home() {
  const [activeTab, setActiveTab]   = useState<UseCase>(1);
  const [results, setResults]       = useState<ResultMap>(new Map());
  const [status, setStatus]         = useState<"idle" | "loading" | "done" | "error">("idle");
  const [sortBy, setSortBy]         = useState<"cost" | "date">("cost");
  const abortRef                    = useRef<AbortController | null>(null);

  const weekends = getThurMondayPairs(new Date(), 6);

  const runFetch = useCallback(async (useCase: UseCase, force = false) => {
    // Cancel any previous in-flight fetches
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    if (!force) {
      const cached = loadCache(useCase);
      if (cached) {
        const map = new Map<string, ResultEntry>();
        cached.forEach((r) => map.set(r.weekend.departureDate, r));
        setResults(map);
        setStatus("done");
        return;
      }
    }

    setStatus("loading");
    const initial = new Map<string, ResultEntry>();
    weekends.forEach((w) => initial.set(w.departureDate, "loading"));
    setResults(new Map(initial));

    // Step 1: get hotel list for this use case
    let hotels: XoteloHotel[] = [];
    try {
      const res = await fetch(`/api/hotels?useCase=${useCase}`, { signal: controller.signal });
      const data = await res.json() as { hotels: XoteloHotel[] };
      hotels = data.hotels ?? [];
    } catch {
      if (controller.signal.aborted) return;
      setStatus("error");
      return;
    }

    const hotelsParam = encodeURIComponent(JSON.stringify(hotels));

    // Step 2: fetch each weekend in parallel
    const finished: WeekendResult[] = [];

    await Promise.allSettled(
      weekends.map(async (w) => {
        try {
          const url =
            `/api/search?useCase=${useCase}` +
            `&departureDate=${w.departureDate}` +
            `&returnDate=${w.returnDate}` +
            `&hotels=${hotelsParam}`;
          const res  = await fetch(url, { signal: controller.signal });
          const data = await res.json() as { result: WeekendResult };
          const r    = data.result;
          finished.push(r);
          setResults((prev) => {
            const next = new Map(prev);
            next.set(w.departureDate, r);
            return next;
          });
        } catch {
          if (!controller.signal.aborted) {
            setResults((prev) => {
              const next = new Map(prev);
              next.set(w.departureDate, {
                weekend: w,
                flight: null,
                hotel: null,
                totalCost: null,
                error: "Request failed",
              });
              return next;
            });
          }
        }
      })
    );

    if (!controller.signal.aborted) {
      saveCache(useCase, finished);
      setStatus("done");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    runFetch(activeTab);
    return () => abortRef.current?.abort();
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Collect completed results for display
  const completed = weekends
    .map((w) => results.get(w.departureDate))
    .filter((r): r is WeekendResult => !!r && r !== "loading");

  const sorted = [...completed].sort((a, b) => {
    if (sortBy === "cost") {
      if (a.totalCost === null && b.totalCost === null) return 0;
      if (a.totalCost === null) return 1;
      if (b.totalCost === null) return -1;
      return a.totalCost - b.totalCost;
    }
    return a.weekend.departureDate.localeCompare(b.weekend.departureDate);
  });

  const loadingCount = weekends.filter((w) => results.get(w.departureDate) === "loading").length;
  const withPrices   = sorted.filter((r) => r.totalCost !== null).length;
  const uc           = USE_CASES.find((u) => u.id === activeTab)!;

  return (
    <main className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Singapore Trip Finder</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Thu–Mon weekends · Seattle (SEA) → Singapore (SIN) · next 6 months
          </p>
        </header>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-1">
          {USE_CASES.map((u) => (
            <button
              key={u.id}
              onClick={() => setActiveTab(u.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === u.id
                  ? "bg-blue-600 text-white shadow"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-100"
              }`}
            >
              {u.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400 mb-5">{uc.description}</p>

        {/* Status bar */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            {status === "loading" && (
              <>
                <Spinner />
                <span className="text-sm text-gray-500">
                  {loadingCount > 0
                    ? `Checking ${weekends.length - loadingCount} of ${weekends.length} weekends…`
                    : "Loading hotel options…"}
                </span>
              </>
            )}
            {status === "done" && (
              <span className="text-sm text-gray-500">
                {withPrices} of {weekends.length} weekends with full pricing
              </span>
            )}
            {status === "error" && (
              <span className="text-sm text-red-500">Failed to load — check your API token</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {status === "done" && (
              <button
                onClick={() => runFetch(activeTab, true)}
                className="text-xs text-blue-500 hover:underline"
              >
                Refresh prices
              </button>
            )}
            {sorted.length > 0 && (
              <div className="flex gap-1 text-xs bg-white border border-gray-200 rounded-lg overflow-hidden">
                {(["cost", "date"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSortBy(s)}
                    className={`px-3 py-1.5 capitalize ${
                      sortBy === s ? "bg-blue-600 text-white" : "text-gray-500 hover:bg-gray-50"
                    }`}
                  >
                    {s === "cost" ? "Sort: Cost" : "Sort: Date"}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Results */}
        <div className="space-y-2">
          {sorted.map((r) => (
            <ResultRow key={r.weekend.departureDate} result={r} useCase={activeTab} />
          ))}

          {/* Skeleton rows for still-loading weekends */}
          {status === "loading" &&
            weekends
              .filter((w) => results.get(w.departureDate) === "loading")
              .slice(0, 4)
              .map((w) => <SkeletonRow key={w.departureDate} weekend={w} />)}

          {status === "done" && sorted.length === 0 && (
            <p className="text-center text-gray-400 py-12 text-sm">No results found.</p>
          )}
        </div>

        <p className="text-xs text-gray-400 mt-6 text-center">
          Prices from Travelpayouts (flights) & Xotelo (hotels) · Hotel: Fri check-in → Mon check-out, 3 nights ·
          Click links to book
        </p>
      </div>
    </main>
  );
}

function ResultRow({ result, useCase }: { result: WeekendResult; useCase: UseCase }) {
  const { weekend, flight, hotel, totalCost } = result;
  const days = daysUntil(weekend.departureDate);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">

        {/* Date + days away */}
        <div className="min-w-[170px]">
          <p className="font-semibold text-gray-900 text-sm">
            {formatDateRange(weekend.departureDate, weekend.returnDate)}
          </p>
          <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full mt-0.5 inline-block ${
            days <= 45 ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"
          }`}>
            {days}d away
          </span>
        </div>

        {/* Flight price */}
        <div className="min-w-[130px]">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Round-trip flight</p>
          {flight ? (
            <>
              <p className="text-sm font-semibold text-gray-800">
                ${flight.price.toLocaleString()}{" "}
                <span className="text-xs font-normal text-gray-500">({flight.airline})</span>
              </p>
              <p className="text-xs text-gray-400">
                {flight.stops === 0 ? "Nonstop" : `${flight.stops} stop${flight.stops > 1 ? "s" : ""}`}
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-300">No data</p>
          )}
        </div>

        {/* Hotel price */}
        <div className="min-w-[160px] flex-1">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Hotel · 3 nights</p>
          {hotel ? (
            <>
              <p className="text-sm font-semibold text-gray-800">${hotel.price.toLocaleString()}</p>
              <p className="text-xs text-gray-400 truncate max-w-[200px]">{hotel.name}</p>
            </>
          ) : (
            <p className="text-sm text-gray-300">No data</p>
          )}
        </div>

        {/* Total cost */}
        <div className="text-right min-w-[90px]">
          {totalCost !== null ? (
            <>
              <p className="text-xl font-bold text-green-700">${totalCost.toLocaleString()}</p>
              <p className="text-xs text-gray-400">total est.</p>
            </>
          ) : (
            <p className="text-sm text-gray-300">—</p>
          )}
        </div>

        {/* Links */}
        <div className="flex flex-col gap-1 min-w-[80px] text-right">
          <a
            href={flightUrl(useCase, weekend.departureDate, weekend.returnDate)}
            target="_blank" rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:underline"
          >
            Flights ↗
          </a>
          <a
            href={hotelUrl(useCase, weekend.departureDate, weekend.returnDate)}
            target="_blank" rel="noopener noreferrer"
            className="text-xs text-emerald-600 hover:underline"
          >
            Hotels ↗
          </a>
        </div>

      </div>
      {result.error && (
        <p className="text-xs text-red-400 mt-2">{result.error}</p>
      )}
    </div>
  );
}

function SkeletonRow({ weekend }: { weekend: Weekend }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 animate-pulse">
      <div className="flex items-center gap-4">
        <div className="min-w-[170px]">
          <div className="h-4 w-36 bg-gray-200 rounded mb-1" />
          <div className="h-3 w-16 bg-gray-100 rounded" />
        </div>
        <div className="flex-1 flex gap-8">
          <div className="h-4 w-20 bg-gray-100 rounded" />
          <div className="h-4 w-24 bg-gray-100 rounded" />
        </div>
        <p className="text-xs text-gray-200 ml-auto">
          {formatDateRange(weekend.departureDate, weekend.returnDate)}
        </p>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4 text-blue-500" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}
