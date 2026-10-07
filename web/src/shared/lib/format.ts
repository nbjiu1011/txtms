/** Date display helpers. All business times are shown in KST. */
const KST_PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function kstParts(value: string | number | Date) {
  const parts = KST_PARTS.formatToParts(new Date(value));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute") };
}

/** `10/7 14:05` (reference `fDT`). `-` for empty values. */
export function formatDateTime(value: string | number | Date | null | undefined): string {
  if (value === null || value === undefined || value === "") return "-";
  const p = kstParts(value);
  return `${Number(p.month)}/${Number(p.day)} ${p.hour}:${p.minute}`;
}

/** `10월 7일` (reference `fD`). `-` for empty values. */
export function formatDate(value: string | number | Date | null | undefined): string {
  if (value === null || value === undefined || value === "") return "-";
  const p = kstParts(value);
  return `${Number(p.month)}월 ${Number(p.day)}일`;
}

const KST_WEEKDAY = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", weekday: "long" });

/** `10월 7일 수요일` — the given moment (default now) as a KST calendar day with its weekday. */
export function formatKstToday(value: string | number | Date = Date.now()): string {
  return `${formatDate(value)} ${KST_WEEKDAY.format(new Date(value))}`;
}

/** `YYYY-MM-DD` of the KST calendar day of a moment. */
export function kstDateKey(value: string | number | Date): string {
  const p = kstParts(value);
  return `${p.year}-${p.month.padStart(2, "0")}-${p.day.padStart(2, "0")}`;
}
