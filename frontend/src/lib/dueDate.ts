export const DUE_DAY_OPTIONS = [0, 7, 14, 21, 30, 45, 60, 90] as const;

export type DueDateSelection = { term: string; customDate: string };
export const defaultDueDate = (): DueDateSelection => ({ term: '14', customDate: '' });

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function getDueDate(documentDate: string, selection: DueDateSelection): string {
  if (!isIsoDate(documentDate)) return '';
  if (selection.term === 'CUSTOM') return selection.customDate;
  const days = Number(selection.term);
  if (!DUE_DAY_OPTIONS.some(option => String(option) === selection.term)) return '';
  const date = new Date(`${documentDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function isDueDateValid(documentDate: string, dueDate: string): boolean {
  return isIsoDate(documentDate) && isIsoDate(dueDate) && dueDate >= documentDate;
}
