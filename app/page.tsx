"use client";

import { useState } from "react";
import { getThurMondayPairs, formatDateRange } from "@/lib/dates";
import { flightUrl, hotelUrl } from "@/lib/links";
import type { UseCase, UseCaseConfig } from "@/lib/types";

const USE_CASES: UseCaseConfig[] = [
  {
    id: 1,
    label: "Delta + Hyatt",
    description: "Delta flights only · Hyatt hotels only",
    flightSite: "delta.com",
    hotelSite: "hyatt.com",
  },
  {
    id: 2,
    label: "Delta + Any Hotel",
    description: "Delta flights only · All hotels via Google",
    flightSite: "delta.com",
    hotelSite: "Google Hotels",
  },
  {
    id: 3,
    label: "Any Airline + Hyatt",
    description: "All airlines via Google Flights · Hyatt hotels only",
    flightSite: "Google Flights",
    hotelSite: "hyatt.com",
  },
  {
    id: 4,
    label: "All Options",
    description: "All airlines · All hotels — fully open search",
    flightSite: "Google Flights",
    hotelSite: "Google Hotels",
  },
];

function daysUntil(isoDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(isoDate + "T12:00:00");
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

function openBoth(flightHref: string, hotelHref: string) {
  window.open(flightHref, "_blank", "noopener");
  window.open(hotelHref, "_blank", "noopener");
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<UseCase>(1);
  const weekends = getThurMondayPairs(new Date(), 6);
  const uc = USE_CASES.find((u) => u.id === activeTab)!;

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Singapore Trip Finder</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Thu–Mon 4-night weekends · Seattle (SEA) → Singapore (SIN) · next 6 months
          </p>
        </header>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-2">
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
        <p className="text-xs text-gray-400 mb-6">{uc.description}</p>

        {/* Weekend table */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto_auto_auto] text-xs font-semibold text-gray-400 uppercase tracking-wide px-5 py-3 border-b border-gray-100 gap-4">
            <span>Weekend</span>
            <span className="text-right">Away</span>
            <span className="text-right hidden sm:block">Nights</span>
            <span className="text-right">Flights</span>
            <span className="text-right">Hotels</span>
          </div>

          {weekends.map((w, i) => {
            const days = daysUntil(w.departureDate);
            const fUrl = flightUrl(activeTab, w.departureDate, w.returnDate);
            const hUrl = hotelUrl(activeTab, w.departureDate, w.returnDate);
            const isNear = days <= 45;

            return (
              <div
                key={w.departureDate}
                className={`grid grid-cols-[1fr_auto_auto_auto_auto] items-center px-5 py-4 gap-4 transition-colors hover:bg-blue-50 ${
                  i % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                }`}
              >
                {/* Date range */}
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {formatDateRange(w.departureDate, w.returnDate)}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Depart Thu · Return Mon
                  </p>
                </div>

                {/* Days away */}
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full text-right whitespace-nowrap ${
                    isNear
                      ? "bg-amber-100 text-amber-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {days}d
                </span>

                {/* Nights */}
                <span className="text-xs text-gray-400 text-right hidden sm:block">3 nights</span>

                {/* Flights link */}
                <a
                  href={fUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline text-right whitespace-nowrap"
                >
                  {uc.flightSite === "delta.com" ? "Delta ↗" : "Flights ↗"}
                </a>

                {/* Hotels link */}
                <a
                  href={hUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-emerald-600 hover:text-emerald-800 hover:underline text-right whitespace-nowrap"
                >
                  {uc.hotelSite === "hyatt.com" ? "Hyatt ↗" : "Hotels ↗"}
                </a>
              </div>
            );
          })}
        </div>

        <p className="text-xs text-gray-400 mt-4 text-center">
          Hotel dates: Fri check-in → Mon check-out (3 nights) · prices shown on destination site
        </p>
      </div>
    </main>
  );
}
