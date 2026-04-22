"use client";

import styles from "./SCPNightwatch.module.css";
import { useSCPNightwatchStore } from "@/game/scpNightwatch/core/store";

export default function EndingOverlay() {
  const ending = useSCPNightwatchStore((state) => state.ending);
  const save = useSCPNightwatchStore((state) => state.save);
  const power = useSCPNightwatchStore((state) => state.power);
  const events = useSCPNightwatchStore((state) => state.events);
  const encounterFlags = useSCPNightwatchStore((state) => state.encounterFlags);
  const incidentStage = useSCPNightwatchStore((state) => state.incidentStage);
  const returnToMenu = useSCPNightwatchStore((state) => state.returnToMenu);
  const setViewMode = useSCPNightwatchStore((state) => state.setViewMode);
  const unresolvedCount = Number(encounterFlags.scp173) + Number(encounterFlags.scp096) + Number(encounterFlags.scp106) + Number(encounterFlags.scp457);
  const indexedRuns = Object.keys(save.bestClearRecords).length;

  if (!ending) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.endingCard}>
        <div className={styles.eyebrow}>incident outcome / {ending.nightLabel}</div>
        <div className={styles.title}>{ending.title}</div>
        <div className={styles.tagRow} style={{ marginTop: 12 }}>
          <span className={`${styles.tag} ${ending.survived ? styles.infoTag : styles.dangerTag}`}>{ending.classification}</span>
          <span className={`${styles.tag} ${ending.survived ? styles.infoTag : styles.dangerTag}`}>{ending.survived ? "operator retained" : "operator lost"}</span>
        </div>
        <p className={styles.muted} style={{ marginTop: 14 }}>{ending.body}</p>
        <div className={styles.debriefGrid}>
          <div className={styles.logCard}>
            <div className={styles.statLabel}>Reserve Remaining</div>
            <div className={styles.statValue}>{power.toFixed(1)}%</div>
          </div>
          <div className={styles.logCard}>
            <div className={styles.statLabel}>Archive Fragments</div>
            <div className={styles.statValue}>{save.unlockedLogs.length}</div>
          </div>
          <div className={styles.logCard}>
            <div className={styles.statLabel}>Outcomes Logged</div>
            <div className={styles.statValue}>{save.endingsSeen.length}</div>
          </div>
        </div>
        <div className={styles.tagRow} style={{ marginTop: 14 }}>
          <span className={`${styles.tag} ${ending.survived ? styles.infoTag : styles.dangerTag}`}>
            {ending.survived ? "shift retained" : "record severed"}
          </span>
          <span className={`${styles.tag} ${styles.infoTag}`}>review chain {indexedRuns}</span>
          <span className={`${styles.tag} ${unresolvedCount > 1 ? styles.dangerTag : styles.infoTag}`}>unresolved flags {unresolvedCount}</span>
        </div>
        <div className={styles.logCard} style={{ marginTop: 14 }}>
          <div className={styles.eyebrow}>shift report / recovered evidence packet</div>
          <p className={styles.muted}>
            Latest incident: {events[0] ? `${events[0].title}. ${events[0].body}` : "No surviving telemetry recovered from the shift."}
          </p>
          <p className={styles.muted} style={{ marginTop: 8 }}>
            Site condition: {incidentStage === "nominal"
              ? "Local containment held, broader site status remains under review."
              : incidentStage === "sector-instability"
                ? "Adjacent sectors remained unstable beyond the preserved watch interval."
                : incidentStage === "multi-zone-event"
                  ? "Multi-zone containment loss exceeded the operator corridor before archive closure."
                  : incidentStage === "response-degraded"
                    ? "Automated continuity outlasted reliable human response."
                    : "Recorder persisted after the session ceased to function as a live command surface."}
          </p>
          <p className={styles.muted} style={{ marginTop: 8 }}>
            Residual note: {encounterFlags.scp106 || encounterFlags.scp457
              ? "Recovery cameras continued registering motion after release authorization."
              : encounterFlags.scp096
                ? "Audio review suggests a second respiration source outside the recorded frame."
                : "Archive staff flagged one final timestamp mismatch after the shift ended."}
          </p>
          <p className={styles.muted} style={{ marginTop: 8 }}>
            Review continuity: {save.failures ? `${save.failures} prior casualty file(s) cross-referenced with this record.` : "No prior casualty file attached, but manual review tags remain present."}
          </p>
          <p className={styles.muted} style={{ marginTop: 8 }}>
            Archive notice: {ending.survived
              ? save.customNightUnlocked
                ? "Unauthorized replay parameters remain attached to this record. Additional review is possible."
                : "Further indexed sessions remain sealed, but this record has been retained for repeat review."
              : "Incident continuation exceeded what this terminal preserved. Supplemental footage remains unavailable."}
          </p>
        </div>
        <div className={styles.navRow} style={{ marginTop: 16 }}>
          {!ending.survived ? (
            <button className={styles.buttonSecondary} onClick={() => { setViewMode("menu"); returnToMenu(); }}>
              Review and Retry
            </button>
          ) : null}
          <button className={styles.button} onClick={() => { setViewMode("menu"); returnToMenu(); }}>
            Return to Archive Index
          </button>
        </div>
        <div className={styles.footerNote} style={{ marginTop: 14, textAlign: "center" }}>
          {ending.survived
            ? "Final archive discrepancy: terminal blackout occurred after the report timestamp."
            : "Final archive discrepancy: corridor telemetry continued after operator continuity ended."}
        </div>
      </div>
    </div>
  );
}
