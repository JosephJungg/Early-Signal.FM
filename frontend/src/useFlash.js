import { useEffect, useRef, useState } from 'react';

// Returns 'tick-up' / 'tick-down' for a moment after a number changes, so the change is easy to spot.
export function useFlash(value) {
  const prev = useRef(value);
  const [cls, setCls] = useState('');
  useEffect(() => {
    if (prev.current === value || value == null || prev.current == null) {
      prev.current = value;
      return undefined;
    }
    setCls(value > prev.current ? 'tick-up' : 'tick-down');
    prev.current = value;
    const id = setTimeout(() => setCls(''), 1700);
    return () => clearTimeout(id);
  }, [value]);
  return cls;
}
