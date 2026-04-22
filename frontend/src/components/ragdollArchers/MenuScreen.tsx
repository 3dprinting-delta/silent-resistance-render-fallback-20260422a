"use client";

import { useState } from "react";
import styles from "./RagdollArchers.module.css";

type StartMode = "quick" | "survival" | "challenge";

export function MenuScreen({ onStartGame }: { onStartGame: (mode: StartMode, baseMode?: "quick" | "survival") => void }) {
  const [baseMode, setBaseMode] = useState<"quick" | "survival">("quick");
  const roadmap = [
    "Upgrade bow flex, arrow drag, armor penetration, and body mass response so every hit reads more like a weighted impact than an arcade bounce.",
    "Expand the medical model into airway, bleeding, fracture, and infection doctrine with treatment timing penalties if care is delayed.",
    "Add account-tied progression for training certifications, med kits, and arena unlocks so saved data feels meaningful between sessions.",
    "Introduce co-op triage or PvP tournaments where one mode emphasizes duel skill and another rewards stabilization under pressure.",
    "Replace placeholder food boosts with digestion, hydration, stimulant crash, and fatigue curves for longer first-person survival runs.",
    "Layer post-match analytics with shot path reconstruction, fracture maps, and preventability scoring for every death report.",
  ];

  return (
    <div className={styles.menuPanel}>
      <div className={styles.card}>
        <p className={styles.eyebrow}>Combat Profiles</p>
        <h2 className={styles.sectionTitle}>Select How You Want To Fight</h2>
        <p className={styles.sectionCopy}>
          Classic 2D and First-Person now share the same injuries, supplies, upgrades, accounts, and death reporting. Medical Realism keeps the same combat loop but makes treatment slower, stricter, and more medically grounded.
        </p>
        <div className={styles.optionGrid}>
          <button type="button" className={`${styles.optionButton} ${baseMode === "quick" ? styles.optionActive : ""}`} onClick={() => setBaseMode("quick")}>
            <strong>Classic 2D</strong>
            <span>Primary side-view ragdoll duels with fast waves and readable pickups.</span>
          </button>
          <button type="button" className={`${styles.optionButton} ${baseMode === "survival" ? styles.optionActive : ""}`} onClick={() => setBaseMode("survival")}>
            <strong>First-Person</strong>
            <span>Same core loop from the player view with shared medical rules and progression.</span>
          </button>
        </div>
        <div className={styles.buttonRow}>
          <button type="button" className={styles.primaryButton} onClick={() => onStartGame("quick")}>
            Classic 2D
          </button>
          <button type="button" className={styles.secondaryButton} onClick={() => onStartGame("survival")}>
            First-Person
          </button>
          <button type="button" className={styles.secondaryButton} onClick={() => onStartGame("challenge", baseMode)}>
            Medical Realism
          </button>
        </div>
      </div>
      <div className={styles.card}>
        <p className={styles.eyebrow}>Treatment Doctrine</p>
        <h2 className={styles.sectionTitle}>What Makes This Version More Realistic</h2>
        <p className={styles.sectionCopy}>
          Injuries are not cured by one food pickup. Bleeding, fractures, chest trauma, concussion, and organ damage now require stage-based supplies, the right tool, and enough inventory to stabilize before recovery.
        </p>
        <div className={styles.featureGrid}>
          <div className={styles.featureCard}>
            <strong>Classic 2D</strong>
            <span>Side-view duels stay readable, but ragdoll reactions, bleeding risk, and stamina drain carry more weight.</span>
          </div>
          <div className={styles.featureCard}>
            <strong>First-Person</strong>
            <span>The same injuries and inventory rules apply from a player-view camera for a harsher survival feel.</span>
          </div>
          <div className={styles.featureCard}>
            <strong>Medical HUD</strong>
            <span>Health and stamina are followed by collected supplies and required treatment so triage stays visible in combat.</span>
          </div>
          <div className={styles.featureCard}>
            <strong>Death Reporting</strong>
            <span>Every fatal run ends with a medical report describing the injury chain, cause of death, and missing care.</span>
          </div>
        </div>
      </div>
      <div className={styles.card}>
        <p className={styles.eyebrow}>Upgrade Roadmap</p>
        <h2 className={styles.sectionTitle}>Enhance Suggestions</h2>
        <div className={styles.roadmapList}>
          {roadmap.map((item) => (
            <div key={item} className={styles.feedItem}>
              <strong>Enhancement</strong>
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
