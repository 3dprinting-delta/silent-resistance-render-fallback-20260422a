"use client";

import { useMemo } from "react";
import styles from "./RagdollArchers.module.css";
import { PLAYER_ID } from "@/game/ragdollArchers/core/constants";
import { getUpgradeLabel, type UpgradeId } from "@/game/ragdollArchers/core/progression";
import { useRagdollArchersStore } from "@/game/ragdollArchers/core/store";
import { getCurrentTreatmentRequirements, getCurrentTreatmentTool, supplyCatalog } from "@/game/ragdollArchers/systems/survival";
import { SupplyVisual } from "@/components/ragdollArchers/SupplyVisual";
import { DeathTimeline } from "@/components/ragdollArchers/DeathTimeline";
import type { SupplyStack } from "@/game/ragdollArchers/core/types";

const upgradeOrder: UpgradeId[] = ["vitality", "endurance", "draw", "quiver", "recovery", "fieldMedicine"];
const categoryOrder = ["medical", "tool", "food", "drink", "relic"] as const;
const staminaShowcase = ["water", "coffee", "cake", "pizza", "monster", "red-bull", "apple", "enchanted-golden-apple", "undying-totem"] as const;

function useHudModel() {
  const actors = useRagdollArchersStore((state) => state.actors);
  const match = useRagdollArchersStore((state) => state.match);
  const phase = useRagdollArchersStore((state) => state.phase);
  const result = useRagdollArchersStore((state) => state.result);
  const deathReport = useRagdollArchersStore((state) => state.deathReport);
  const medicalSummary = useRagdollArchersStore((state) => state.medicalSummary);
  const treatmentStatus = useRagdollArchersStore((state) => state.treatmentStatus);
  const activeTreatment = useRagdollArchersStore((state) => state.activeTreatment);
  const derivedVitalsByActor = useRagdollArchersStore((state) => state.derivedVitalsByActor);
  const supplies = useRagdollArchersStore((state) => state.supplies);
  const activeArrowType = useRagdollArchersStore((state) => state.activeArrowType);
  const hudState = useRagdollArchersStore((state) => state.hudState);
  const realismMode = useRagdollArchersStore((state) => state.realismMode);
  const progression = useRagdollArchersStore((state) => state.progression);
  const queueSelfAction = useRagdollArchersStore((state) => state.queueSelfAction);
  const setHudState = useRagdollArchersStore((state) => state.setHudState);
  const spendUpgradePoint = useRagdollArchersStore((state) => state.spendUpgradePoint);
  const restartMatch = useRagdollArchersStore((state) => state.restartMatch);
  const returnToMenu = useRagdollArchersStore((state) => state.returnToMenu);

  const player = actors[PLAYER_ID];
  const derivedVitals = derivedVitalsByActor[PLAYER_ID];
  const topInjury = treatmentStatus.currentInjury;
  const showMedical = realismMode || hudState.showMedicalPanel;

  const groupedSupplies = useMemo(() => {
    const liveSupplies = supplies.filter((stack) => stack.quantity > 0);
    return categoryOrder
      .map((category) => ({
        category,
        items: liveSupplies.filter((stack) => supplyCatalog[stack.id].category === category),
      }))
      .filter((group) => group.items.length > 0);
  }, [supplies]);

  const notableText = useMemo(() => {
    if (!player) return "Deploying";
    if (topInjury) return `${topInjury.severity} ${topInjury.category.replaceAll("-", " ")} in ${topInjury.bodyRegion}`;
    if (player.health < 35) return "One clean hit from collapse";
    return "Stable enough to keep pressuring";
  }, [player, topInjury]);

  const fpsStateClass = useMemo(() => {
    if (!derivedVitals) return "";
    if (activeTreatment) return styles.hudStateTreating;
    if (derivedVitals.bloodLossLevel > 0.65) return styles.hudStateCritical;
    if (derivedVitals.breathingCapacity < 0.45) return styles.hudStateBreathing;
    if (derivedVitals.shockRisk > 0.6) return styles.hudStateShock;
    return "";
  }, [activeTreatment, derivedVitals]);

  return {
    player,
    match,
    phase,
    result,
    deathReport,
    medicalSummary,
    treatmentStatus,
    activeTreatment,
    derivedVitals,
    supplies,
    activeArrowType,
    progression,
    queueSelfAction,
    setHudState,
    spendUpgradePoint,
    restartMatch,
    returnToMenu,
    topInjury,
    showMedical,
    groupedSupplies,
    notableText,
    fpsStateClass,
  };
}

function SupplyRow({ stack }: { stack: SupplyStack }) {
  const item = supplyCatalog[stack.id];
  return (
    <div className={styles.supplyRow}>
      <span className={styles.supplyLabel}>
        <SupplyVisual item={item} framed={item.category === "relic"} />
        {item.label}
      </span>
      <strong>x{stack.quantity}</strong>
    </div>
  );
}

function TreatmentRequirements({
  topInjury,
  supplies,
  canTreatNow,
  queueSelfAction,
  activeTreatment,
}: {
  topInjury: ReturnType<typeof useHudModel>["topInjury"];
  supplies: SupplyStack[];
  canTreatNow: boolean;
  queueSelfAction: ReturnType<typeof useHudModel>["queueSelfAction"];
  activeTreatment: ReturnType<typeof useHudModel>["activeTreatment"];
}) {
  if (!topInjury) {
    return <span className={styles.hudValue}>No urgent treatment needed.</span>;
  }
  const currentRequirements = getCurrentTreatmentRequirements(topInjury);
  const currentTool = getCurrentTreatmentTool(topInjury);

  return (
    <>
      <span className={styles.hudValue}>{topInjury.severity} {topInjury.category.replaceAll("-", " ")} / {topInjury.treatmentStage || "untreated"}</span>
      <div className={styles.requirementList}>
        {currentRequirements.map((requirement) => {
          const item = supplyCatalog[requirement.supplyId];
          const owned = supplies.find((stack) => stack.id === requirement.supplyId)?.quantity || 0;
          return (
            <div key={requirement.supplyId} className={styles.supplyRow}>
              <span className={styles.supplyLabel}>
                <SupplyVisual item={item} />
                {item.label} x{requirement.quantity}
              </span>
              <strong>{owned >= requirement.quantity ? "ready" : `missing ${requirement.quantity - owned}`}</strong>
            </div>
          );
        })}
        <div className={styles.supplyRow}>
          <span className={styles.supplyLabel}>
            {currentTool ? <SupplyVisual item={supplyCatalog[currentTool]} /> : null}
            Tool
          </span>
          <strong>{currentTool ? supplyCatalog[currentTool].label : "None"}</strong>
        </div>
      </div>
      <div className={styles.inlineActions}>
        <button type="button" className={styles.secondaryButton} onClick={() => queueSelfAction({ type: "treat", target: topInjury.id })}>
          {canTreatNow ? `Begin ${topInjury.treatmentStage === "recovering" ? "Final Treatment" : topInjury.stabilized ? "Recovery Stage" : "Stabilization"}` : "Missing Supplies"}
        </button>
      </div>
      {activeTreatment ? <span className={styles.warningText}>Treating: {activeTreatment.label} / {activeTreatment.stage} / {Math.round(activeTreatment.progress * 100)}%</span> : null}
    </>
  );
}

function DuelHud(model: ReturnType<typeof useHudModel>) {
  return (
    <div className={styles.hudTop}>
      <div className={styles.hudColumn}>
        <div className={styles.hudCard}>
          <span className={styles.hudLabel}>Health</span>
          <span className={styles.hudValue}>{model.player ? `${Math.round(model.player.health)} / ${Math.round(model.player.stability)} stability` : "loading"}</span>
          <div className={styles.barWrap}>
            <div className={styles.barFill} style={{ width: `${Math.max(0, Math.min(100, model.player?.health || 0))}%` }} />
          </div>
        </div>
        <div className={styles.hudCard}>
          <span className={styles.hudLabel}>Stamina</span>
          <span className={styles.hudValue}>{model.player ? `${Math.round(model.player.vitals.stamina)} stamina / ${Math.round(model.player.vitals.energy)} energy` : "loading"}</span>
          <div className={styles.barWrap}>
            <div className={styles.altBarFill} style={{ width: `${Math.max(0, Math.min(100, model.player?.vitals.stamina || 0))}%` }} />
          </div>
          <div className={styles.requirementList}>
            {staminaShowcase.map((itemId) => {
              const item = supplyCatalog[itemId];
              return (
                <div key={itemId} className={styles.supplyRow}>
                  <span className={styles.supplyLabel}>
                    <SupplyVisual item={item} framed={item.category === "relic"} />
                    {item.label}
                  </span>
                  <strong>{item.staminaGain ? `+${item.staminaGain} STA` : item.medicalUse || "Emergency"}</strong>
                </div>
              );
            })}
          </div>
        </div>
        <div className={styles.hudCard}>
          <span className={styles.hudLabel}>Collected Supplies</span>
          <span className={styles.hudValue}>Field inventory carried between runs</span>
          <div className={styles.supplyList}>
            {model.groupedSupplies.map((group) => (
              <div key={group.category}>
                <span className={styles.hudLabel}>{group.category}</span>
                <div className={styles.requirementList}>
                  {group.items.map((stack) => <SupplyRow key={stack.id} stack={stack} />)}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className={styles.hudCard}>
          <span className={styles.hudLabel}>Required Treatment</span>
          <span className={styles.sectionCopy}>Staged care uses the exact supplies for the current medical step instead of one arcade heal button.</span>
          <TreatmentRequirements
            topInjury={model.topInjury}
            supplies={model.supplies}
            canTreatNow={model.treatmentStatus.canTreatNow}
            queueSelfAction={model.queueSelfAction}
            activeTreatment={model.activeTreatment}
          />
        </div>
      </div>

      <div className={styles.hudColumn}>
        <div className={styles.hudCard}>
          <span className={styles.hudLabel}>Match</span>
          <span className={styles.hudValue}>Classic 2D / Wave {model.match.wave}</span>
          <div className={styles.requirementList}>
            <div className={styles.supplyRow}><span>Score</span><strong>{model.match.score}</strong></div>
            <div className={styles.supplyRow}><span>Kills</span><strong>{model.match.kills}</strong></div>
            <div className={styles.supplyRow}><span>Arrow</span><strong>{model.activeArrowType}</strong></div>
            <div className={styles.supplyRow}><span>Status</span><strong>{model.notableText}</strong></div>
          </div>
        </div>
        <div className={styles.hudCard}>
          <span className={styles.hudLabel}>Vitals Layer</span>
          <div className={styles.requirementList}>
            <div className={styles.supplyRow}><span>Blood loss</span><strong>{model.derivedVitals ? `${Math.round(model.derivedVitals.bloodLossLevel * 100)}%` : "0%"}</strong></div>
            <div className={styles.supplyRow}><span>Breathing</span><strong>{model.derivedVitals ? `${Math.round(model.derivedVitals.breathingCapacity * 100)}%` : "100%"}</strong></div>
            <div className={styles.supplyRow}><span>Pain</span><strong>{model.derivedVitals ? `${Math.round(model.derivedVitals.painLoad * 100)}%` : "0%"}</strong></div>
            <div className={styles.supplyRow}><span>Shock risk</span><strong>{model.derivedVitals ? `${Math.round(model.derivedVitals.shockRisk * 100)}%` : "0%"}</strong></div>
          </div>
        </div>
        <div className={styles.hudCard}>
          <span className={styles.hudLabel}>Progression</span>
          <span className={styles.hudValue}>{model.progression.upgradePoints} upgrade point{model.progression.upgradePoints === 1 ? "" : "s"} / {model.progression.coins} coins</span>
          <div className={styles.requirementList}>
            <div className={styles.supplyRow}><span>Best wave</span><strong>{model.progression.bestWave}</strong></div>
            <div className={styles.supplyRow}><span>High score</span><strong>{model.progression.highestScore}</strong></div>
          </div>
        </div>
        <div className={styles.hudCard}>
          <span className={styles.hudLabel}>Upgrades</span>
          <div className={styles.requirementList}>
            {upgradeOrder.map((upgradeId) => (
              <div key={upgradeId} className={styles.supplyRow}>
                <span>{getUpgradeLabel(upgradeId)}</span>
                <strong>Lv {model.progression.upgrades[upgradeId]}</strong>
              </div>
            ))}
          </div>
          <div className={styles.inlineActions}>
            {upgradeOrder.map((upgradeId) => (
              <button key={upgradeId} type="button" className={styles.secondaryButton} disabled={model.progression.upgradePoints <= 0} onClick={() => model.spendUpgradePoint(upgradeId)}>
                + {getUpgradeLabel(upgradeId)}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.hudCard}>
          <span className={styles.hudLabel}>Panels</span>
          <span className={styles.hudValue}>{model.showMedical ? "Medical layer expanded" : "Compact tactical view"}</span>
          <div className={styles.inlineActions}>
            <button type="button" className={styles.secondaryButton} onClick={() => model.setHudState({ showMedicalPanel: !model.showMedical })}>
              {model.showMedical ? "Hide Medical Layer" : "Show Medical Layer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FirstPersonHud(model: ReturnType<typeof useHudModel>) {
  return (
    <div className={`${styles.fpsHudShell} ${model.fpsStateClass}`}>
      <div className={styles.crosshair} aria-hidden="true" />

      <div className={styles.fpsTopRibbon}>
        <div className={styles.fpsVitalPill}>
          <span>HP</span>
          <strong>{Math.round(model.player?.health || 0)}</strong>
        </div>
        <div className={styles.fpsVitalPill}>
          <span>STA</span>
          <strong>{Math.round(model.player?.vitals.stamina || 0)}</strong>
        </div>
        <div className={styles.fpsVitalPill}>
          <span>Blood</span>
          <strong>{model.derivedVitals ? `${Math.round(model.derivedVitals.bloodLossLevel * 100)}% loss` : "0% loss"}</strong>
        </div>
        <div className={styles.fpsVitalPill}>
          <span>Breathing</span>
          <strong>{model.derivedVitals ? `${Math.round(model.derivedVitals.breathingCapacity * 100)}%` : "100%"}</strong>
        </div>
        <div className={styles.fpsVitalPill}>
          <span>Shock</span>
          <strong>{model.derivedVitals ? `${Math.round(model.derivedVitals.shockRisk * 100)}%` : "0%"}</strong>
        </div>
      </div>

      <div className={styles.fpsLeftRail}>
        <div className={styles.hudCard}>
          <span className={styles.hudLabel}>Current Trauma</span>
          <span className={styles.hudValue}>{model.notableText}</span>
          <span className={styles.sectionCopy}>Triage shows what this injury needs right now, including tool requirements for the current stage.</span>
          <TreatmentRequirements
            topInjury={model.topInjury}
            supplies={model.supplies}
            canTreatNow={model.treatmentStatus.canTreatNow}
            queueSelfAction={model.queueSelfAction}
            activeTreatment={model.activeTreatment}
          />
        </div>
        <div className={styles.hudCard}>
          <span className={styles.hudLabel}>Vitals Stress</span>
          <div className={styles.requirementList}>
            <div className={styles.supplyRow}><span>Pain load</span><strong>{model.derivedVitals ? `${Math.round(model.derivedVitals.painLoad * 100)}%` : "0%"}</strong></div>
            <div className={styles.supplyRow}><span>Stability</span><strong>{Math.round(model.player?.stability || 0)}</strong></div>
            <div className={styles.supplyRow}><span>Energy</span><strong>{Math.round(model.player?.vitals.energy || 0)}</strong></div>
          </div>
        </div>
      </div>

      <div className={styles.fpsRightRail}>
        <div className={styles.hudCard}>
          <span className={styles.hudLabel}>Collected Supplies</span>
          <div className={styles.supplyList}>
            {model.groupedSupplies.map((group) => (
              <div key={group.category}>
                <span className={styles.hudLabel}>{group.category}</span>
                <div className={styles.requirementList}>
                  {group.items.map((stack) => <SupplyRow key={stack.id} stack={stack} />)}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className={styles.hudCard}>
          <span className={styles.hudLabel}>Foods And Drinks</span>
          <div className={styles.requirementList}>
            {staminaShowcase.map((itemId) => {
              const item = supplyCatalog[itemId];
              return (
                <div key={itemId} className={styles.supplyRow}>
                  <span className={styles.supplyLabel}>
                    <SupplyVisual item={item} framed={item.category === "relic"} />
                    {item.label}
                  </span>
                  <strong>{item.staminaGain ? `+${item.staminaGain} STA` : item.medicalUse || "Emergency"}</strong>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className={styles.fpsBottomStrip}>
        <div className={styles.fpsMatchBadge}><span>Mode</span><strong>First-Person</strong></div>
        <div className={styles.fpsMatchBadge}><span>Wave</span><strong>{model.match.wave}</strong></div>
        <div className={styles.fpsMatchBadge}><span>Kills</span><strong>{model.match.kills}</strong></div>
        <div className={styles.fpsMatchBadge}><span>Score</span><strong>{model.match.score}</strong></div>
        <div className={styles.fpsMatchBadge}><span>Arrow</span><strong>{model.activeArrowType}</strong></div>
      </div>

      <div className={styles.fpsUpgradesDock}>
        <div className={styles.hudCard}>
          <span className={styles.hudLabel}>Progression</span>
          <div className={styles.requirementList}>
            <div className={styles.supplyRow}><span>Coins</span><strong>{model.progression.coins}</strong></div>
            <div className={styles.supplyRow}><span>Upgrade points</span><strong>{model.progression.upgradePoints}</strong></div>
            {upgradeOrder.map((upgradeId) => (
              <div key={upgradeId} className={styles.supplyRow}>
                <span>{getUpgradeLabel(upgradeId)}</span>
                <strong>Lv {model.progression.upgrades[upgradeId]}</strong>
              </div>
            ))}
          </div>
          <div className={styles.inlineActions}>
            {upgradeOrder.map((upgradeId) => (
              <button key={upgradeId} type="button" className={styles.secondaryButton} disabled={model.progression.upgradePoints <= 0} onClick={() => model.spendUpgradePoint(upgradeId)}>
                + {getUpgradeLabel(upgradeId)}
              </button>
            ))}
            <button type="button" className={styles.secondaryButton} onClick={() => model.setHudState({ showMedicalPanel: !model.showMedical })}>
              {model.showMedical ? "Hide Medical Layer" : "Show Medical Layer"}
            </button>
          </div>
        </div>
      </div>

      <div className={styles.fpsDamageVignette} aria-hidden="true" />
    </div>
  );
}

function DeathReportOverlay(model: ReturnType<typeof useHudModel>) {
  if (model.phase !== "result" || !model.result) return null;

  return (
    <div className={styles.deathReportModal}>
      <div className={`${styles.resultBanner} ${styles.deathReportBanner}`}>
        <div className={styles.deathHero}>
          <p className={styles.eyebrow}>{model.result.success ? "Run Cleared" : "Medical Death Report"}</p>
          <h2 className={styles.deathHeadline}>{model.result.success ? model.result.title : model.deathReport?.causeOfDeath || model.result.title}</h2>
          <p className={styles.sectionCopy}>{model.result.body}</p>
        </div>

        {model.deathReport ? (
          <>
            <div className={styles.deathReportGrid}>
              <div className={styles.deathCard}><span>Primary fatal injury</span><strong>{model.deathReport.primaryFatalInjury}</strong></div>
              <div className={styles.deathCard}><span>Body region</span><strong>{model.deathReport.bodyRegion}</strong></div>
              <div className={styles.deathCard}><span>Estimated blood loss</span><strong>{model.deathReport.estimatedBloodLossMl} mL</strong></div>
              <div className={styles.deathCard}><span>Preventability</span><strong>{model.deathReport.preventability}</strong></div>
              <div className={styles.deathCard}><span>Breathing / shock</span><strong>{Math.round((model.deathReport.breathingCapacityAtDeath || 0) * 100)}% / {Math.round((model.deathReport.shockRiskAtDeath || 0) * 100)}%</strong></div>
              <div className={styles.deathCard}><span>Contributing injuries</span><strong>{model.deathReport.contributingInjuries.join(", ") || "None listed"}</strong></div>
            </div>

            <div className={styles.deathStageGrid}>
              <div className={styles.feedItem}>
                <strong>Cause Explanation</strong>
                <span>{model.deathReport.causeExplanation || model.deathReport.causeOfDeath}</span>
              </div>
              <div className={styles.feedItem}>
                <strong>Missing Care</strong>
                <span>
                  {model.deathReport.missingRequirements.map((entry) => `${supplyCatalog[entry.supplyId].label} x${entry.quantity}`).join(", ") || "No missing supplies recorded"}
                  {model.deathReport.missingTools.length ? ` / Tools: ${model.deathReport.missingTools.map((tool) => supplyCatalog[tool].label).join(", ")}` : ""}
                </span>
                <div className={styles.deathRelicRow}>
                  {model.deathReport.missingRequirements.map((entry) => <SupplyVisual key={entry.supplyId} item={supplyCatalog[entry.supplyId]} framed={supplyCatalog[entry.supplyId].category === "relic"} />)}
                  {model.deathReport.missingTools.map((tool) => <SupplyVisual key={tool} item={supplyCatalog[tool]} />)}
                </div>
              </div>
            </div>

            <div className={styles.deathTimelineCard}>
              <span className={styles.hudLabel}>Chronological Trauma Timeline</span>
              <DeathTimeline deathReport={model.deathReport} />
            </div>
          </>
        ) : model.medicalSummary ? (
          <div className={styles.reportList}>
            <div className={styles.feedItem}>
              <strong>Medical summary</strong>
              <span>{model.medicalSummary.totalInjuries} injuries, {model.medicalSummary.criticalInjuries} critical, {Math.round(model.medicalSummary.treatmentSuccessRate * 100)}% treatment success</span>
            </div>
          </div>
        ) : null}

        <div className={styles.buttonRow}>
          <button type="button" className={styles.primaryButton} onClick={model.restartMatch}>Retry</button>
          <button type="button" className={styles.secondaryButton} onClick={model.returnToMenu}>Return to Menu</button>
        </div>
      </div>
    </div>
  );
}

export function GameHud() {
  const model = useHudModel();

  return (
    <div className={styles.hudRoot}>
      {model.match.activeMode === "firstperson" ? <FirstPersonHud {...model} /> : <DuelHud {...model} />}
      <DeathReportOverlay {...model} />
    </div>
  );
}
