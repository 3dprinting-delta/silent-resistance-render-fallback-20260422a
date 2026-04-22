"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import styles from "./RagdollArchers.module.css";
import ErrorBoundary from "@/components/ErrorBoundary";

const MountedRagdollArchersApp = dynamic(
  () => import("@/components/ragdollArchers/RagdollArchersMountedApp"),
  {
    ssr: false,
    loading: () => <div className={styles.viewportPanel} style={{ padding: 16 }}>Loading game...</div>,
  },
);

export default function RagdollArchersClient() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    if (typeof window === "undefined") return;
    void import("@/components/ragdollArchers/RagdollArchersMountedApp").catch((error) => {
      console.error("SUBSYSTEM ERROR", error);
    });
  }, []);

  if (!isClient) {
    return <div className={styles.viewportPanel} style={{ padding: 16 }}>Loading game...</div>;
  }

  try {
    return (
      <ErrorBoundary>
        <MountedRagdollArchersApp />
      </ErrorBoundary>
    );
  } catch (error) {
    console.error("SUBSYSTEM ERROR", error);
    return <div style={{ color: "red", padding: 20 }}>Game failed to load</div>;
  }
}
