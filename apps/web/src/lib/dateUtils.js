/**
 * Reliable date utility for formatting dates as YYYY-MM-DD in the local timezone.
 * Avoids the "one-day-back" shift of toISOString() in timezones like IST.
 */
export function toLocalISO(date) {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Returns the range for the current month in YYYY-MM-DD format (local).
 */
export function getThisMonthRange() {
  const now = new Date();
  return {
    from: toLocalISO(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: toLocalISO(now)
  };
}
