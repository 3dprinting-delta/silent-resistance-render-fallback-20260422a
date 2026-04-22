"use client";

import { ReactNode, useEffect, useRef } from "react";
import styles from "./SCPNightwatch.module.css";
import { SCP_LABELS } from "@/game/scpNightwatch/data/content";
import { computePowerDrain } from "@/game/scpNightwatch/core/power";
import { useSCPNightwatchStore } from "@/game/scpNightwatch/core/store";

const officeClassMap = {
  scp173: styles.entity173,
  scp096: styles.entity096,
  scp106: styles.entity106,
  scp457: styles.entity457,
};

type OfficePanelProps = {
  variant?: "display" | "controls";
  children?: ReactNode;
};

export default function OfficePanel({ variant = "display", children }: OfficePanelProps) {
  const entities = useSCPNightwatchStore((state) => state.entities);
  const doors = useSCPNightwatchStore((state) => state.doors);
  const lights = useSCPNightwatchStore((state) => state.lights);
  const lockdown = useSCPNightwatchStore((state) => state.lockdown);
  const toggleDoor = useSCPNightwatchStore((state) => state.toggleDoor);
  const setLight = useSCPNightwatchStore((state) => state.setLight);
  const toggleCameraMonitor = useSCPNightwatchStore((state) => state.toggleCameraMonitor);
  const setViewMode = useSCPNightwatchStore((state) => state.setViewMode);
  const triggerLockdown = useSCPNightwatchStore((state) => state.triggerLockdown);
  const emergencyMode = useSCPNightwatchStore((state) => state.emergencyMode);
  const power = useSCPNightwatchStore((state) => state.power);
  const cameraMonitorOpen = useSCPNightwatchStore((state) => state.cameraMonitorOpen);
  const controlLagMs = useSCPNightwatchStore((state) => state.controlLagMs);
  const systemInstability = useSCPNightwatchStore((state) => state.systemInstability);
  const silenceMs = useSCPNightwatchStore((state) => state.silenceMs);
  const paranoiaPressure = useSCPNightwatchStore((state) => state.paranoiaPressure);
  const doorIndicatorLagMs = useSCPNightwatchStore((state) => state.doorIndicatorLagMs);
  const events = useSCPNightwatchStore((state) => state.events);
  const timeMinutes = useSCPNightwatchStore((state) => state.timeMinutes);
  const incidentStage = useSCPNightwatchStore((state) => state.incidentStage);
  const pauseGame = useSCPNightwatchStore((state) => state.pauseGame);
  const pendingRef = useRef<number[]>([]);
  const pendingByKeyRef = useRef<Record<string, number>>({});
  const finalHour = timeMinutes >= 240;
  const lastWindow = timeMinutes >= 300;

  const leftThreat = Object.values(entities).find((entity) => entity.roomId === "westHall" || entity.roomId === "leftDoor");
  const rightThreat = Object.values(entities).find((entity) => entity.roomId === "eastHall" || entity.roomId === "rightDoor");
  const drainRate = computePowerDrain({
    cameraMonitorOpen,
    doors,
    lights,
    lockdown,
    nearbyThreatPressure: Boolean(leftThreat || rightThreat),
  });
  const recentEvent = events[0];
  const hallShudder = Boolean(recentEvent && /impact|voltage|respiration|auditory|motion/i.test(recentEvent.title));
  const tensionHold = silenceMs > 440 || hallShudder;
  const displayedLeftDoor = doorIndicatorLagMs > 0 && paranoiaPressure > 0.55 ? !doors.left : doors.left;
  const displayedRightDoor = doorIndicatorLagMs > 0 && paranoiaPressure > 0.55 ? !doors.right : doors.right;

  useEffect(() => () => {
    pendingRef.current.forEach((timeout) => window.clearTimeout(timeout));
    pendingRef.current = [];
    pendingByKeyRef.current = {};
  }, []);

  const queueAction = (key: string, action: () => void, extraDelay = 0) => {
    const delay = Math.min(260, controlLagMs + extraDelay);
    const existingTimeout = pendingByKeyRef.current[key];
    if (existingTimeout) {
      window.clearTimeout(existingTimeout);
      pendingRef.current = pendingRef.current.filter((timeout) => timeout !== existingTimeout);
      delete pendingByKeyRef.current[key];
    }
    if (delay <= 0) {
      action();
      return;
    }
    const timeout = window.setTimeout(() => {
      action();
      pendingRef.current = pendingRef.current.filter((id) => id !== timeout);
      delete pendingByKeyRef.current[key];
    }, delay);
    pendingRef.current.push(timeout);
    pendingByKeyRef.current[key] = timeout;
  };

  if (variant === "controls") {
    return (
      <aside className={`${styles.panel} ${styles.controlPanel}`}>
        <div className={styles.statusPanelHeader}>
          <span className={styles.eyebrow}>controls</span>
          <span className={`${styles.tag} ${lockdown.active ? styles.dangerTag : styles.infoTag}`}>{lockdown.active ? "LOCK" : "OPEN"}</span>
        </div>

        <div className={styles.controlGrid}>
          <button className={`${styles.button} ${displayedLeftDoor ? styles.buttonActive : ""}`} onClick={() => queueAction("door-left", () => toggleDoor("left"))}>
            <span className={styles.buttonText}>L Door</span>
            <span className={styles.buttonHint}>{displayedLeftDoor ? "closed" : "open"}</span>
          </button>
          <button
            className={`${styles.button} ${lights.left ? styles.buttonActive : ""}`}
            onMouseDown={() => queueAction("light-left", () => setLight("left", true), 20)}
            onMouseUp={() => queueAction("light-left", () => setLight("left", false), 20)}
            onMouseLeave={() => queueAction("light-left", () => setLight("left", false), 20)}
            onTouchStart={() => queueAction("light-left", () => setLight("left", true), 20)}
            onTouchEnd={() => queueAction("light-left", () => setLight("left", false), 20)}
          >
            <span className={styles.buttonText}>L Light</span>
            <span className={styles.buttonHint}>{lights.left ? "on" : "off"}</span>
          </button>
          <button className={`${styles.button} ${displayedRightDoor ? styles.buttonActive : ""}`} onClick={() => queueAction("door-right", () => toggleDoor("right"))}>
            <span className={styles.buttonText}>R Door</span>
            <span className={styles.buttonHint}>{displayedRightDoor ? "closed" : "open"}</span>
          </button>
          <button
            className={`${styles.button} ${lights.right ? styles.buttonActive : ""}`}
            onMouseDown={() => queueAction("light-right", () => setLight("right", true), 20)}
            onMouseUp={() => queueAction("light-right", () => setLight("right", false), 20)}
            onMouseLeave={() => queueAction("light-right", () => setLight("right", false), 20)}
            onTouchStart={() => queueAction("light-right", () => setLight("right", true), 20)}
            onTouchEnd={() => queueAction("light-right", () => setLight("right", false), 20)}
          >
            <span className={styles.buttonText}>R Light</span>
            <span className={styles.buttonHint}>{lights.right ? "on" : "off"}</span>
          </button>
          <button className={styles.button} onClick={() => queueAction("monitor-toggle", toggleCameraMonitor, 40)} disabled={emergencyMode}>
            <span className={styles.buttonText}>Monitor</span>
            <span className={styles.buttonHint}>{cameraMonitorOpen ? "up" : "down"}</span>
          </button>
          <button className={`${styles.button} ${styles.buttonDanger}`} onClick={() => queueAction("lockdown", triggerLockdown, 50)} disabled={lockdown.active || lockdown.cooldownMs > 0}>
            <span className={styles.buttonText}>Lock</span>
            <span className={styles.buttonHint}>{lockdown.active ? "live" : `${Math.max(0, lockdown.cooldownMs / 1000).toFixed(0)}s`}</span>
          </button>
          <button className={styles.buttonSecondary} onClick={() => setViewMode("database")}>
            <span className={styles.buttonText}>Files</span>
            <span className={styles.buttonHint}>open</span>
          </button>
          <button className={styles.buttonSecondary} onClick={() => { pauseGame(); setViewMode("menu"); }}>
            <span className={styles.buttonText}>Menu</span>
            <span className={styles.buttonHint}>pause</span>
          </button>
        </div>

        <div className={styles.controlMeta}>
          <span className={`${styles.tag} ${incidentStage === "nominal" ? styles.infoTag : styles.dangerTag}`}>{incidentStage.replaceAll("-", " ")}</span>
          <span className={`${styles.tag} ${power < 25 ? styles.dangerTag : styles.infoTag}`}>PWR {power.toFixed(0)}</span>
          <span className={`${styles.tag} ${Boolean(leftThreat || rightThreat) ? styles.dangerTag : styles.infoTag}`}>{leftThreat || rightThreat ? "CONTACT" : "CLEAR"}</span>
          <span className={`${styles.tag} ${styles.infoTag}`}>{drainRate.toFixed(2)}/S</span>
        </div>
      </aside>
    );
  }

  return (
    <section className={`${styles.officeDisplay} ${styles.officeNoise} ${systemInstability > 0.62 ? styles.officeUnsteady : ""} ${silenceMs > 0 ? styles.officeSilent : ""} ${tensionHold ? styles.officeTensionHold : ""}`}>
      <div className={styles.displayHeader}>
        <div className={styles.eyebrow}>room</div>
        <div className={styles.displayState}>{emergencyMode ? "FAILOVER" : lastWindow ? "LAST WINDOW" : finalHour ? "AFTER HOURS" : "LIVE WATCH"}</div>
      </div>
      <div className={styles.officeRoomLarge}>
        <div className={`${styles.doorFrame} ${styles.doorLeft} ${displayedLeftDoor ? styles.doorClosed : ""} ${hallShudder ? styles.doorShudder : ""}`} />
        <div className={`${styles.doorFrame} ${styles.doorRight} ${displayedRightDoor ? styles.doorClosed : ""} ${hallShudder ? styles.doorShudder : ""}`} />
        <div className={`${styles.hallGlow} ${styles.hallGlowLeft} ${lights.left ? styles.hallLightOn : ""}`} />
        <div className={`${styles.hallGlow} ${styles.hallGlowRight} ${lights.right ? styles.hallLightOn : ""}`} />
        <div className={styles.desk} />
        <div className={styles.monitorMount}>
          {children}
        </div>
        <div className={styles.roomCenterReadout}>
          <span className={styles.roomHugeLabel}>{emergencyMode ? "BLACKOUT" : "SECURITY OFFICE"}</span>
          <span className={styles.roomSmallLabel}>{leftThreat || rightThreat ? "APPROACH" : lastWindow ? "ISOLATED" : "HOLD WATCH"}</span>
        </div>
        {leftThreat && (
          <div className={`${styles.entityMarker} ${officeClassMap[leftThreat.id]}`}>
            <div className={styles.entityName}>{SCP_LABELS[leftThreat.id]}</div>
            <div className={styles.entityDetail}>left hall</div>
          </div>
        )}
        {rightThreat && (
          <div className={`${styles.entityMarker} ${officeClassMap[rightThreat.id]}`}>
            <div className={styles.entityName}>{SCP_LABELS[rightThreat.id]}</div>
            <div className={styles.entityDetail}>right hall</div>
          </div>
        )}
      </div>
      <div className={styles.displayFooter}>
        <span className={`${styles.tag} ${styles.infoTag}`}>USE {drainRate.toFixed(2)}</span>
        <span className={`${styles.tag} ${displayedLeftDoor || displayedRightDoor ? styles.dangerTag : styles.infoTag}`}>{displayedLeftDoor || displayedRightDoor ? "DOORS SEALED" : "DOORS OPEN"}</span>
        <span className={`${styles.tag} ${lights.left || lights.right ? styles.infoTag : styles.dangerTag}`}>{lights.left || lights.right ? "HALLS LIT" : "HALLS DARK"}</span>
      </div>
    </section>
  );
}
