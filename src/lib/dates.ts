export function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}
export function getDaysArray(start: string, end: string): Date[] {
  const arr = [];
  const dt = new Date(start);
  const endDt = new Date(end);

  while (dt <= endDt) {
      arr.push(new Date(dt));
      dt.setDate(dt.getDate() + 1);
  }
  return arr;
}
export function calculateDateOffset(date: Date, offset: number): string {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + offset);
  copy.setMinutes(0, 0, 0);
  return copy.toISOString();
}

export function toDateInputValue(iso: string): Date {
  return startOfDay(new Date(iso));
}

export function isScheduledBeforeCreated(scheduledAt: string, createdAt: string): boolean {
  return startOfDay(new Date(scheduledAt)).getTime() < startOfDay(new Date(createdAt)).getTime();
}

export function isDateInRange(iso: string, from: Date | null, to: Date | null): boolean {
  if (!from && !to) {
    return true;
  }
  const value = startOfDay(new Date(iso)).getTime();
  if (from && value < startOfDay(from).getTime()) {
    return false;
  }
  if (to && value > startOfDay(to).getTime()) {
    return false;
  }
  return true;
}

export function formatDateUk(iso: string): string {
  return new Intl.DateTimeFormat("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(iso));
}

export function formatIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseIsoDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

export function formatTimeUk(iso: string): string {
  return new Intl.DateTimeFormat("uk-UA", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function convertDateToDdMmDayOfWeek(date: Date): string {
  return new Intl.DateTimeFormat("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    weekday: "short",
  }).format(date).split(", ").reverse().join(" • ").toUpperCase();
}
export function isToday(date: Date): boolean {
  return date.getDate() === new Date().getDate();
}
export function isTomorrow(date: Date): boolean {
  return date.getDate() === new Date().getDate() + 1;
}
export function isYesterday(date: Date): boolean {
  return date.getDate() === new Date().getDate() - 1;
}
export function isMoreThanOneDay(date: Date): boolean {
  return date.getDate() > new Date().getDate() + 1;
}
export function isLessThanOneDay(date: Date): boolean {
  return date.getDate() < new Date().getDate() - 1;
}
