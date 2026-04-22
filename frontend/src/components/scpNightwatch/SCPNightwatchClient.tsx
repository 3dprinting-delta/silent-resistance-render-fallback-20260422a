"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import ErrorBoundary from "@/components/ErrorBoundary";
import styles from "./SCPNightwatch.module.css";

const MountedShell = dynamic(() => import("@/components/scpNightwatch/SCPNightwatchShell"), {
  ssr: false,
  loading: () => (
    <div
      className={styles.root}
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top, rgba(159, 21, 21, 0.16), transparent 18%), linear-gradient(180deg, #051015 0%, #03080a 38%, #020405 100%)",
        color: "#dce4e2",
        fontFamily: '"IBM Plex Sans", "Segoe UI", sans-serif',
      }}
    >
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: 18,
        }}
      >
        <div
          style={{
            width: "min(960px, 100%)",
            minHeight: 540,
            border: "1px solid rgba(161, 196, 196, 0.14)",
            background:
              "linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0)), rgba(5, 17, 21, 0.82)",
            boxShadow: "0 28px 70px rgba(0, 0, 0, 0.34)",
            padding: 18,
            display: "grid",
            alignContent: "start",
            gap: 14,
          }}
        >
          <div style={{ fontSize: 10, letterSpacing: "0.34em", textTransform: "uppercase", color: "#89aaa5" }}>
            scp foundation / recovered archive
          </div>
          <div style={{ fontSize: 18, letterSpacing: "0.12em", textTransform: "uppercase", color: "#eff7f4" }}>
            Mounting Nightwatch Interface
          </div>
          <div style={{ fontSize: 12, color: "#99ada9", lineHeight: 1.8 }}>
            Preparing client runtime, surveillance controls, and incident playback.
          </div>
        </div>
      </div>
    </div>
  ),
});

export default function SCPNightwatchClient() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
    void import("@/components/scpNightwatch/SCPNightwatchShell").catch((error) => {
      console.error("Failed to preload Site-17 Nightwatch", error);
    });
  }, []);

  if (!ready) {
    return (
      <div
        className={styles.root}
        style={{
          minHeight: "100vh",
          background:
            "radial-gradient(circle at top, rgba(159, 21, 21, 0.16), transparent 18%), linear-gradient(180deg, #051015 0%, #03080a 38%, #020405 100%)",
          color: "#dce4e2",
          fontFamily: '"IBM Plex Sans", "Segoe UI", sans-serif',
        }}
      >
        <div
          style={{
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            padding: 18,
          }}
        >
          <div
            style={{
              width: "min(960px, 100%)",
              minHeight: 540,
              border: "1px solid rgba(161, 196, 196, 0.14)",
              background:
                "linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0)), rgba(5, 17, 21, 0.82)",
              boxShadow: "0 28px 70px rgba(0, 0, 0, 0.34)",
              padding: 18,
              display: "grid",
              alignContent: "start",
              gap: 14,
            }}
          >
            <div style={{ fontSize: 10, letterSpacing: "0.34em", textTransform: "uppercase", color: "#89aaa5" }}>
              scp foundation / recovered archive
            </div>
            <div style={{ fontSize: 18, letterSpacing: "0.12em", textTransform: "uppercase", color: "#eff7f4" }}>
              Mounting Nightwatch Interface
            </div>
            <div style={{ fontSize: 12, color: "#99ada9", lineHeight: 1.8 }}>
              Preparing client runtime, surveillance controls, and incident playback.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <MountedShell />
    </ErrorBoundary>
  );
}
