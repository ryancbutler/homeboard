"use client";

import { useEffect, useRef } from "react";

const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;

export function useInactivityLogout(enabled: boolean) {
  const timedOutRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      timedOutRef.current = false;
      return;
    }

    let timeoutId: number | undefined;
    let lastActivityAt = Date.now();

    const signOut = () => {
      if (timedOutRef.current) return;
      timedOutRef.current = true;

      void fetch("/api/v1/auth/logout", { method: "POST", keepalive: true }).catch(() => undefined);
      window.location.replace("/");
    };

    const checkForInactivity = () => {
      if (Date.now() - lastActivityAt >= INACTIVITY_TIMEOUT_MS) {
        signOut();
      } else {
        scheduleTimeout();
      }
    };

    const scheduleTimeout = () => {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      const remaining = INACTIVITY_TIMEOUT_MS - (Date.now() - lastActivityAt);
      timeoutId = window.setTimeout(checkForInactivity, Math.max(remaining, 0));
    };

    const recordActivity = () => {
      lastActivityAt = Date.now();
      scheduleTimeout();
    };

    const recordMouseMovement = () => {
      lastActivityAt = Date.now();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastActivityAt >= INACTIVITY_TIMEOUT_MS) {
        signOut();
      } else {
        scheduleTimeout();
      }
    };

    const activityEvents: Array<keyof WindowEventMap> = ["input", "keydown", "pointerdown", "scroll", "touchstart"];
    activityEvents.forEach((eventName) => window.addEventListener(eventName, recordActivity, { passive: true }));
    window.addEventListener("mousemove", recordMouseMovement, { passive: true });
    document.addEventListener("visibilitychange", handleVisibilityChange);
    scheduleTimeout();

    return () => {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, recordActivity));
      window.removeEventListener("mousemove", recordMouseMovement);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled]);
}
