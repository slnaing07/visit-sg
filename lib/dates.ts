import type { Weekend } from "./types";

export function getThurMondayPairs(fromDate: Date, monthsAhead: number): Weekend[] {
  // Normalize to midnight UTC so local timezone never shifts the date string.
  // toISOString() always returns UTC, so all arithmetic must also use UTC.
  const pairs: Weekend[] = [];
  const start = new Date(fromDate);
  start.setUTCHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + monthsAhead);

  const current = new Date(start);
  current.setUTCDate(current.getUTCDate() + 1); // start from tomorrow at earliest

  while (current.getUTCDay() !== 4) {
    current.setUTCDate(current.getUTCDate() + 1);
  }

  while (current <= end) {
    const monday = new Date(current);
    monday.setUTCDate(monday.getUTCDate() + 4);

    if (monday <= end) {
      pairs.push({
        departureDate: toDateStr(current),
        returnDate: toDateStr(monday),
      });
    }

    current.setUTCDate(current.getUTCDate() + 7);
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
