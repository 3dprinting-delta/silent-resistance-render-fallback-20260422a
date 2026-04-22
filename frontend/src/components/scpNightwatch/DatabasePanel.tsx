"use client";

import styles from "./SCPNightwatch.module.css";
import { LOG_ENTRIES } from "@/game/scpNightwatch/data/content";
import { useSCPNightwatchStore } from "@/game/scpNightwatch/core/store";

export default function DatabasePanel() {
  const save = useSCPNightwatchStore((state) => state.save);
  const setViewMode = useSCPNightwatchStore((state) => state.setViewMode);
  const continuityTrail = save.endingsSeen.length ? save.endingsSeen.join(" / ") : "none";

  return (
    <div className={styles.viewport}>
      <div className={`${styles.panel} ${styles.menuCard}`}>
        <div className={styles.databaseHeader}>
          <div>
            <div className={styles.eyebrow}>scp dossier archive / recovered surveillance annex</div>
            <div className={styles.title}>Recovered Archive Fragments</div>
          </div>
          <div className={styles.navRow}>
            <button className={styles.button} onClick={() => setViewMode("office")}>Return To Watch</button>
            <button className={styles.buttonSecondary} onClick={() => setViewMode("menu")}>Menu</button>
          </div>
        </div>
        <div className={styles.systemBanner} style={{ marginTop: 14 }}>
          <span className={styles.statusPulse} />
          <strong>archive index / partially reconstructed / sector loss unresolved</strong>
        </div>
        <div className={styles.footerNote} style={{ marginTop: 10 }}>
          Review residue: prior outcomes {continuityTrail}. Annex references imply missing companion records.
        </div>
      </div>
      <div className={styles.databaseGrid} style={{ marginTop: 12 }}>
        {LOG_ENTRIES.map((entry) => {
          const unlocked = save.unlockedLogs.includes(entry.id);
          return (
            <div key={entry.id} className={`${styles.panel} ${styles.logCard}`}>
              <div className={styles.sectionHeader}>
                <strong>{unlocked ? entry.title : "[REDACTED ANNEX]"}</strong>
                <span className={`${styles.tag} ${styles.infoTag}`}>{entry.clearance}</span>
              </div>
              <p className={unlocked ? styles.muted : styles.redacted}>
                {unlocked ? `${entry.body} [ARCHIVE CHECKSUM MISMATCH]` : "segment withheld / checksum invalid / partial sector loss"}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
