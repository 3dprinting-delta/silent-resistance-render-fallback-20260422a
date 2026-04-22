"use client";

import { useEffect, useRef, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";

const LOCK_REASON_KEY = "silent-resistance-lock-reason";

function readReason() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.sessionStorage.getItem(LOCK_REASON_KEY);
}

function writeReason(reason: string | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (reason) {
    window.sessionStorage.setItem(LOCK_REASON_KEY, reason);
  } else {
    window.sessionStorage.removeItem(LOCK_REASON_KEY);
  }
}

export function SecurityLockOverlay() {
  const pathname = usePathname();
  const { status } = useSession();
  const [locked, setLocked] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const lockInFlightRef = useRef(false);
  const idleTimerRef = useRef<number | null>(null);

  const loginPath = pathname === "/login" || pathname?.startsWith("/deadzone");

  useEffect(() => {
    if (loginPath) {
      setLocked(false);
      setReason(null);
      writeReason(null);
      return;
    }

    if (status === "unauthenticated") {
      const storedReason = readReason();
      if (storedReason) {
        setLocked(true);
        setReason(storedReason);
      }
      return;
    }

    if (status === "authenticated") {
      setLocked(false);
      setReason(null);
      writeReason(null);
    }
  }, [loginPath, status]);

  useEffect(() => {
    if (loginPath || status !== "authenticated") {
      return;
    }

    async function triggerLock(nextReason: string) {
      if (lockInFlightRef.current) {
        return;
      }

      lockInFlightRef.current = true;
      writeReason(nextReason);
      setReason(nextReason);
      setLocked(true);

      try {
        await signOut({ redirect: false });
      } finally {
        lockInFlightRef.current = false;
      }
    }

    function clearIdleTimer() {
      if (idleTimerRef.current) {
        window.clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
    }

    function armIdleTimer() {
      clearIdleTimer();
      idleTimerRef.current = window.setTimeout(() => {
        void triggerLock("Idle for 5 seconds");
      }, 5000);
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        void triggerLock("Tab hidden or switched away");
      }
    }

    function handleWindowBlur() {
      void triggerLock("Window focus lost");
    }

    function handleActivity() {
      armIdleTimer();
    }

    window.addEventListener("blur", handleWindowBlur);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("mousemove", handleActivity);
    window.addEventListener("keydown", handleActivity);
    window.addEventListener("pointerdown", handleActivity);
    window.addEventListener("scroll", handleActivity, true);
    window.addEventListener("touchstart", handleActivity);
    armIdleTimer();

    return () => {
      clearIdleTimer();
      window.removeEventListener("blur", handleWindowBlur);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("pointerdown", handleActivity);
      window.removeEventListener("scroll", handleActivity, true);
      window.removeEventListener("touchstart", handleActivity);
    };
  }, [loginPath, status]);

  if (!locked || loginPath) {
    return null;
  }

  return (
    <div className="security-lock-shell" role="dialog" aria-modal="true" aria-label="Session locked">
      <div className="security-lock-mosaic" aria-hidden="true" />
      <div className="security-lock-blur" aria-hidden="true" />

      <div className="security-lock-panel panel-surface panel-hero">
        <p className="eyebrow">Session Locked</p>
        <h2 className="security-lock-title">Sign in again to continue</h2>
        <p className="security-lock-copy">
          This site locks and clears the session whenever the tab or window loses focus. The page stays frozen and obscured
          until authentication succeeds again.
        </p>
        {reason ? <p className="security-lock-reason">Lock trigger: {reason}</p> : null}
        <LoginForm
          nextPath={pathname || "/"}
          submitLabel="Unlock portal"
          onSuccess={() => {
            setLocked(false);
            setReason(null);
            writeReason(null);
          }}
        />
      </div>
    </div>
  );
}
