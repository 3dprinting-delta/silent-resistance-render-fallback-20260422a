"use client";

import { useEffect, useState } from "react";
import styles from "./SCPNightwatch.module.css";
import { LOG_ENTRIES, NIGHT_PRESETS, SCP_LABELS } from "@/game/scpNightwatch/data/content";
import { nightwatchAudio } from "@/game/scpNightwatch/core/audio";
import { useSCPNightwatchStore } from "@/game/scpNightwatch/core/store";
import { EntityId } from "@/game/scpNightwatch/core/types";

export default function TitleScreen() {
  const save = useSCPNightwatchStore((state) => state.save);
  const activeTab = useSCPNightwatchStore((state) => state.activeTab);
  const setActiveTab = useSCPNightwatchStore((state) => state.setActiveTab);
  const startNight = useSCPNightwatchStore((state) => state.startNight);
  const startCustomNight = useSCPNightwatchStore((state) => state.startCustomNight);
  const resetProgress = useSCPNightwatchStore((state) => state.resetProgress);
  const [entryGlitch, setEntryGlitch] = useState(false);
  const nextNightId = [...save.unlockedNights].sort((a, b) => b - a)[0] ?? 1;

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (Math.random() < 0.28) {
        setEntryGlitch(true);
        window.setTimeout(() => setEntryGlitch(false), 70);
      }
    }, 2800);
    return () => window.clearInterval(interval);
  }, []);

  const launchNight = (nightId: number) => {
    nightwatchAudio.ensureReady();
    startNight(nightId);
  };

  const launchCustomNight = () => {
    nightwatchAudio.ensureReady();
    startCustomNight(save.customNightConfig);
  };

  return (
    <div className={`${styles.viewport} ${styles.gameMenuViewport}`}>
      <div className={`${styles.panel} ${styles.gameMenuCard} ${entryGlitch ? styles.entryGateGlitch : ""}`}>
        <div className={styles.gameMenuBackdrop} />
        <div className={styles.gameMenuCenter}>
          <div className={styles.gameMenuLabel}>site-17 containment watch</div>
          <div className={styles.gameMenuTitle}>SCP NIGHTWATCH</div>
          <div className={styles.gameMenuSubtitle}>SURVIVE UNTIL 06:00</div>

          <div className={styles.gameMenuActions}>
            <button className={`${styles.button} ${styles.gameMenuPrimary}`} onClick={() => launchNight(nextNightId)}>
              <span className={styles.buttonText}>START SHIFT</span>
              <span className={styles.buttonHint}>{NIGHT_PRESETS.find((night) => night.id === nextNightId)?.label ?? "NIGHT 1"}</span>
            </button>
            <button className={`${styles.buttonSecondary} ${styles.gameMenuSecondary}`} onClick={() => setActiveTab("overview")}>
              <span className={styles.buttonText}>CONTINUE</span>
              <span className={styles.buttonHint}>{save.unlockedNights.length}/5 OPEN</span>
            </button>
            <button className={`${styles.buttonSecondary} ${styles.gameMenuSecondary}`} onClick={() => setActiveTab("custom")}>
              <span className={styles.buttonText}>CUSTOM NIGHT</span>
              <span className={styles.buttonHint}>{save.customNightUnlocked ? "UNLOCKED" : "SEALED"}</span>
            </button>
            <button className={`${styles.buttonSecondary} ${styles.gameMenuSecondary}`} onClick={() => setActiveTab("database")}>
              <span className={styles.buttonText}>DOSSIER</span>
              <span className={styles.buttonHint}>{save.unlockedLogs.length}/{LOG_ENTRIES.length}</span>
            </button>
          </div>
        </div>

        <div className={styles.gameMenuFooter}>
          <span className={`${styles.tag} ${styles.infoTag}`}>POWER LIMITED</span>
          <span className={`${styles.tag} ${styles.dangerTag}`}>LOSS {save.failures}</span>
          <span className={`${styles.tag} ${styles.infoTag}`}>{save.archiveTag}</span>
        </div>
      </div>

      {activeTab === "overview" && (
        <div className={`${styles.gameMenuDrawer} ${styles.gameMenuDrawerWide}`}>
          {NIGHT_PRESETS.map((night) => {
            const unlocked = save.unlockedNights.includes(night.id);
            return (
              <div key={night.id} className={styles.gameMenuDrawerCard}>
                <div className={styles.gameMenuDrawerHeader}>
                  <strong>{night.label}</strong>
                  <span className={`${styles.tag} ${unlocked ? styles.infoTag : styles.dangerTag}`}>{unlocked ? "OPEN" : "SEALED"}</span>
                </div>
                <div className={styles.gameMenuThreatRow}>
                  <span>173 {night.aggressions.scp173}</span>
                  <span>096 {night.aggressions.scp096}</span>
                  <span>106 {night.aggressions.scp106}</span>
                  <span>457 {night.aggressions.scp457}</span>
                </div>
                <button className={styles.button} onClick={() => launchNight(night.id)} disabled={!unlocked}>
                  <span className={styles.buttonText}>LOAD</span>
                  <span className={styles.buttonHint}>{unlocked ? "PLAY" : "LOCKED"}</span>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === "database" && (
        <div className={styles.gameMenuDrawer}>
          {LOG_ENTRIES.map((entry) => {
            const unlocked = save.unlockedLogs.includes(entry.id);
            return (
              <div key={entry.id} className={styles.gameMenuDrawerCard}>
                <div className={styles.gameMenuDrawerHeader}>
                  <strong>{unlocked ? entry.title : "[REDACTED]"}</strong>
                  <span className={`${styles.tag} ${styles.infoTag}`}>{entry.clearance}</span>
                </div>
                <div className={styles.gameMenuMicroCopy}>{unlocked ? entry.body.split(".")[0] : "FILE INCOMPLETE"}</div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === "custom" && (
        <div className={styles.gameMenuDrawer}>
          {Object.entries(save.customNightConfig).map(([entityId, value]) => (
            <label key={entityId} className={styles.gameMenuDrawerCard}>
              <div className={styles.gameMenuDrawerHeader}>
                <strong>{SCP_LABELS[entityId as EntityId]}</strong>
                <span className={`${styles.tag} ${styles.infoTag}`}>AI {value}</span>
              </div>
              <input
                type="range"
                min={0}
                max={20}
                value={value}
                disabled={!save.customNightUnlocked}
                onChange={(event) => useSCPNightwatchStore.getState().updateCustomNightValue(entityId as EntityId, Number(event.target.value))}
              />
            </label>
          ))}
          <div className={styles.gameMenuDrawerCard}>
            <button className={styles.button} onClick={launchCustomNight} disabled={!save.customNightUnlocked}>
              <span className={styles.buttonText}>START CUSTOM</span>
              <span className={styles.buttonHint}>{save.customNightUnlocked ? "READY" : "LOCKED"}</span>
            </button>
          </div>
        </div>
      )}

      {activeTab === "help" && (
        <div className={styles.gameMenuDrawer}>
          <div className={styles.gameMenuDrawerCard}>
            <div className={styles.gameMenuMicroCopy}>173: KEEP WATCH</div>
            <div className={styles.gameMenuMicroCopy}>096: DO NOT STARE</div>
            <div className={styles.gameMenuMicroCopy}>106: SAVE LOCKDOWN</div>
            <div className={styles.gameMenuMicroCopy}>457: FEARS DARK GRID</div>
          </div>
          <div className={styles.gameMenuDrawerCard}>
            <button className={`${styles.button} ${styles.buttonDanger}`} onClick={resetProgress}>
              <span className={styles.buttonText}>RESET</span>
              <span className={styles.buttonHint}>CLEAR SAVE</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
