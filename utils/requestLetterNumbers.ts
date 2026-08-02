import { Request } from '../types';

/** شماره نامه‌های موجود در یک درخواست — برای انواع درخواستی که این فیلد را دارند */
export function getRequestLetterNumbers(request: Request): string[] {
  const numbers: string[] = [];

  request.files?.forEach((file) => {
    if (file.letterNumber?.trim()) numbers.push(file.letterNumber.trim());
  });

  request.letterFollowups?.forEach((lf) => {
    if (lf.letterNumber?.trim()) numbers.push(lf.letterNumber.trim());
  });

  // انواع درخواست آینده با فیلد letterNumber را اینجا اضافه کنید.

  return numbers;
}

export function requestMatchesLetterNumberFilter(request: Request, query: string): boolean {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return true;
  return getRequestLetterNumbers(request).some((num) => num.includes(normalizedQuery));
}
