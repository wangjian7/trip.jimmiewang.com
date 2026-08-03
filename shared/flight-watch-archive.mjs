const BEIJING_DAY_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function beijingDateKey(now = new Date()) {
  const parts = Object.fromEntries(
    BEIJING_DAY_FORMATTER.formatToParts(now).map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function isFlightWatchArchived(travelDate, now = new Date()) {
  if (!travelDate || !/^\d{4}-\d{2}-\d{2}$/.test(travelDate)) return false;
  return travelDate < beijingDateKey(now);
}

export function splitFlightWatchesByArchive(watches, now = new Date()) {
  const active = [];
  const archived = [];

  for (const watch of watches) {
    if (isFlightWatchArchived(watch.travelDate, now)) archived.push(watch);
    else active.push(watch);
  }

  return { active, archived };
}
