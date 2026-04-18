"use client";

import { useState, useEffect, useCallback } from "react";
import { getThurMondayPairs, formatDateRange, formatDuration } from "@/lib/dates";
import type { UseCase, WeekendResult, Weekend } from "@/lib/types";

const USE_CASES: { id: UseCase; label: string; description: string }[] = [
  { id: 1, label: "Delta + Hyatt", description: "Delta flights · Hyatt hotels only" },
  { id: 2, label: "Delta + Any Hotel", description: "Delta flights · All hotels" },
  { id: 3, label: "Any Airline + Hyatt", description: "All airlines · Hyatt hotels only" },
  { id: 4, label: "All Options", description: "All airlines · All hotels" },
];

type ResultMap = Map<string, WeekendResult | "loading" | "error">;

function weekendKey(w: Weekend) {
  return w.departureDate;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<UseCase>(1);
  const [results, setResults] = useState<ResultMap>(new Map());
  const [hotelIds, setHotelIds] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "fetching-hotels" | "fetching-trips" | "done" | "error">("idle");
  const [sortBy, setSortBy] = useState<"cost" | "date">("cost");

  const weekends = getThurMondayPairs(new Date(), 6);

  const fetchTab = useCallback(async (useCase: UseCase) => {
    setResults(new Map());
    setStatus("fetching-hotels");

    // Step 1: get hotel IDs for this use case
    let ids: string[] = [];
    try {
      const res = await fetch(`/api/hotels?useCase=${useCase}`);
      const data = await res.json();
      ids = data.hotelIds ?? [];
    } catch {
      setStatus("error");
      return;
    }
    setHotelIds(ids);
    setStatus("fetching-trips");

    // Step 2: fire all weekend searches in parallel
    const initialMap = new Map<string, WeekendResult | "loading" | "error">();
    weekends.forEach((w) => initialMap.set(weekendKey(w), "loading"));
    setResults(new Map(initialMap));

    const hotelParam = ids.join(",");

    await Promise.allSettled(
      weekends.map(async (w) => {
        try {
          const url =
            `/api/search?useCase=${useCase}` +
            `&departureDate=${w.departureDate}` +
            `&returnDate=${w.returnDate}` +
            (hotelParam ? `&hotelIds=${hotelParam}` : "");
          const res = await fetch(url);
          const data = await res.json();
          setResults((prev) => {
            const next = new Map(prev);
            next.set(weekendKey(w), data.result as WeekendResult);
            return next;
          });
        } catch {
          setResults((prev) => {
            const next = new Map(prev);
            next.set(weekendKey(w), "error");
            return next;
          });
        }
      })
    );

    setStatus("done");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchTab(activeTab);
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const completedResults = weekends
    .map((w) => results.get(weekendKey(w)))
    .filter((r): r is WeekendResult => !!r && r !== "loading" && r !== "error");

  const sorted = [...completedResults].sort((a, b) => {
    if (sortBy === "cost") {
      if (a.totalCost === null && b.totalCost === null) return 0;
      if (a.totalCost === null) return 1;
      if (b.totalCost === null) return -1;
      return a.totalCost - b.totalCost;
    }
    return a.weekend.departureDate.localeCompare(b.weekend.departureDate);
  });

  const loadingCount = weekends.filter((w) => results.get(weekendKey(w)) === "loading").length;
  const doneCount = weekends.length - loadingCount;

  return (
    <main className="min-h-screen p-6 max-w-6xl mx-auto">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Singapore Trip Finder</h1>
        <p className="text-gray-500 mt-1 text-sm">
          4-day Thu–Mon weekends · Seattle (SEA) → Singapore (SIN) · Next 6 months
        </p>
      </header>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {USE_CASES.map((uc) => (
          <button
            key={uc.id}
            onClick={() => setActiveTab(uc.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === uc.id
                ? "bg-blue-600 text-white shadow"
                : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            {uc.label}
          </button>
        ))}
      </div>

      <p className="text-xs text-gray-400 mb-4">
        {USE_CASES.find((u) => u.id === activeTab)?.description}
      </p>

      {/* Status bar */}
      {status !== "idle" && status !== "done" && (
        <div className="mb-4 flex items-center gap-3 text-sm text-gray-600">
          <svg className="animate-spin h-4 w-4 text-blue-500" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          {status === "fetching-hotels" && "Loading hotel options…"}
          {status === "fetching-trips" && `Checking ${doneCount} of ${weekends.length} weekends…`}
        </div>
      )}

      {status === "done" && (
        <p className="text-xs text-gray-400 mb-4">
          Found {sorted.filter((r) => r.totalCost !== null).length} options with pricing ·{" "}
          <button onClick={() => fetchTab(activeTab)} className="text-blue-500 hover:underline">
            Refresh
          </button>
        </p>
      )}

      {/* Sort toggle */}
      {sorted.length > 0 && (
        <div className="flex gap-3 mb-4 items-center text-sm text-gray-600">
          <span>Sort by:</span>
          <button
            onClick={() => setSortBy("cost")}
            className={`px-3 py-1 rounded ${sortBy === "cost" ? "bg-blue-100 text-blue-700 font-medium" : "hover:bg-gray-100"}`}
          >
            Total Cost
          </button>
          <button
            onClick={() => setSortBy("date")}
            className={`px-3 py-1 rounded ${sortBy === "date" ? "bg-blue-100 text-blue-700 font-medium" : "hover:bg-gray-100"}`}
          >
            Date
          </button>
        </div>
      )}

      {/* Results */}
      <div className="space-y-3">
        {sorted.length === 0 && status === "done" && (
          <p className="text-gray-500 text-sm py-8 text-center">No results found for this period.</p>
        )}

        {sorted.map((r) => (
          <ResultCard key={r.weekend.departureDate} result={r} />
        ))}

        {/* Skeleton rows for still-loading weekends */}
        {status === "fetching-trips" &&
          weekends
            .filter((w) => results.get(weekendKey(w)) === "loading")
            .slice(0, 3)
            .map((w) => <SkeletonRow key={w.departureDate} weekend={w} />)}
      </div>
    </main>
  );
}

function ResultCard({ result }: { result: WeekendResult }) {
  const { weekend, outbound, inbound, hotel, totalCost } = result;

  const hasFullData = outbound && inbound && hotel && totalCost !== null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* Date */}
        <div className="min-w-[180px]">
          <p className="font-semibold text-gray-900">{formatDateRange(weekend.departureDate, weekend.returnDate)}</p>
          <p className="text-xs text-gray-400">Thu → Mon · 4 nights</p>
        </div>

        {/* Outbound flight */}
        <FlightCell label="SEA → SIN" flight={outbound} />

        {/* Return flight */}
        <FlightCell label="SIN → SEA" flight={inbound} />

        {/* Hotel */}
        <div className="min-w-[160px]">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Hotel</p>
          {hotel ? (
            <>
              <p className="text-sm font-medium text-gray-800 truncate max-w-[180px]">{hotel.name}</p>
              <p className="text-xs text-gray-500">
                ${hotel.totalPrice.toLocaleString()} total · {hotel.chainCode || "—"}
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-400">No availability</p>
          )}
        </div>

        {/* Total */}
        <div className="text-right min-w-[100px]">
          {hasFullData ? (
            <>
              <p className="text-xl font-bold text-green-700">${totalCost!.toLocaleString()}</p>
              <p className="text-xs text-gray-400">flight + hotel</p>
            </>
          ) : (
            <p className="text-sm text-gray-400">—</p>
          )}
        </div>
      </div>

      {result.error && (
        <p className="text-xs text-red-400 mt-2">{result.error}</p>
      )}
    </div>
  );
}

function FlightCell({ label, flight }: { label: string; flight: WeekendResult["outbound"] }) {
  return (
    <div className="min-w-[140px]">
      <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
      {flight ? (
        <>
          <p className="text-sm font-medium text-gray-800">
            ${flight.price.toLocaleString()}{" "}
            <span className="text-xs text-gray-500">({flight.airline})</span>
          </p>
          <p className="text-xs text-gray-500">
            {formatDuration(flight.duration)} · {flight.stops === 0 ? "nonstop" : `${flight.stops} stop${flight.stops > 1 ? "s" : ""}`}
          </p>
        </>
      ) : (
        <p className="text-sm text-gray-400">No flights</p>
      )}
    </div>
  );
}

function SkeletonRow({ weekend }: { weekend: Weekend }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 animate-pulse">
      <div className="flex items-center gap-6">
        <div>
          <div className="h-4 w-36 bg-gray-200 rounded mb-1" />
          <div className="h-3 w-20 bg-gray-100 rounded" />
        </div>
        <p className="text-xs text-gray-300 ml-auto">
          {formatDateRange(weekend.departureDate, weekend.returnDate)}
        </p>
      </div>
    </div>
  );
}
