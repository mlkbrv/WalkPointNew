/**
 * Local-time date helpers shared by every step provider.
 *
 * All of these deliberately work in the device's own timezone. "Today" means
 * the user's day, and the server keys `daily_steps` on a `YYYY-MM-DD` string,
 * so anything built from `toISOString()` would silently be UTC and land on the
 * wrong day for anyone east or west of Greenwich after certain hours.
 */

/** `YYYY-MM-DD` for a date, in local time — not UTC. */
export function localDateKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function localMidnight(offsetDays = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * An ISO string that keeps the local offset.
 *
 * Health Connect evaluates a `between` filter in instant time, so the boundary
 * has to carry the zone; sending a bare local wall-clock time would shift the
 * window by the offset.
 */
export function localIso(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const offsetMin = -d.getTimezoneOffset();
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}
