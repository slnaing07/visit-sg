import type { Weekend } from "./types";

export function getThurMondayPairs(fromDate: Date, monthsAhead: number): Weekend[] {
  const pairs: Weekend[] = [];
  const end = new Date(fromDate);
  end.setMonth(end.getMonth() + monthsAhead);

  const current = new Date(fromDate);
  current.setDate(current.getDate() + 1); // start from tomorrow at earliest

  // Advance to next Thursday (day 4)
  while (current.getDay() !== 4) {
    current.setDate(current.getDate() + 1);
  }

  while (current <= end) {
    const monday = new Date(current);
    monday.setDate(monday.getDate() + 4);

    if (monday <= end) {
      pairs.push({
        departureDate: toDateStr(current),
        returnDate: toDateStr(monday),
      });
    }

    current.setDate(current.getDate() + 7);
  }

  return pairs;
}

function toDateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

export function formatDateRange(departureDate: string, returnDate: string): string {
  const dep = new Date(departureDate + "T12:00:00");
  const ret = new Date(returnDate + "T12:00:00");
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${dep.toLocaleDateString("en-US", opts)} – ${ret.toLocaleDateString("en-US", { ...opts, year: "numeric" })}`;
}

export function formatDuration(isoDuration: string): string {
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return isoDuration;
  const h = match[1] ? `${match[1]}h` : "";
  const m = match[2] ? `${match[2]}m` : "";
  return [h, m].filter(Boolean).join(" ");
}
