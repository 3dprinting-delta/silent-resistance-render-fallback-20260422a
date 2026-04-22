"use client";

import { useEffect, useState } from "react";
import styles from "./SCPNightwatch.module.css";
import { computePowerDrain } from "@/game/scpNightwatch/core/power";
import { useSCPNightwatchStore } from "@/game/scpNightwatch/core/store";

function formatClock(timeMinutes: number) {
  const hour24 = Math.floor(timeMinutes / 60);
  const minute = Math.floor(timeMinutes % 60);
  const hour12 = ((hour24 + 11) % 12) + 1;
  return `${String(hour12).padStart(2, "0")}:${String(minute).padStart(2, "0")} AM`;
}

export default function HUDPanel() {
  const power = useSCPNightwatchStore((state) => state.power);
  const timeMinutes = useSCPNightwatchStore((state) => state.timeMinutes);
  const currentNightLabel = useSCPNightwatchStore((state) => state.currentNightLabel);
  const incidentStage = useSCPNightwatchStore((state) => state.incidentStage);
  const lockdown = useSCPNightwatchStore((state) => state.lockdown);
  const emergencyMode = useSCPNightwatchStore((state) => state.emergencyMode);
  const cameraMonitorOpen = useSCPNightwatchStore((state) => state.cameraMonitorOpen);
  const entities = useSCPNightwatchStore((state) => state.entities);
  const doors = useSCPNightwatchStore((state) => state.doors);
  const lights = useSCPNightwatchStore((state) => state.lights);

  const nearbyThreat = Object.values(entities).some((entity) => entity.roomId.includes("Hall") || entity.roomId.includes("Door"));
  const drainRate = computePowerDrain({
    cameraMonitorOpen,
    doors,
    lights,
    lockdown,
    nearbyThreatPressure: nearbyThreat,
  });
  const usagePercent = Math.min(100, drainRate * 16.5);
  const [usagePulse, setUsagePulse] = useState(0);
  const [stateBlink, setStateBlink] = useState(false);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setUsagePulse(Math.random() * (nearbyThreat || emergencyMode ? 8 : 4));
      if ((nearbyThreat || emergencyMode) && Math.random() < 0.22) {
        setStateBlink(true);
        window.setTimeout(() => setStateBlink(false), 120);
      }
    }, 420);
    return () => window.clearInterval(interval);
  }, [emergencyMode, nearbyThreat]);

  const stageLabel =
    incidentStage === "nominal"
      ? "stable"
      : incidentStage === "sector-instability"
        ? "drift"
        : incidentStage === "multi-zone-event"
          ? "breach"
          : incidentStage === "response-degraded"
            ? "cut off"
            : "last window";

  const stateLabel = emergencyMode ? "FAILOVER" : nearbyThreat ? "CONTACT" : power < 25 ? "LOW" : "CLEAR";

  return (
    <aside className={`${styles.panel} ${styles.statusPanel} ${styles.hudGamePanel}`}>
      <div className={styles.hudPrimaryRow}>
        <div className={styles.hudPrimaryChip}>
          <span className={styles.statLabel}>night</span>
          <strong className={styles.hudPrimaryValue}>{currentNightLabel.replace("Night ", "N")}</strong>
        </div>
        <div className={styles.hudPrimaryChip}>
          <span className={styles.statLabel}>time</span>
          <strong className={styles.hudPrimaryValue}>{formatClock(timeMinutes)}</strong>
        </div>
      </div>

      <div className={styles.statusBlock}>
        <div className={styles.statusPanelHeader}>
          <span className={styles.statLabel}>power</span>
          <span className={`${styles.tag} ${emergencyMode || nearbyThreat ? styles.dangerTag : styles.infoTag} ${stateBlink ? styles.statusBlink : ""}`}>{stateLabel}</span>
        </div>
        <strong className={styles.statusValue}>{power.toFixed(0)}%</strong>
        <div className={styles.meter}>
          <div className={`${styles.meterFill} ${power < 25 ? styles.meterDanger : ""}`} style={{ width: `${Math.max(4, power)}%` }} />
        </div>
      </div>

      <div className={styles.statusBlock}>
        <span className={styles.statLabel}>usage</span>
        <strong className={styles.statusValue}>{drainRate.toFixed(2)}</strong>
        <div className={styles.meter}>
          <div className={`${styles.meterFill} ${usagePercent > 55 ? styles.meterDanger : ""} ${styles.meterLive}`} style={{ width: `${Math.max(6, Math.min(100, usagePercent + usagePulse))}%` }} />
        </div>
      </div>

      <div className={styles.statusChipRow}>
        <div className={styles.statusChipCompact}>
          <span className={styles.statLabel}>state</span>
          <strong>{stageLabel}</strong>
        </div>
        <div className={styles.statusChipCompact}>
          <span className={styles.statLabel}>view</span>
          <strong>{cameraMonitorOpen ? "monitor" : "office"}</strong>
        </div>
        <div className={styles.statusChipCompact}>
          <span className={styles.statLabel}>doors</span>
          <strong>{doors.left || doors.right ? "sealed" : "open"}</strong>
        </div>
        <div className={styles.statusChipCompact}>
          <span className={styles.statLabel}>lights</span>
          <strong>{lights.left || lights.right ? "lit" : "dark"}</strong>
        </div>
      </div>
    </aside>
  );
}
