"use client";

import { SessionProvider } from "next-auth/react";
import { SecurityLockOverlay } from "@/components/auth/SecurityLockOverlay";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <SecurityLockOverlay />
    </SessionProvider>
  );
}
