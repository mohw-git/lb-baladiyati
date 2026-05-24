'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Generic countdown hook for "Resend in 60s" style rate-limit UIs.
 *
 * Returns:
 *  - `remaining`: seconds left, 0 when ready
 *  - `isCoolingDown`: true while remaining > 0
 *  - `start(seconds?)`: kick off / restart the countdown
 *  - `reset()`: jump back to ready (useful after an error you want to recover from)
 *
 * The default duration (60s) matches the per-route resend throttle on the
 * backend so the UI never lets the user spam a request that will 429.
 */
export function useCooldown(defaultSeconds = 60) {
  const [remaining, setRemaining] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clear = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const start = useCallback(
    (seconds: number = defaultSeconds) => {
      clear();
      setRemaining(Math.max(0, Math.floor(seconds)));
      intervalRef.current = setInterval(() => {
        setRemaining((prev) => {
          if (prev <= 1) {
            clear();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    },
    [clear, defaultSeconds],
  );

  const reset = useCallback(() => {
    clear();
    setRemaining(0);
  }, [clear]);

  useEffect(() => clear, [clear]);

  return {
    remaining,
    isCoolingDown: remaining > 0,
    start,
    reset,
  };
}
