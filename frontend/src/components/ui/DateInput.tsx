'use client';
import { forwardRef } from 'react';

function toDisplay(v: string) {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return '';
  const [y, m, d] = v.split('-');
  return `${d}/${m}/${y}`;
}

const DateInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ value = '', onChange, className, style, ...props }, ref) => (
    <div style={{ position: 'relative', display: 'block' }}>
      {/* Visible: shows DD/MM/YYYY */}
      <input
        type="text"
        readOnly
        value={toDisplay(String(value))}
        placeholder="DD/MM/YYYY"
        className={className}
        style={{ ...style, cursor: 'pointer', width: '100%', boxSizing: 'border-box' }}
      />
      {/* Native date picker — invisible overlay triggers calendar on click */}
      <input
        {...props}
        ref={ref}
        type="date"
        value={value}
        onChange={onChange}
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0,
          cursor: 'pointer',
          width: '100%',
          height: '100%',
          zIndex: 1,
          boxSizing: 'border-box',
        }}
      />
    </div>
  )
);
DateInput.displayName = 'DateInput';

export default DateInput;
