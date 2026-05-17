import { useEffect, useRef, useState } from "react";

const WINDOW_ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  "mousemove",
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
];

interface Options {
  // Total inactivity allowed before logout.
  idleMs: number;
  // How long before the deadline to start showing the warning.
  warnBeforeMs: number;
  // Called when the warning window opens.
  onWarn: () => void;
  // Called when the deadline is reached.
  onTimeout: () => void;
  enabled: boolean;
}

export function useIdleTimeout({ idleMs, warnBeforeMs, onWarn, onTimeout, enabled }: Options) {
  const [isWarning, setIsWarning] = useState(false);
  const warnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Latest callbacks via refs so changing them doesn't re-arm the timers.
  const onWarnRef = useRef(onWarn);
  const onTimeoutRef = useRef(onTimeout);
  onWarnRef.current = onWarn;
  onTimeoutRef.current = onTimeout;

  useEffect(() => {
    if (!enabled) return;

    const clear = () => {
      if (warnTimer.current) clearTimeout(warnTimer.current);
      if (logoutTimer.current) clearTimeout(logoutTimer.current);
    };

    const arm = () => {
      clear();
      setIsWarning(false);
      warnTimer.current = setTimeout(() => {
        setIsWarning(true);
        onWarnRef.current();
      }, Math.max(0, idleMs - warnBeforeMs));
      logoutTimer.current = setTimeout(() => {
        onTimeoutRef.current();
      }, idleMs);
    };

    const onActivity = () => {
      // Ignore the visibilitychange tab-hidden case; only count visibility as activity when becoming visible.
      if (document.visibilityState === "hidden") return;
      arm();
    };

    arm();
    WINDOW_ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, onActivity, { passive: true }));
    // visibilitychange lives on Document, not Window — listen separately so TS is happy.
    document.addEventListener("visibilitychange", onActivity);

    return () => {
      clear();
      WINDOW_ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, onActivity));
      document.removeEventListener("visibilitychange", onActivity);
    };
  }, [enabled, idleMs, warnBeforeMs]);

  const dismissWarning = () => {
    setIsWarning(false);
    // Re-arming happens on next activity; we also nudge it here.
    if (warnTimer.current) clearTimeout(warnTimer.current);
    if (logoutTimer.current) clearTimeout(logoutTimer.current);
    warnTimer.current = setTimeout(() => {
      setIsWarning(true);
      onWarnRef.current();
    }, Math.max(0, idleMs - warnBeforeMs));
    logoutTimer.current = setTimeout(() => {
      onTimeoutRef.current();
    }, idleMs);
  };

  return { isWarning, dismissWarning };
}
