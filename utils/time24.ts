/** پارس ساعت ۲۴ساعته HH:mm (۰۰:۰۰ تا ۲۳:۵۹) */
export function parseTime24(value: string): { hour: number; minute: number } | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(trimmed);
  if (!match) return null;
  const hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

export function formatTime24(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function normalizeTime24(value: string): string {
  const parsed = parseTime24(value);
  return parsed ? formatTime24(parsed.hour, parsed.minute) : '';
}

export function isValidTime24(value: string): boolean {
  return parseTime24(value) !== null;
}

/** نمایش یکنواخت برای لیست‌ها */
export function formatTime24Display(value: string | undefined | null): string {
  if (!value?.trim()) return '—';
  return normalizeTime24(value) || value.trim();
}
