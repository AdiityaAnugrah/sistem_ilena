'use client';

import { useId, useState } from 'react';
import { DUE_DAY_OPTIONS, defaultDueDate, getDueDate, isDueDateValid, type DueDateSelection } from '@/lib/dueDate';

export function useDueDate(documentDate: string) {
  const [selection, setSelection] = useState<DueDateSelection>(defaultDueDate);
  const date = getDueDate(documentDate, selection);
  return {
    date,
    isValid: isDueDateValid(documentDate, date),
    reset: () => setSelection(defaultDueDate()),
    load: (savedDate?: string) => setSelection(savedDate ? { term: 'CUSTOM', customDate: savedDate } : defaultDueDate()),
    fieldProps: { documentDate, value: selection, onChange: setSelection },
  };
}

type Props = {
  documentDate: string;
  value: DueDateSelection;
  onChange: (value: DueDateSelection) => void;
};

export default function DueDateField({ documentDate, value, onChange }: Props) {
  const id = useId();
  const dueDate = getDueDate(documentDate, value);
  const valid = isDueDateValid(documentDate, dueDate);
  const fieldClass = 'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100';

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-xs font-semibold text-slate-600">Jatuh tempo</label>
      <select id={id} value={value.term} aria-describedby={`${id}-help`} className={fieldClass}
        onChange={event => onChange({ term: event.target.value, customDate: event.target.value === 'CUSTOM' ? dueDate : value.customDate })}>
        {DUE_DAY_OPTIONS.map(days => (
          <option key={days} value={String(days)}>{days === 0 ? 'Pada tanggal dokumen' : `${days} hari${days === 14 ? ' (default)' : ''}`}</option>
        ))}
        <option value="CUSTOM">Tanggal khusus</option>
      </select>
      {value.term === 'CUSTOM' && (
        <div className="space-y-1.5">
          <label htmlFor={`${id}-date`} className="block text-xs font-medium text-slate-600">Tanggal jatuh tempo</label>
          <input id={`${id}-date`} type="date" required min={documentDate} value={value.customDate}
            aria-invalid={!valid} aria-describedby={`${id}-help`} className={fieldClass}
            onChange={event => onChange({ ...value, customDate: event.target.value })} />
        </div>
      )}
      <p id={`${id}-help`} className={`text-xs ${valid ? 'text-slate-500' : 'text-red-600'}`} aria-live="polite">
        {valid
          ? `Jatuh tempo: ${dueDate.split('-').reverse().join('/')} · dihitung dari tanggal dokumen.`
          : 'Pilih tanggal jatuh tempo yang sama atau setelah tanggal dokumen.'}
      </p>
    </div>
  );
}
