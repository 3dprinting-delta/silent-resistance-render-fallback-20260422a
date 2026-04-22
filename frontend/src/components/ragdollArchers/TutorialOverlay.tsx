"use client";

import styles from "./RagdollArchers.module.css";
import { useRagdollArchersStore } from "@/game/ragdollArchers/core/store";

const steps = [
  { id: "move", title: "Move", body: "Use A and D in the 2D duel, or WASD in first-person. Space jumps in both." },
  { id: "fight", title: "Aim and Shoot", body: "Hold the mouse button to draw and release to fire. The duel stays side-on while the first-person mode uses full camera aim." },
  { id: "treat", title: "Treat Fast", body: "Healing is not automatic. Collect the correct supplies and tools, then use the treatment panel to stabilize the exact injury." },
  { id: "survive", title: "Survive", body: "Food and drinks restore stamina in different ways, but serious trauma still needs the proper medical combination." },
];

export function TutorialOverlay() {
  const tutorial = useRagdollArchersStore((state) => state.tutorial);
  const setTutorial = useRagdollArchersStore((state) => state.setTutorial);

  if (!tutorial.visible) return null;

  const current = steps[tutorial.currentStep] || steps[steps.length - 1];
  const lastStep = tutorial.currentStep >= steps.length - 1;

  return (
    <div className={styles.tutorialOverlay}>
      <div className={styles.tutorialCard}>
        <p className={styles.eyebrow}>Quick Tutorial</p>
        <h3 className={styles.sectionTitle}>{current.title}</h3>
        <p className={styles.sectionCopy}>{current.body}</p>
        <div className={styles.progressDots}>
          {steps.map((step, index) => (
            <span key={step.id} className={`${styles.progressDot} ${index <= tutorial.currentStep ? styles.progressDotActive : ""}`} />
          ))}
        </div>
        <div className={styles.buttonRow}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => setTutorial({ visible: false, skipped: true, seen: true })}
          >
            Skip
          </button>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() =>
              lastStep
                ? setTutorial({ visible: false, completed: true, seen: true })
                : setTutorial({ currentStep: tutorial.currentStep + 1, seen: true })
            }
          >
            {lastStep ? "Enter the Arena" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
