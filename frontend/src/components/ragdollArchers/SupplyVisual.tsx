"use client";

import styles from "./RagdollArchers.module.css";
import type { SupplyPresentation } from "@/game/ragdollArchers/core/types";

export function SupplyVisual({
  item,
  size = "sm",
  framed = false,
}: {
  item: SupplyPresentation;
  size?: "sm" | "md" | "lg";
  framed?: boolean;
}) {
  const rootClass = [
    styles.supplyVisual,
    styles[`supplyVisual${size.toUpperCase()}`],
    item.category === "relic" ? styles.supplyVisualRelic : "",
    framed ? styles.supplyVisualFramed : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (item.visualKey === "enchanted-golden-apple") {
    return (
      <span className={rootClass} aria-hidden="true" title={item.label}>
        <span className={`${styles.pixelSprite} ${styles.pixelApple}`}>
          <span className={styles.pixelAppleLeaf} />
          <span className={styles.pixelAppleBody} />
          <span className={styles.pixelAppleShimmer} />
        </span>
      </span>
    );
  }

  if (item.visualKey === "undying-totem") {
    return (
      <span className={rootClass} aria-hidden="true" title={item.label}>
        <span className={`${styles.pixelSprite} ${styles.pixelTotem}`}>
          <span className={styles.pixelTotemHead} />
          <span className={styles.pixelTotemEyes} />
          <span className={styles.pixelTotemBody} />
          <span className={styles.pixelTotemAura} />
        </span>
      </span>
    );
  }

  return (
    <span className={rootClass} aria-hidden="true" title={item.label}>
      <span className={styles.supplyVisualChip} style={{ background: item.accentColor }}>
        {item.shortLabel.slice(0, 2).toUpperCase()}
      </span>
    </span>
  );
}
