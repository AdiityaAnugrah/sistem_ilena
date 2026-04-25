'use client';
import { forwardRef, useRef } from 'react';

function toDisplay(v: string) {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return '';
  const [y, m, d] = v.split('-');
  return `${d}/${m}/${y}`;
}

const DateInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ value = '', onChange, className, style, ...props }, ref) => {
    const hiddenRef = useRef<HTMLInputElement>(null);

    const openPicker = () => {
      const input = hiddenRef.current;
      if (input) {
        input.showPicker?.();
      }
    };

    return (
      <div style={{ position: 'relative', display: 'block' }}>
        {/* Visible: shows DD/MM/YYYY, click opens native picker */}
        <input
          type="text"
          readOnly
          value={toDisplay(String(value))}
          placeholder="DD/MM/YYYY"
          onClick={openPicker}
          className={className}
          style={{ ...style, cursor: 'pointer', width: '100%', boxSizing: 'border-box' }}
        />
        {/* Native date input — hidden, only used for the picker */}
        <input
          {...props}
          ref={(node) => {
            (hiddenRef as any).current = node;
            if (typeof ref === 'function') ref(node);
            else if (ref) ref.current = node;
          }}
          type="date"
          value={value}
          onChange={onChange}
          style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0, top: 0, left: 0 }}
          tabIndex={-1}
        />
      </div>
    );
  }
);
DateInput.displayName = 'DateInput';

export default DateInput;
