"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./SCPNightwatch.module.css";
import CameraPanel from "@/components/scpNightwatch/ui/CameraPanel";
import DatabasePanel from "@/components/scpNightwatch/ui/DatabasePanel";
import EndingOverlay from "@/components/scpNightwatch/ui/EndingOverlay";
import HUDPanel from "@/components/scpNightwatch/ui/HUDPanel";
import OfficePanel from "@/components/scpNightwatch/ui/OfficePanel";
import TitleScreen from "@/components/scpNightwatch/ui/TitleScreen";
import { INCIDENT_STAGE_LABELS, SCP_LABELS } from "@/game/scpNightwatch/data/content";
import { nightwatchAudio } from "@/game/scpNightwatch/core/audio";
import { useSCPNightwatchStore } from "@/game/scpNightwatch/core/store";

export default function SCPNightwatchShell() {
  const hydrate = useSCPNightwatchStore((state) => state.hydrate);
  const bootstrapped = useSCPNightwatchStore((state) => state.bootstrapped);
  const viewMode = useSCPNightwatchStore((state) => state.viewMode);
  const phase = useSCPNightwatchStore((state) => state.phase);
  const tick = useSCPNightwatchStore((state) => state.tick);
  const pauseGame = useSCPNightwatchStore((state) => state.pauseGame);
  const resumeGame = useSCPNightwatchStore((state) => state.resumeGame);
  const jumpscareEntity = useSCPNightwatchStore((state) => state.jumpscareEntity);
  const emergencyMode = useSCPNightwatchStore((state) => state.emergencyMode);
  const events = useSCPNightwatchStore((state) => state.events);
  const doors = useSCPNightwatchStore((state) => state.doors);
  const lights = useSCPNightwatchStore((state) => state.lights);
  const cameraMonitorOpen = useSCPNightwatchStore((state) => state.cameraMonitorOpen);
  const power = useSCPNightwatchStore((state) => state.power);
  const entities = useSCPNightwatchStore((state) => state.entities);
  const silenceMs = useSCPNightwatchStore((state) => state.silenceMs);
  const systemInstability = useSCPNightwatchStore((state) => state.systemInstability);
  const monitorStallMs = useSCPNightwatchStore((state) => state.monitorStallMs);
  const jumpscareTimerMs = useSCPNightwatchStore((state) => state.jumpscareTimerMs);
  const incidentStage = useSCPNightwatchStore((state) => state.incidentStage);
  const currentNightLabel = useSCPNightwatchStore((state) => state.currentNightLabel);
  const callLines = useSCPNightwatchStore((state) => state.callLines);
  const timeMinutes = useSCPNightwatchStore((state) => state.timeMinutes);
  const ending = useSCPNightwatchStore((state) => state.ending);
  const save = useSCPNightwatchStore((state) => state.save);
  const unseenSignalToken = useSCPNightwatchStore((state) => state.unseenSignalToken);
  const unseenSignalType = useSCPNightwatchStore((state) => state.unseenSignalType);
  const metaSignalToken = useSCPNightwatchStore((state) => state.metaSignalToken);
  const metaSignalType = useSCPNightwatchStore((state) => state.metaSignalType);

  const frameRef = useRef<number | null>(null);
  const previousRef = useRef<number>(0);
  const lastEventRef = useRef<string>("");
  const lastPowerRef = useRef<number>(100);
  const lastDoorRef = useRef<string>("false-false");
  const lastLightRef = useRef<string>("false-false");
  const lastMonitorRef = useRef(false);
  const cueTimeoutsRef = useRef<number[]>([]);
  const sessionIdRef = useRef("S17-001-100000");
  const operatorIdRef = useRef("D-9341");
  const archiveTagRef = useRef("ARC-0000");
  const introTimerRef = useRef<number[]>([]);
  const lastPhaseRef = useRef(phase);
  const [introVisible, setIntroVisible] = useState(false);
  const [introStep, setIntroStep] = useState(0);
  const [clockPulse, setClockPulse] = useState(false);
  const lastEndingIdRef = useRef<string>("");
  const lastUnseenSignalRef = useRef(0);
  const lastMetaSignalRef = useRef(0);
  const clearQueuedCues = () => {
    cueTimeoutsRef.current.forEach((timeout) => window.clearTimeout(timeout));
    cueTimeoutsRef.current = [];
  };

  const queueCue = (name: "camera" | "door" | "light" | "alarm" | "footstep" | "breathing" | "impact" | "powerdown" | "static" | "metal" | "echo", delayMs = 0) => {
    if (delayMs <= 0) {
      nightwatchAudio.playCue(name);
      return;
    }
    const timeout = window.setTimeout(() => {
      nightwatchAudio.playCue(name);
      cueTimeoutsRef.current = cueTimeoutsRef.current.filter((id) => id !== timeout);
    }, delayMs);
    cueTimeoutsRef.current.push(timeout);
  };

  useEffect(() => {
    const interval = window.setInterval(() => {
      setClockPulse((value) => !value);
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!bootstrapped) return;
    sessionIdRef.current = save.lastSessionId;
    operatorIdRef.current = save.priorOperators[0] ?? "D-9341";
    archiveTagRef.current = save.archiveTag;
  }, [bootstrapped, save.archiveTag, save.lastSessionId, save.priorOperators]);

  useEffect(() => {
    if (!bootstrapped) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "c") {
        nightwatchAudio.ensureReady();
      }
      if (event.key === "Escape") {
        if (phase === "running") {
          pauseGame();
          useSCPNightwatchStore.getState().setViewMode("menu");
        } else if (phase === "paused") {
          useSCPNightwatchStore.getState().setViewMode("office");
          resumeGame();
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [bootstrapped, pauseGame, phase, resumeGame]);

  useEffect(() => () => {
    clearQueuedCues();
    introTimerRef.current.forEach((timeout) => window.clearTimeout(timeout));
    introTimerRef.current = [];
    nightwatchAudio.resetSessionAudio(true);
  }, []);

  useEffect(() => {
    if (!bootstrapped) return;
    if (phase === "menu") {
      introTimerRef.current.forEach((timeout) => window.clearTimeout(timeout));
      introTimerRef.current = [];
      setIntroVisible(false);
      setIntroStep(0);
      lastEndingIdRef.current = "";
      clearQueuedCues();
      nightwatchAudio.resetSessionAudio();
      return;
    }
    if (phase === "running" && timeMinutes === 0) {
      clearQueuedCues();
      nightwatchAudio.resetSessionAudio();
      lastEndingIdRef.current = "";
    }
    if (phase !== "ending") {
      lastEndingIdRef.current = "";
    }
  }, [bootstrapped, phase, timeMinutes]);

  useEffect(() => {
    if (!bootstrapped) return;
    const wasRunning = lastPhaseRef.current === "running";
    const nowRunning = phase === "running";
    lastPhaseRef.current = phase;
    if (!nowRunning || wasRunning) return;

    clearQueuedCues();
    nightwatchAudio.resetSessionAudio();
    introTimerRef.current.forEach((timeout) => window.clearTimeout(timeout));
    introTimerRef.current = [];
    setIntroVisible(true);
    setIntroStep(0);
    const stagedTimeouts = [450, 1050, 1850, 2900, 4300].map((delay, index) =>
      window.setTimeout(() => {
        if (index === 4) {
          setIntroVisible(false);
          setIntroStep(3);
          return;
        }
        setIntroStep(index + 1);
      }, delay),
    );
    introTimerRef.current = stagedTimeouts;
    queueCue("camera", 140);
    queueCue("alarm", 1180);
  }, [bootstrapped, phase]);

  useEffect(() => {
    if (!bootstrapped) return;
    let mounted = true;
    const loop = (now: number) => {
      if (!mounted) return;
      if (!previousRef.current) previousRef.current = now;
      const delta = Math.min(100, now - previousRef.current);
      previousRef.current = now;
      tick(delta);
      frameRef.current = window.requestAnimationFrame(loop);
    };
    frameRef.current = window.requestAnimationFrame(loop);
    return () => {
      mounted = false;
      if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      previousRef.current = 0;
    };
  }, [bootstrapped, tick]);

  useEffect(() => {
    if (!bootstrapped) return;
    nightwatchAudio.setEmergencyMode(emergencyMode);
    if (power <= 0 && lastPowerRef.current > 0) {
      nightwatchAudio.playCue("powerdown");
    }
    lastPowerRef.current = power;
  }, [bootstrapped, emergencyMode, power]);

  useEffect(() => {
    if (!bootstrapped) return;
    const proximityWeight = Object.values(entities).reduce((highest, entity) => {
      const nextWeight =
        entity.roomId === "leftDoor" || entity.roomId === "rightDoor"
          ? 1
          : entity.roomId === "westHall" || entity.roomId === "eastHall"
            ? 0.72
            : entity.id === "scp096" && entity.rage > 40
              ? 0.55
              : entity.id === "scp457" && entity.manifesting
                ? 0.48
                : 0.22;
      return Math.max(highest, nextWeight);
    }, 0);
    const powerWeight = power < 20 ? 0.15 : power < 40 ? 0.08 : 0;
    const threatLevel = Math.max(proximityWeight, emergencyMode ? 0.95 : proximityWeight + powerWeight);
    nightwatchAudio.setThreatLevel(threatLevel);
  }, [bootstrapped, emergencyMode, entities, power]);

  useEffect(() => {
    if (!bootstrapped) return;
    nightwatchAudio.setSilence(silenceMs > 0);
  }, [bootstrapped, silenceMs]);

  useEffect(() => {
    if (!bootstrapped) return;
    const doorSignature = `${doors.left}-${doors.right}`;
    if (doorSignature !== lastDoorRef.current && phase === "running") {
      queueCue("door", systemInstability > 0.64 ? 80 : 0);
      lastDoorRef.current = doorSignature;
    }
    const lightSignature = `${lights.left}-${lights.right}`;
    if (lightSignature !== lastLightRef.current && phase === "running") {
      queueCue("light", systemInstability > 0.72 ? 60 : 0);
      lastLightRef.current = lightSignature;
    }
    if (cameraMonitorOpen !== lastMonitorRef.current && phase === "running") {
      queueCue("camera", monitorStallMs > 0 ? Math.min(180, monitorStallMs * 0.35) : 0);
      lastMonitorRef.current = cameraMonitorOpen;
    }
  }, [bootstrapped, cameraMonitorOpen, doors.left, doors.right, lights.left, lights.right, monitorStallMs, phase, systemInstability]);

  useEffect(() => {
    if (!bootstrapped || !events.length) return;
    if (events[0].id === lastEventRef.current) return;
    lastEventRef.current = events[0].id;
    if (events[0].tone === "danger") {
      const alarmDelay = silenceMs > 0 ? Math.min(520, Math.max(220, silenceMs * 0.42)) : systemInstability > 0.6 ? 120 : 0;
      queueCue("alarm", alarmDelay);
    }
    if (/impact|motion|auditory|thermal|corrosion|voltage/i.test(events[0].title)) queueCue("footstep", systemInstability > 0.58 ? 140 : 0);
    if (/facial|emergency|lockdown hold|respiration|dead air/i.test(events[0].title)) queueCue("breathing", systemInstability > 0.52 ? 90 : 0);
    if (/sector|response|archive continuity|relay/i.test(events[0].title)) queueCue("alarm", 180);
  }, [bootstrapped, events, silenceMs, systemInstability]);

  useEffect(() => {
    if (!bootstrapped || !jumpscareEntity) return;
    nightwatchAudio.setSilence(true);
    queueCue("impact", 140);
    queueCue("alarm", 640);
    queueCue("breathing", 980);
  }, [bootstrapped, jumpscareEntity]);

  useEffect(() => {
    if (!bootstrapped || phase !== "ending" || !ending) return;
    if (lastEndingIdRef.current === ending.id) return;
    lastEndingIdRef.current = ending.id;
    nightwatchAudio.setSilence(true);
    if (ending.survived) {
      queueCue("breathing", 260);
      queueCue("camera", 780);
    } else {
      queueCue("alarm", 320);
      queueCue("breathing", 860);
    }
  }, [bootstrapped, ending, phase]);

  useEffect(() => {
    if (!bootstrapped || phase !== "running") return;
    if (!unseenSignalToken || unseenSignalToken === lastUnseenSignalRef.current) return;
    lastUnseenSignalRef.current = unseenSignalToken;
    if (unseenSignalType === "static") {
      queueCue("static", 60);
    } else if (unseenSignalType === "metal") {
      queueCue("metal", 110);
    } else {
      queueCue("footstep", 140);
    }
  }, [bootstrapped, phase, unseenSignalToken, unseenSignalType]);

  useEffect(() => {
    if (!bootstrapped || phase !== "running") return;
    if (!metaSignalToken || metaSignalToken === lastMetaSignalRef.current) return;
    lastMetaSignalRef.current = metaSignalToken;
    const delay = 220 + Math.random() * 340;
    if (metaSignalType === "watch") {
      queueCue("breathing", delay);
    } else if (metaSignalType === "hold") {
      queueCue("camera", delay);
      queueCue("static", delay + 70);
    } else {
      queueCue("echo", delay);
    }
  }, [bootstrapped, metaSignalToken, metaSignalType, phase]);

  const finalHour = timeMinutes >= 240;
  const lastWindow = timeMinutes >= 300;
  const firstMinute = timeMinutes <= 60;
  const memoryFocus = silenceMs > 440 || (events[0]?.tone === "danger" && systemInstability > 0.54);
  const introLines = useMemo(
    () => [
      `${currentNightLabel} / LIVE WATCH`,
      `${save.carryoverTitles[0] ?? "SESSION 14 PARTIAL RECOVERY"} / ${archiveTagRef.current}`,
      ...callLines.slice(0, 3),
    ],
    [callLines, currentNightLabel, save.carryoverTitles],
  );
  const displayTime = `${String((((Math.floor(timeMinutes / 60) + 11) % 12) + 1)).padStart(2, "0")}:${String(Math.floor(timeMinutes % 60)).padStart(2, "0")} AM`;
  const showMonitor = phase === "running" && cameraMonitorOpen && viewMode !== "database";

  return (
    <div
      className={`${styles.root} ${systemInstability > 0.64 ? styles.rootUnstable : ""} ${silenceMs > 0 ? styles.rootSilent : ""} ${finalHour ? styles.rootFinalHour : ""} ${lastWindow ? styles.rootLastWindow : ""} ${memoryFocus ? styles.rootMemoryFocus : ""}`}
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top, rgba(159, 21, 21, 0.16), transparent 18%), linear-gradient(180deg, #051015 0%, #03080a 38%, #020405 100%)",
        color: "#dce4e2",
        fontFamily: '"IBM Plex Sans", "Segoe UI", sans-serif',
      }}
    >
      <div className={styles.shell}>
        <header className={`${styles.topbar} ${finalHour ? styles.topbarCritical : ""} ${firstMinute && phase === "running" ? styles.topbarFirstMinute : ""} ${clockPulse ? styles.topbarLive : ""}`}>
          <div className={styles.topbarMark}>SITE-17</div>
          <div className={styles.topbarReadout}>
            <span className={`${styles.recDot} ${lastWindow ? styles.recDotHot : ""}`} />
            <span>{!bootstrapped ? "SYNC" : "REC"}</span>
            <span>{INCIDENT_STAGE_LABELS[incidentStage]}</span>
            <span>{archiveTagRef.current}</span>
          </div>
          <div className={`${styles.topbarClock} ${clockPulse ? styles.topbarClockLive : ""}`}>
            <span>{phase === "menu" ? "00:00 AM" : displayTime}</span>
            <span className={styles.topbarSubtle}>{sessionIdRef.current}</span>
          </div>
        </header>
        {phase === "menu" ? (
          <TitleScreen />
        ) : (
          <main className={`${styles.operationsLayout} ${memoryFocus ? styles.contentMemoryFocus : ""}`}>
            <section className={`${styles.panel} ${styles.mainViewport} ${styles.officeViewport}`}>
              <OfficePanel variant="display">
                {showMonitor ? (
                  <div className={styles.officeMonitorWrap}>
                    <CameraPanel embedded />
                  </div>
                ) : (
                  <div className={styles.monitorSleep}>
                    <span className={styles.monitorSleepLabel}>{emergencyMode ? "BLACKOUT" : "CAMERA DOWN"}</span>
                    <span className={styles.monitorSleepSub}>{emergencyMode ? "POWER LOST" : "PRESS MONITOR"}</span>
                  </div>
                )}
              </OfficePanel>
              {viewMode === "database" && (
                <div className={styles.databaseOverlay}>
                  <DatabasePanel />
                </div>
              )}
            </section>
            <section className={styles.bottomStrip}>
              <HUDPanel />
              <OfficePanel variant="controls" />
            </section>
          </main>
        )}
      </div>

      {phase === "jumpscare" && (
        <div className={styles.overlay}>
          <div
            className={styles.jumpscare}
            style={{
              opacity: 0.42 + (1 - jumpscareTimerMs / 2200) * 0.58,
              filter: `blur(${Math.max(0, jumpscareTimerMs / 700 - 0.6).toFixed(2)}px)`,
            }}
          >
            <div className={styles.eyebrow}>containment failure</div>
            <div className={styles.title}>Operator Record Terminated</div>
            <div className={styles.footerNote} style={{ marginTop: 10 }}>
              final contact: {jumpscareEntity ? SCP_LABELS[jumpscareEntity] : "unresolved subject"} / telemetry collapsing / operator response absent
            </div>
            <div className={styles.footerNote} style={{ marginTop: 8 }}>
              recorder remained active after visual continuity failed
            </div>
            <div className={styles.footerNote} style={{ marginTop: 8 }}>
              archive closure delayed by residual corridor motion
            </div>
          </div>
        </div>
      )}
      {phase === "running" && introVisible && (
        <div className={styles.sessionOverlay}>
          <div className={styles.sessionConsole}>
            <div className={styles.sectionHeader}>
              <div>
                <div className={styles.eyebrow}>site-17 recovered playback / operator relay bootstrap</div>
                <div className={styles.title}>Shift Link Rising</div>
              </div>
              <div className={styles.footerNote}>session {sessionIdRef.current} / operator {operatorIdRef.current} / {archiveTagRef.current}</div>
            </div>
            <div className={styles.systemBanner} style={{ marginTop: 14 }}>
              <span className={styles.statusPulse} />
              <strong>{lastWindow ? "last window unstable" : "monitor bus hot"}</strong>
            </div>
            <div className={styles.sessionProgress}>
              {introLines.map((line, index) => (
                <div
                  key={`${index}-${line}`}
                  className={`${styles.sessionLine} ${index < introStep ? styles.sessionLineVisible : ""}`}
                >
                  {line}
                </div>
              ))}
            </div>
            <div className={styles.footerNote} style={{ marginTop: 12 }}>
              {finalHour ? "late shift / site unstable" : "night shift / live corridor watch"}
            </div>
            <div className={styles.footerNote} style={{ marginTop: 6 }}>
              {save.archiveNotes[0] ?? "Recovered chain of custody remains incomplete."}
            </div>
          </div>
        </div>
      )}
      {!bootstrapped && (
        <div className={styles.sessionOverlay}>
          <div className={styles.sessionConsole}>
            <div className={styles.sectionHeader}>
              <div>
                <div className={styles.eyebrow}>site-17 recovered playback / operator relay bootstrap</div>
                <div className={styles.title}>Restoring Watch Surface</div>
              </div>
              <div className={styles.footerNote}>session {sessionIdRef.current} / archive resync / {archiveTagRef.current}</div>
            </div>
            <div className={styles.systemBanner} style={{ marginTop: 14 }}>
              <span className={styles.statusPulse} />
              <strong>display hot / archive sync pending</strong>
            </div>
            <div className={styles.sessionProgress}>
              <div className={`${styles.sessionLine} ${styles.sessionLineVisible}`}>Display shell mounted.</div>
              <div className={`${styles.sessionLine} ${styles.sessionLineVisible}`}>Archive residue restored.</div>
              <div className={`${styles.sessionLine} ${styles.sessionLineVisible}`}>{save.carryoverTitles[0] ?? "SESSION 14 PARTIAL RECOVERY"} queued before controls reopen.</div>
            </div>
          </div>
        </div>
      )}
      {phase === "ending" && <EndingOverlay />}
    </div>
  );
}
