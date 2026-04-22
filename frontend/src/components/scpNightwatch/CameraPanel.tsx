"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./SCPNightwatch.module.css";
import { CAMERA_NODES, ROOM_LABELS, SCP_LABELS } from "@/game/scpNightwatch/data/content";
import { useCurrentCameraRoom, useSCPNightwatchStore } from "@/game/scpNightwatch/core/store";

type CameraPanelProps = {
  embedded?: boolean;
};

export default function CameraPanel({ embedded = false }: CameraPanelProps) {
  const selectedCamera = useSCPNightwatchStore((state) => state.selectedCamera);
  const selectCamera = useSCPNightwatchStore((state) => state.selectCamera);
  const entities = useSCPNightwatchStore((state) => state.entities);
  const toggleCameraMonitor = useSCPNightwatchStore((state) => state.toggleCameraMonitor);
  const emergencyMode = useSCPNightwatchStore((state) => state.emergencyMode);
  const timeMinutes = useSCPNightwatchStore((state) => state.timeMinutes);
  const monitorStallMs = useSCPNightwatchStore((state) => state.monitorStallMs);
  const falseNegativeMs = useSCPNightwatchStore((state) => state.falseNegativeMs);
  const timestampSkewMs = useSCPNightwatchStore((state) => state.timestampSkewMs);
  const phantomGlitchMs = useSCPNightwatchStore((state) => state.phantomGlitchMs);
  const systemInstability = useSCPNightwatchStore((state) => state.systemInstability);
  const paranoiaPressure = useSCPNightwatchStore((state) => state.paranoiaPressure);
  const unseenHintMs = useSCPNightwatchStore((state) => state.unseenHintMs);
  const unseenCameraId = useSCPNightwatchStore((state) => state.unseenCameraId);
  const metaHintMs = useSCPNightwatchStore((state) => state.metaHintMs);
  const metaTargetCameraId = useSCPNightwatchStore((state) => state.metaTargetCameraId);
  const metaSignalType = useSCPNightwatchStore((state) => state.metaSignalType);
  const behaviorPatternCameraId = useSCPNightwatchStore((state) => state.behaviorPatternCameraId);
  const currentRoom = useCurrentCameraRoom();
  const selected = CAMERA_NODES.find((camera) => camera.id === selectedCamera) ?? CAMERA_NODES[0];
  const finalHour = timeMinutes >= 240;
  const lastWindow = timeMinutes >= 300;
  const pendingRef = useRef<number[]>([]);
  const cameraChangeTimeoutRef = useRef<number | null>(null);
  const monitorLowerTimeoutRef = useRef<number | null>(null);
  const [feedPulse, setFeedPulse] = useState(0.96);
  const [feedNoise, setFeedNoise] = useState(0.18);
  const [glitchFlash, setGlitchFlash] = useState(false);
  const [switchFlash, setSwitchFlash] = useState(false);
  const visibleEntities = Object.values(entities).filter((entity) => entity.roomId === currentRoom);
  const feedEntities = falseNegativeMs > 0 ? visibleEntities.slice(1) : visibleEntities;
  const ghostCamera = phantomGlitchMs > 0 ? CAMERA_NODES.find((camera) => camera.id === selected.adjacency[0]) : null;
  const displayCameraId = phantomGlitchMs > 0 && ghostCamera ? ghostCamera.id : selected.id;
  const displayRoom = phantomGlitchMs > 0 && ghostCamera ? ROOM_LABELS[ghostCamera.roomId] : ROOM_LABELS[selected.roomId];
  const frameCounter = Math.floor((timeMinutes * 60 + paranoiaPressure * 137) * 14.2);
  const timestampLabel = useMemo(() => {
    const skewMinutes = timestampSkewMs > 0 ? 3 : 0;
    const adjustedTime = Math.max(0, timeMinutes - skewMinutes);
    const hour = Math.floor(adjustedTime / 60);
    const minute = Math.floor(adjustedTime % 60);
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String((minute * 11 + Math.floor(paranoiaPressure * 7)) % 60).padStart(2, "0")}`;
  }, [paranoiaPressure, timeMinutes, timestampSkewMs]);
  const feedDanger = selected.tier === "danger" || feedEntities.length > 0 || emergencyMode || finalHour;
  const feedTierClass = selected.tier === "danger" ? styles.feedTierDanger : selected.tier === "medium" ? styles.feedTierMedium : styles.feedTierSafe;
  const memoryGlitch = phantomGlitchMs > 0 || falseNegativeMs > 0 || (finalHour && monitorStallMs > 0);
  const metaWatching = metaHintMs > 0 && metaTargetCameraId === selectedCamera;
  const offscreenMetaHint = metaHintMs > 0 && metaTargetCameraId && metaTargetCameraId !== selectedCamera;
  const signalBars = emergencyMode ? 1 : feedDanger ? 2 : paranoiaPressure > 0.58 ? 3 : 4;
  const feedTitle = phantomGlitchMs > 0 && ghostCamera ? ghostCamera.name : selected.name;
  const feedSignalClass = emergencyMode
    ? styles.feedSignalDrop
    : monitorStallMs > 0
      ? styles.feedSignalHold
      : feedEntities.length > 0 || finalHour
        ? styles.feedSignalAlert
        : styles.feedSignalStable;

  useEffect(() => () => {
    pendingRef.current.forEach((timeout) => window.clearTimeout(timeout));
    pendingRef.current = [];
    cameraChangeTimeoutRef.current = null;
    monitorLowerTimeoutRef.current = null;
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const stress = Math.min(1, systemInstability * 0.7 + (feedDanger ? 0.18 : 0) + (finalHour ? 0.14 : 0));
      setFeedPulse(0.94 + Math.random() * 0.08 + stress * 0.04);
      setFeedNoise(0.14 + Math.random() * 0.08 + stress * 0.06);
      if (Math.random() < 0.035 + stress * 0.04) {
        setGlitchFlash(true);
        window.setTimeout(() => setGlitchFlash(false), 90);
      }
    }, 520);
    return () => window.clearInterval(interval);
  }, [feedDanger, finalHour, systemInstability]);

  const scheduleCameraChange = (cameraId: typeof selectedCamera) => {
    if (cameraChangeTimeoutRef.current) {
      window.clearTimeout(cameraChangeTimeoutRef.current);
      pendingRef.current = pendingRef.current.filter((timeout) => timeout !== cameraChangeTimeoutRef.current);
      cameraChangeTimeoutRef.current = null;
    }
    const delay = monitorStallMs > 0 ? Math.min(900, Math.max(480, monitorStallMs)) : systemInstability > 0.62 ? 120 : 0;
    setSwitchFlash(true);
    window.setTimeout(() => setSwitchFlash(false), Math.max(70, Math.min(150, delay || 90)));
    if (delay <= 0) {
      selectCamera(cameraId);
      return;
    }
    const timeout = window.setTimeout(() => {
      selectCamera(cameraId);
      pendingRef.current = pendingRef.current.filter((id) => id !== timeout);
      cameraChangeTimeoutRef.current = null;
    }, delay);
    pendingRef.current.push(timeout);
    cameraChangeTimeoutRef.current = timeout;
  };

  const lowerMonitor = () => {
    if (monitorLowerTimeoutRef.current) {
      window.clearTimeout(monitorLowerTimeoutRef.current);
      pendingRef.current = pendingRef.current.filter((timeout) => timeout !== monitorLowerTimeoutRef.current);
      monitorLowerTimeoutRef.current = null;
    }
    const delay = monitorStallMs > 0 ? Math.min(780, monitorStallMs) : 0;
    if (delay <= 0) {
      toggleCameraMonitor();
      return;
    }
    const timeout = window.setTimeout(() => {
      toggleCameraMonitor();
      pendingRef.current = pendingRef.current.filter((id) => id !== timeout);
      monitorLowerTimeoutRef.current = null;
    }, delay);
    pendingRef.current.push(timeout);
    monitorLowerTimeoutRef.current = timeout;
  };

  return (
    <div className={`${styles.cameraDeck} ${embedded ? styles.cameraDeckEmbedded : ""}`}>
      <aside className={`${styles.panel} ${styles.cameraGridPanel} ${embedded ? styles.cameraGridPanelEmbedded : ""}`}>
        <div className={styles.eyebrow}>cams</div>
        <div className={styles.cameraMiniGrid}>
          {CAMERA_NODES.map((camera, index) => (
            <button
              key={camera.id}
              className={`${styles.cameraMiniButton} ${camera.id === selectedCamera ? styles.cameraMiniButtonActive : ""} ${unseenHintMs > 0 && unseenCameraId === camera.id ? styles.cameraMiniButtonGhost : ""} ${offscreenMetaHint && metaTargetCameraId === camera.id ? styles.cameraMiniButtonMeta : ""} ${behaviorPatternCameraId === camera.id && !offscreenMetaHint ? styles.cameraMiniButtonPattern : ""}`}
              onClick={() => scheduleCameraChange(camera.id)}
            >
              {String(index + 1).padStart(2, "0")}
            </button>
          ))}
        </div>
      </aside>

      <section
        className={`${styles.feed} ${feedTierClass} ${feedDanger ? styles.feedDanger : ""} ${feedSignalClass} ${monitorStallMs > 0 ? styles.feedFrozen : ""} ${memoryGlitch ? styles.feedMemoryGlitch : ""} ${metaWatching ? styles.feedMetaAware : ""} ${glitchFlash ? styles.feedGlitchFlash : ""} ${switchFlash ? styles.feedSwitchFlash : ""}`}
        style={
          {
            "--feed-brightness": feedPulse.toFixed(3),
            "--feed-noise": feedNoise.toFixed(3),
          } as React.CSSProperties
        }
      >
        <div className={styles.glitch} />
        <div className={styles.feedNoiseLayer} />
        <div className={styles.feedScanLayer} />
        <div className={styles.feedDistortionBand} />
        <div className={styles.feedMetaTop}>
          <span>{displayCameraId}</span>
          <span>{timestampLabel}</span>
        </div>
        <div className={styles.feedMetaBottom}>
          <span>{displayRoom}</span>
          <span>{emergencyMode ? "FAIL" : lastWindow ? "ARCH" : feedDanger ? "ALRT" : "LIVE"}</span>
        </div>

        <div className={styles.feedHeader}>
          <div className={styles.feedTitleBlock}>
            <div className={styles.eyebrow}>cam</div>
            <div className={styles.feedHeroTitle}>{feedTitle}</div>
          </div>
          <button className={styles.button} onClick={lowerMonitor}>{embedded ? "Down" : "Lower"}</button>
        </div>

        <div className={styles.feedBodyLarge}>
          <div className={styles.feedCenterGhost}>
            <span className={styles.feedCenterLabel}>{displayCameraId}</span>
            <span className={styles.feedCenterSub}>{displayRoom}</span>
          </div>

          <div className={styles.feedHudStrip}>
            <span className={`${styles.tag} ${feedDanger ? styles.dangerTag : styles.infoTag}`}>{feedEntities.length ? "CONTACT" : "CLEAR"}</span>
            <span className={`${styles.tag} ${styles.infoTag}`}>F {String(frameCounter).padStart(6, "0")}</span>
            <span className={`${styles.tag} ${styles.infoTag}`}>SIG {Array.from({ length: 4 }, (_, index) => (index < signalBars ? "|" : ".")).join("")}</span>
            <span className={`${styles.tag} ${styles.infoTag}`}>{phantomGlitchMs > 0 ? "VINT-17" : monitorStallMs > 0 ? "BUF-04" : lastWindow ? "ARCH-12" : "OK-00"}</span>
          </div>

          <div className={styles.feedContactStrip}>
            {feedEntities.length ? (
              feedEntities.map((entity) => (
                <div key={entity.id} className={`${styles.feedAlertCard} ${styles.entityFeedCard}`}>
                  <strong>{SCP_LABELS[entity.id]}</strong>
                  <span>
                    {entity.id === "scp096"
                      ? "FACE"
                      : entity.id === "scp106"
                        ? "SMEAR"
                        : entity.id === "scp457"
                          ? "HEAT"
                          : "MOVE"}
                  </span>
                </div>
              ))
            ) : (
              <div className={styles.feedAlertCard}>
                <strong>{paranoiaPressure > 0.64 ? "UNCLEAR" : "NO CONTACT"}</strong>
                <span>{finalHour ? "WATCH" : "CLEAR"}</span>
              </div>
            )}
            {unseenHintMs > 0 && unseenCameraId !== selectedCamera ? (
              <div className={styles.feedAlertCard}>
                <strong>REMOTE</strong>
                <span>{unseenCameraId?.replace("CAM-", "")}</span>
              </div>
            ) : null}
            {metaWatching ? (
              <div className={`${styles.feedAlertCard} ${styles.metaFeedCard}`}>
                <strong>{metaSignalType === "watch" ? "DIRECT" : metaSignalType === "hold" ? "HOLD" : "ECHO"}</strong>
                <span>{displayCameraId.replace("CAM-", "")}</span>
              </div>
            ) : null}
            {offscreenMetaHint ? (
              <div className={`${styles.feedAlertCard} ${styles.metaFeedCard}`}>
                <strong>REVIEW</strong>
                <span>{metaTargetCameraId?.replace("CAM-", "")}</span>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
