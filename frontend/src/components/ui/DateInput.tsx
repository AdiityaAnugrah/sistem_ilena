import { forwardRef } from 'react';

const DateInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  (props, ref) => (
    <input {...props} ref={ref} type="date" lang="id-ID" />
  )
);
DateInput.displayName = 'DateInput';

export default DateInput;
