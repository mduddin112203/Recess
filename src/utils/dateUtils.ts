import { DateTime } from 'luxon';

export function getDeviceTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function toLocalDateString(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function toLocalTimeString(date: Date): string {
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

export function getLocalDayBoundsUTC(dateStr: string): { start: string; end: string } {
  const tz = getDeviceTimezone();
  const startOfDay = DateTime.fromISO(dateStr, { zone: tz }).startOf('day');
  const endOfDay = startOfDay.endOf('day');
  return {
    start: startOfDay.toUTC().toISO()!,
    end: endOfDay.toUTC().toISO()!,
  };
}

export function localDateTimeFromStrings(dateStr: string, timeStr: string): Date {
  const tz = getDeviceTimezone();
  return DateTime.fromISO(`${dateStr}T${timeStr}`, { zone: tz }).toJSDate();
}

export function getLocalDayOfWeek(): number {
  const now = new Date();
  return now.getDay();
}

export function formatTimeDisplay(timeStr: string): string {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}
