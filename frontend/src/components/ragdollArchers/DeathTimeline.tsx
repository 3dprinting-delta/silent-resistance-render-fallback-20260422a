"use client";

import styles from "./RagdollArchers.module.css";
import type { MedicalDeathReport } from "@/game/ragdollArchers/core/types";

function inferStage(detail: string, index: number, total: number) {
  if (index === 0) return "impact";
  if (detail.includes("untreated")) return "escalation";
  if (detail.includes("recovering") || detail.includes("stabilized")) return "partial treatment";
  if (index === total - 1) return "terminal collapse";
  return "progression";
}

export function DeathTimeline({ deathReport }: { deathReport: MedicalDeathReport }) {
  return (
    <div className={styles.timelineStack}>
      {deathReport.timeline.map((entry, index) => (
        <div key={entry.id} className={styles.timelineItem}>
          <div className={styles.timelineMarker} />
          <div className={styles.timelineBody}>
            <div className={styles.timelineHeader}>
              <strong>{entry.label}</strong>
              <span>{inferStage(entry.detail, index, deathReport.timeline.length)}</span>
            </div>
            <p>{entry.detail}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
