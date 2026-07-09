export type ScheduleSlotId = "am" | "pm";

const SCHEDULE_SLOTS = [
  { slot: "am" as const, localTime: "09:00", label: "上午场" },
  { slot: "pm" as const, localTime: "15:00", label: "下午场" },
];

function beijingParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  );
  return {
    today: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

function minutesOfDay(hour: number, minute: number) {
  return hour * 60 + minute;
}

export function beijingScheduleContext(date = new Date()) {
  const { today, hour, minute } = beijingParts(date);
  const nowMinutes = minutesOfDay(hour, minute);
  const amMinutes = 9 * 60;
  const pmMinutes = 15 * 60;

  const todayPassedSlots: ScheduleSlotId[] = [];
  if (nowMinutes >= amMinutes) todayPassedSlots.push("am");
  if (nowMinutes >= pmMinutes) todayPassedSlots.push("pm");

  let nextRun: {
    slot: ScheduleSlotId;
    localTime: string;
    label: string;
    scrapeDate: string;
  };

  if (nowMinutes < amMinutes) {
    nextRun = { slot: "am", localTime: "09:00", label: "上午场", scrapeDate: today };
  } else if (nowMinutes < pmMinutes) {
    nextRun = { slot: "pm", localTime: "15:00", label: "下午场", scrapeDate: today };
  } else {
    const tomorrow = new Date(date);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowParts = beijingParts(tomorrow);
    nextRun = {
      slot: "am",
      localTime: "09:00",
      label: "上午场",
      scrapeDate: tomorrowParts.today,
    };
  }

  return {
    timezone: "Asia/Shanghai",
    today,
    nowIso: date.toISOString(),
    slots: SCHEDULE_SLOTS,
    todayPassedSlots,
    nextRun,
  };
}
