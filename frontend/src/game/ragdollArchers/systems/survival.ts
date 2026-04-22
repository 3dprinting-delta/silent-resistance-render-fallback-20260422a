import type {
  ActiveTreatment,
  ActorVitals,
  ArrowType,
  DerivedVitals,
  InjuryRecord,
  InjuryRequirement,
  InjurySeverity,
  LimbName,
  MatchMedicalSummary,
  MedicalEvent,
  MedicalEventType,
  MedicalDeathReport,
  MedicalSupplyId,
  SupplyPresentation,
  SupplyStack,
  TreatmentStageResult,
} from "@/game/ragdollArchers/core/types";
import { clamp } from "@/game/ragdollArchers/systems/math";

export const supplyCatalog: Record<MedicalSupplyId, SupplyPresentation> = {
  bandage: { id: "bandage", label: "Bandage", shortLabel: "Bandage", visualKey: "bandage", accentColor: "#f2b2a2", category: "medical", rarity: "common", medicalUse: "Control light bleeding." },
  gauze: { id: "gauze", label: "Gauze", shortLabel: "Gauze", visualKey: "gauze", accentColor: "#e4d7c7", category: "medical", rarity: "common", medicalUse: "Pack punctures and dress wounds." },
  "pressure-bandage": { id: "pressure-bandage", label: "Pressure Bandage", shortLabel: "Pressure", visualKey: "pressure-bandage", accentColor: "#c76161", category: "medical", rarity: "uncommon", medicalUse: "Compress severe bleeding." },
  "clotting-gauze": { id: "clotting-gauze", label: "Clotting Gauze", shortLabel: "Clotting", visualKey: "clotting-gauze", accentColor: "#906a56", category: "medical", rarity: "uncommon", medicalUse: "Assist hemostatic packing." },
  splint: { id: "splint", label: "Splint", shortLabel: "Splint", visualKey: "splint", accentColor: "#c5a17e", category: "medical", rarity: "uncommon", medicalUse: "Immobilize fractures and dislocations." },
  wrap: { id: "wrap", label: "Wrap", shortLabel: "Wrap", visualKey: "wrap", accentColor: "#d4c2bb", category: "medical", rarity: "common", medicalUse: "Secure splints and dressings." },
  painkiller: { id: "painkiller", label: "Painkiller", shortLabel: "Painkiller", visualKey: "painkiller", accentColor: "#86a8f0", category: "medical", rarity: "common", medicalUse: "Reduce pain load during recovery." },
  antibiotic: { id: "antibiotic", label: "Antibiotic", shortLabel: "Antibiotic", visualKey: "antibiotic", accentColor: "#75c6b1", category: "medical", rarity: "uncommon", medicalUse: "Limit infection risk after treatment." },
  "chest-seal": { id: "chest-seal", label: "Chest Seal", shortLabel: "Chest Seal", visualKey: "chest-seal", accentColor: "#5d87ac", category: "medical", rarity: "rare", medicalUse: "Stabilize open chest trauma." },
  "trauma-pack": { id: "trauma-pack", label: "Trauma Pack", shortLabel: "Trauma Pack", visualKey: "trauma-pack", accentColor: "#df6f57", category: "medical", rarity: "rare", medicalUse: "Support critical trauma stabilization." },
  antiseptic: { id: "antiseptic", label: "Antiseptic", shortLabel: "Antiseptic", visualKey: "antiseptic", accentColor: "#78b4e0", category: "medical", rarity: "common", medicalUse: "Reduce contamination risk." },
  "medical-scissors": { id: "medical-scissors", label: "Medical Scissors", shortLabel: "Scissors", visualKey: "medical-scissors", accentColor: "#8f9bb0", category: "tool", rarity: "uncommon", medicalUse: "Required to prep wraps and splints." },
  water: { id: "water", label: "Water", shortLabel: "Water", visualKey: "water", accentColor: "#59b7ff", category: "drink", rarity: "common", quickUse: true, staminaGain: 10, hydrationGain: 26 },
  coffee: { id: "coffee", label: "Coffee", shortLabel: "Coffee", visualKey: "coffee", accentColor: "#8b5d46", category: "drink", rarity: "common", quickUse: true, staminaGain: 8, energyGain: 12, medicalUse: "Mild alertness boost." },
  cake: { id: "cake", label: "Cake", shortLabel: "Cake", visualKey: "cake", accentColor: "#f4b2c5", category: "food", rarity: "common", quickUse: true, staminaGain: 12, energyGain: 15 },
  pizza: { id: "pizza", label: "Pizza", shortLabel: "Pizza", visualKey: "pizza", accentColor: "#d88b43", category: "food", rarity: "uncommon", quickUse: true, staminaGain: 18, energyGain: 28 },
  monster: { id: "monster", label: "Monster", shortLabel: "Monster", visualKey: "monster", accentColor: "#77d641", category: "drink", rarity: "uncommon", quickUse: true, staminaGain: 22, energyGain: 24, hydrationGain: -4, stimulantCrashPenalty: 18 },
  "red-bull": { id: "red-bull", label: "Red Bull", shortLabel: "Red Bull", visualKey: "red-bull", accentColor: "#5bb5ea", category: "drink", rarity: "uncommon", quickUse: true, staminaGain: 22, energyGain: 24, hydrationGain: -4, stimulantCrashPenalty: 18 },
  apple: { id: "apple", label: "Apple", shortLabel: "Apple", visualKey: "apple", accentColor: "#d84f4f", category: "food", rarity: "common", quickUse: true, staminaGain: 8, energyGain: 8, hydrationGain: 4 },
  "enchanted-golden-apple": { id: "enchanted-golden-apple", label: "Enchanted Golden Apple", shortLabel: "Golden Apple", visualKey: "enchanted-golden-apple", accentColor: "#f1bb46", category: "relic", rarity: "legendary", quickUse: true, staminaGain: 18, energyGain: 20, bloodGain: 6, shockRelief: 8, medicalUse: "Emergency buffer, not a full cure." },
  "undying-totem": { id: "undying-totem", label: "Totem of Undying", shortLabel: "Totem", visualKey: "undying-totem", accentColor: "#87c78d", category: "relic", rarity: "legendary", quickUse: true, bloodGain: 16, shockRelief: 18, medicalUse: "Prevents immediate collapse once." },
};

export function createDefaultVitals(): ActorVitals {
  return {
    bloodLevel: 100,
    pain: 0,
    oxygen: 100,
    hydration: 86,
    energy: 82,
    stamina: 100,
    shock: 0,
    infectionLoad: 0,
    unconscious: false,
  };
}

export function createStarterInventory(): SupplyStack[] {
  return [
    { id: "bandage", label: supplyCatalog.bandage.label, quantity: 3 },
    { id: "gauze", label: supplyCatalog.gauze.label, quantity: 2 },
    { id: "pressure-bandage", label: supplyCatalog["pressure-bandage"].label, quantity: 2 },
    { id: "clotting-gauze", label: supplyCatalog["clotting-gauze"].label, quantity: 2 },
    { id: "splint", label: supplyCatalog.splint.label, quantity: 1 },
    { id: "wrap", label: supplyCatalog.wrap.label, quantity: 2 },
    { id: "painkiller", label: supplyCatalog.painkiller.label, quantity: 2 },
    { id: "antibiotic", label: supplyCatalog.antibiotic.label, quantity: 1 },
    { id: "antiseptic", label: supplyCatalog.antiseptic.label, quantity: 2 },
    { id: "chest-seal", label: supplyCatalog["chest-seal"].label, quantity: 1 },
    { id: "trauma-pack", label: supplyCatalog["trauma-pack"].label, quantity: 1 },
    { id: "medical-scissors", label: supplyCatalog["medical-scissors"].label, quantity: 1 },
    { id: "water", label: supplyCatalog.water.label, quantity: 2 },
    { id: "coffee", label: supplyCatalog.coffee.label, quantity: 1 },
    { id: "pizza", label: supplyCatalog.pizza.label, quantity: 1 },
    { id: "cake", label: supplyCatalog.cake.label, quantity: 1 },
    { id: "apple", label: supplyCatalog.apple.label, quantity: 2 },
    { id: "monster", label: supplyCatalog.monster.label, quantity: 1 },
    { id: "red-bull", label: supplyCatalog["red-bull"].label, quantity: 1 },
    { id: "enchanted-golden-apple", label: supplyCatalog["enchanted-golden-apple"].label, quantity: 1 },
    { id: "undying-totem", label: supplyCatalog["undying-totem"].label, quantity: 1 },
  ];
}

function severityFromForce(force: number): InjurySeverity {
  if (force >= 22) return "critical";
  if (force >= 16) return "severe";
  if (force >= 10) return "moderate";
  return "minor";
}

function requirementsFor(region: InjuryRecord["bodyRegion"], severity: InjurySeverity, category: InjuryRecord["category"]) {
  const requirements: InjuryRequirement[] = [];
  let requiredTool: MedicalSupplyId | undefined;

  if (category === "bleeding-wound") {
    if (severity === "minor") requirements.push({ supplyId: "bandage", quantity: 1 });
    if (severity === "moderate") requirements.push({ supplyId: "bandage", quantity: 2 }, { supplyId: "gauze", quantity: 1 });
    if (severity === "severe") requirements.push({ supplyId: "pressure-bandage", quantity: 1 }, { supplyId: "clotting-gauze", quantity: 2 }, { supplyId: "antiseptic", quantity: 1 });
    if (severity === "critical") requirements.push({ supplyId: "pressure-bandage", quantity: 1 }, { supplyId: "clotting-gauze", quantity: 2 }, { supplyId: "trauma-pack", quantity: 1 }, { supplyId: "painkiller", quantity: 1 });
  }

  if (category === "fractured-bone" || category === "dislocated-joint") {
    requirements.push({ supplyId: "splint", quantity: 1 }, { supplyId: "wrap", quantity: severity === "critical" || severity === "severe" ? 2 : 1 }, { supplyId: "painkiller", quantity: 1 });
    requiredTool = "medical-scissors";
  }

  if (category === "collapsed-lung") {
    requirements.push({ supplyId: "chest-seal", quantity: 1 }, { supplyId: "trauma-pack", quantity: 1 }, { supplyId: "painkiller", quantity: 1 });
  }

  if (category === "organ-trauma") {
    requirements.push({ supplyId: "pressure-bandage", quantity: 1 }, { supplyId: "gauze", quantity: 2 }, { supplyId: "painkiller", quantity: 1 }, { supplyId: "trauma-pack", quantity: 1 });
  }

  if (category === "concussion") {
    requirements.push({ supplyId: "painkiller", quantity: 1 }, { supplyId: "water", quantity: 1 });
  }

  if (region === "neck" && severity !== "minor") {
    requirements.push({ supplyId: "pressure-bandage", quantity: 1 });
  }

  return { requirements, requiredTool };
}

export function createInjuryFromHit(params: {
  actorId: string;
  limb: LimbName;
  arrowType: ArrowType;
  force: number;
  impactAngle: number;
  penetrationDepth: number;
}): InjuryRecord {
  const severity = severityFromForce(params.force);
  const isChest = params.limb === "torso" && params.penetrationDepth > 0.58;
  const isHead = params.limb === "head";
  const isLeg = params.limb.includes("Leg");
  const isArm = params.limb.includes("Arm");
  const bodyRegion: InjuryRecord["bodyRegion"] = isChest ? "chest" : params.limb === "torso" && params.penetrationDepth > 0.42 ? "abdomen" : params.limb;
  const category: InjuryRecord["category"] =
    isHead ? "concussion" : isChest && severity !== "minor" ? "collapsed-lung" : bodyRegion === "abdomen" ? "organ-trauma" : isLeg || isArm ? (severity === "minor" ? "muscle-tear" : "fractured-bone") : severity === "critical" ? "deep-puncture" : "bleeding-wound";
  const affectedTissues = new Set<InjuryRecord["affectedTissues"][number]>();
  if (isArm || isLeg) affectedTissues.add("bone");
  affectedTissues.add("muscle");
  if (severity !== "minor") affectedTissues.add("artery");
  if (bodyRegion === "abdomen") affectedTissues.add("organ");
  if (bodyRegion === "chest") affectedTissues.add("lung");
  if (isHead) affectedTissues.add("brain");
  const { requirements, requiredTool } = requirementsFor(bodyRegion, severity, category);

  return {
    id: `injury-${params.actorId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    actorId: params.actorId,
    bodyRegion,
    category,
    severity,
    arrowType: params.arrowType,
    impactAngle: params.impactAngle,
    penetrationDepth: params.penetrationDepth,
    force: params.force,
    affectedTissues: Array.from(affectedTissues),
    bleedingRate: category === "concussion" ? 0 : severity === "critical" ? 8 : severity === "severe" ? 5 : severity === "moderate" ? 2.5 : 0.8,
    pain: severity === "critical" ? 28 : severity === "severe" ? 18 : severity === "moderate" ? 10 : 4,
    staminaPenalty: bodyRegion === "chest" ? 18 : bodyRegion === "abdomen" ? 12 : isLeg ? 10 : 5,
    mobilityPenalty: isLeg ? (severity === "critical" ? 0.7 : severity === "severe" ? 0.45 : 0.18) : 0,
    aimPenalty: isArm ? (severity === "critical" ? 0.55 : severity === "severe" ? 0.32 : 0.14) : isHead ? 0.28 : 0.12,
    oxygenPenalty: bodyRegion === "chest" ? (severity === "critical" ? 36 : 18) : 0,
    infectionRisk: severity === "critical" ? 0.36 : severity === "severe" ? 0.24 : severity === "moderate" ? 0.12 : 0.05,
    stabilized: false,
    treated: false,
    treatmentStage: "untreated",
    requirements,
    requiredTool,
    createdAt: Date.now(),
  };
}

export function tickVitals(vitals: ActorVitals, injuries: InjuryRecord[], delta: number, moving: boolean) {
  const bleeding = injuries.reduce((sum, injury) => sum + (injury.treated ? injury.bleedingRate * 0.18 : injury.stabilized ? injury.bleedingRate * 0.42 : injury.bleedingRate), 0);
  const pain = injuries.reduce((sum, injury) => sum + (injury.treated ? injury.pain * 0.35 : injury.pain), 0);
  const oxygenPenalty = injuries.reduce((sum, injury) => sum + (injury.treated ? injury.oxygenPenalty * 0.3 : injury.oxygenPenalty), 0);
  const infectionGain = injuries.reduce((sum, injury) => sum + (injury.treated ? 0 : injury.infectionRisk), 0);

  vitals.bloodLevel = clamp(vitals.bloodLevel - bleeding * delta * 0.18, 0, 100);
  vitals.pain = clamp(pain, 0, 100);
  vitals.oxygen = clamp(vitals.oxygen - oxygenPenalty * delta * 0.09 + (moving ? -delta * 1.6 : delta * 1.4), 0, 100);
  vitals.hydration = clamp(vitals.hydration - delta * (moving ? 0.9 : 0.25), 0, 100);
  vitals.energy = clamp(vitals.energy - delta * (moving ? 0.65 : 0.18), 0, 100);
  vitals.infectionLoad = clamp(vitals.infectionLoad + infectionGain * delta * 0.015, 0, 100);
  vitals.shock = clamp((100 - vitals.bloodLevel) * 0.55 + vitals.pain * 0.35, 0, 100);
  vitals.stamina = clamp(vitals.stamina + (moving ? -delta * (4 + pain * 0.02) : delta * (5 - oxygenPenalty * 0.03)) - (100 - vitals.hydration) * delta * 0.02, 0, 100);
  vitals.unconscious = vitals.bloodLevel < 12 || vitals.oxygen < 8 || vitals.shock > 92;
  return vitals;
}

export function computeDerivedVitals(vitals: ActorVitals, injuries: InjuryRecord[]): DerivedVitals {
  const severeInjuries = injuries.filter((injury) => injury.severity === "severe" || injury.severity === "critical").length;
  const untreatedChestTrauma = injuries.filter((injury) => (injury.bodyRegion === "chest" || injury.category === "collapsed-lung") && !injury.treated);
  const painPenalty = injuries.reduce((sum, injury) => sum + (injury.treated ? injury.pain * 0.22 : injury.pain * 0.5), 0);

  return {
    bloodLossLevel: clamp((100 - vitals.bloodLevel) / 100, 0, 1),
    breathingCapacity: clamp(1 - untreatedChestTrauma.reduce((sum, injury) => sum + injury.oxygenPenalty * 0.012, 0) - (100 - vitals.oxygen) / 220, 0.18, 1),
    painLoad: clamp((vitals.pain + painPenalty * 0.12) / 100, 0, 1),
    shockRisk: clamp((vitals.shock / 100) * 0.7 + severeInjuries * 0.08 + (100 - vitals.bloodLevel) / 260, 0, 1),
  };
}

export function getTreatmentAction(injury: InjuryRecord, inventory: SupplyStack[]): ActiveTreatment {
  const needsAdvanced = injury.category === "collapsed-lung" || injury.category === "organ-trauma" || injury.severity === "critical";
  const isFirstStage = !injury.stabilized;
  const isRecoveryStage = injury.stabilized && !injury.treated;
  const stage = isFirstStage
    ? injury.category === "fractured-bone" || injury.category === "dislocated-joint"
      ? "stabilize limb"
      : injury.category === "collapsed-lung" || injury.category === "organ-trauma"
        ? "stabilize trauma"
        : injury.category === "concussion"
          ? "reduce pain"
          : "stabilize bleeding"
    : isRecoveryStage && needsAdvanced
      ? "recover from trauma"
      : isRecoveryStage
        ? "recover function"
        : needsAdvanced
      ? "advanced recovery"
      : "restore function";

  const durationMs =
    stage === "stabilize bleeding"
      ? 1800
      : stage === "reduce pain"
        ? 2200
        : stage === "stabilize limb"
          ? 3400
          : stage === "restore function"
            ? 2800
            : stage === "stabilize trauma"
              ? 4600
              : stage === "recover from trauma"
                ? 5200
                : 5600;

  return {
    injuryId: injury.id,
    label: `${capitalize(injury.severity)} ${injury.bodyRegion}`,
    stage,
    state: "preparing",
    startedAt: 0,
    durationMs,
    progress: 0,
    requiredSupplies: getCurrentTreatmentRequirements(injury),
    requiredTool: getCurrentTreatmentTool(injury),
  };
}

export function applyTreatmentStage(injury: InjuryRecord, stage: string): TreatmentStageResult {
  const result: TreatmentStageResult = {
    stoppedBleeding: false,
    reducedPain: false,
    improvedMobility: false,
    temporaryStabilization: false,
    unresolvedRisk: false,
  };

  if (!injury.stabilized) {
    injury.stabilized = true;
    injury.treatmentStage = "stabilized";
    injury.lastTreatmentAt = Date.now();
    injury.bleedingRate *= injury.category === "collapsed-lung" || injury.category === "organ-trauma" ? 0.45 : 0.3;
    injury.pain *= injury.category === "concussion" ? 0.72 : 0.66;
    result.stoppedBleeding = injury.category !== "concussion";
    result.reducedPain = true;
    result.temporaryStabilization = true;
    result.unresolvedRisk = injury.category === "collapsed-lung" || injury.category === "organ-trauma" || injury.severity === "critical";
    return result;
  }

  if (injury.treatmentStage !== "recovering") {
    injury.treatmentStage = "recovering";
    injury.lastTreatmentAt = Date.now();
    injury.bleedingRate *= 0.42;
    injury.pain *= 0.72;
    injury.infectionRisk *= 0.75;
    injury.mobilityPenalty *= injury.category === "fractured-bone" || injury.category === "dislocated-joint" ? 0.72 : 0.88;
    injury.aimPenalty *= injury.category === "concussion" ? 0.84 : 0.78;
    injury.oxygenPenalty *= injury.category === "collapsed-lung" || injury.category === "organ-trauma" ? 0.72 : 0.84;
    result.reducedPain = true;
    result.temporaryStabilization = true;
    result.unresolvedRisk = true;
    return result;
  }

  injury.treated = true;
  injury.treatmentStage = "treated";
  injury.lastTreatmentAt = Date.now();
  injury.bleedingRate *= 0.18;
  injury.pain *= 0.44;
  injury.infectionRisk *= 0.35;
  injury.mobilityPenalty *= injury.category === "fractured-bone" || injury.category === "dislocated-joint" ? 0.45 : 0.72;
  injury.aimPenalty *= injury.category === "concussion" ? 0.68 : 0.55;
  injury.oxygenPenalty *= injury.category === "collapsed-lung" || injury.category === "organ-trauma" ? 0.55 : 0.7;
  result.stoppedBleeding = true;
  result.reducedPain = true;
  result.improvedMobility = injury.mobilityPenalty > 0;
  result.temporaryStabilization = false;
  result.unresolvedRisk = injury.category === "collapsed-lung" || injury.category === "organ-trauma";
  return result;
}

export function tickInjuryProgression(
  vitals: ActorVitals,
  injuries: InjuryRecord[],
  delta: number,
  context: {
    elapsedMs: number;
    sprinting: boolean;
    balanceState: "stable" | "unstable" | "fallen" | "recovering";
  },
) {
  const events: Array<Pick<MedicalEvent, "type" | "bodyPart" | "severity" | "result" | "details">> = [];

  injuries.forEach((injury) => {
    const elapsedSinceProgress = context.elapsedMs - (injury.lastProgressionAt || injury.createdAt);
    if (elapsedSinceProgress < 4000) return;

    let progressed = false;
    if (!injury.treated && !injury.stabilized && injury.bleedingRate > 3.5) {
      injury.bleedingRate = clamp(injury.bleedingRate + 0.18, 0, 12);
      progressed = true;
      events.push({
        type: "injury_worsened",
        bodyPart: injury.bodyRegion,
        severity: injury.severity,
        result: "Bleeding worsening",
        details: {
          message: `${capitalize(injury.bodyRegion)} bleeding is accelerating.`,
          cause: "untreated bleeding",
        },
      });
    }

    if (injury.category === "concussion" && !injury.treated) {
      injury.aimPenalty = clamp(injury.aimPenalty + 0.015, 0, 0.65);
      injury.pain = clamp(injury.pain + 0.35, 0, 40);
      progressed = true;
    }

    if ((injury.category === "collapsed-lung" || injury.category === "organ-trauma") && !injury.treated) {
      injury.oxygenPenalty = clamp(injury.oxygenPenalty + 0.6, 0, 44);
      progressed = true;
    }

    if (context.sprinting && injury.bodyRegion.includes("Leg") && !injury.treated) {
      injury.mobilityPenalty = clamp(injury.mobilityPenalty + 0.015, 0, 0.85);
      progressed = true;
    }

    if (context.balanceState === "fallen" && !injury.treated) {
      injury.pain = clamp(injury.pain + 0.25, 0, 50);
      progressed = true;
    }

    if (progressed) injury.lastProgressionAt = context.elapsedMs;
  });

  if (vitals.bloodLevel < 26) {
    events.push({
      type: "critical_state_entered",
      severity: "critical",
      result: "Critical blood loss",
      details: {
        message: "Circulatory collapse is imminent without stabilization.",
        cause: "blood loss",
      },
    });
  } else if (vitals.oxygen < 24) {
    events.push({
      type: "critical_state_entered",
      severity: "severe",
      result: "Respiratory compromise",
      details: {
        message: "Oxygen reserve is falling dangerously low.",
        cause: "breathing failure",
      },
    });
  }

  return { vitals, injuries, events };
}

export function consumeSupply(inventory: SupplyStack[], supplyId: MedicalSupplyId, quantity: number) {
  return inventory.map((stack) => (stack.id === supplyId ? { ...stack, quantity: Math.max(0, stack.quantity - quantity) } : stack));
}

export function applyConsumableEffect(vitals: ActorVitals, itemId: MedicalSupplyId) {
  const item = supplyCatalog[itemId];
  if (item.hydrationGain) {
    vitals.hydration = clamp(vitals.hydration + item.hydrationGain, 0, 100);
  }
  if (item.staminaGain) {
    vitals.stamina = clamp(vitals.stamina + item.staminaGain, 0, 100);
  }
  if (item.energyGain) {
    vitals.energy = clamp(vitals.energy + item.energyGain, 0, 100);
  }
  if (item.bloodGain) {
    vitals.bloodLevel = clamp(vitals.bloodLevel + item.bloodGain, 0, 100);
  }
  if (item.shockRelief) {
    vitals.shock = clamp(vitals.shock - item.shockRelief, 0, 100);
  }
  if (itemId === "coffee") {
    vitals.pain = clamp(vitals.pain - 3, 0, 100);
  }
  return vitals;
}

export function getTreatmentStatus(injuries: InjuryRecord[], inventory: SupplyStack[]) {
  const currentInjury = [...injuries].sort((a, b) => severityRank(b.severity) - severityRank(a.severity))[0] || null;
  if (!currentInjury) {
    return {
      currentInjury: null,
      canTreatNow: false,
      missingSupplies: [],
      missingTools: [],
      availableOptions: [],
    };
  }

  const requirements = getCurrentTreatmentRequirements(currentInjury);
  const requiredTool = getCurrentTreatmentTool(currentInjury);
  const missingSupplies = requirements
    .map((requirement) => {
      const owned = inventory.find((stack) => stack.id === requirement.supplyId)?.quantity || 0;
      return { ...requirement, quantity: Math.max(0, requirement.quantity - owned) };
    })
    .filter((requirement) => requirement.quantity > 0);
  const missingTools = requiredTool && (inventory.find((stack) => stack.id === requiredTool)?.quantity || 0) <= 0 ? [requiredTool] : [];

  return {
    currentInjury,
    canTreatNow: missingSupplies.length === 0 && missingTools.length === 0,
    missingSupplies,
    missingTools,
    availableOptions: injuries.map((injury) => ({
      injuryId: injury.id,
      label: `${capitalize(injury.severity)} ${injury.bodyRegion}`,
      body: injury.category.replaceAll("-", " "),
    })),
  };
}

export function treatInjury(injury: InjuryRecord, inventory: SupplyStack[]) {
  let nextInventory = inventory;
  getCurrentTreatmentRequirements(injury).forEach((requirement) => {
    nextInventory = consumeSupply(nextInventory, requirement.supplyId, requirement.quantity);
  });
  const result = applyTreatmentStage(injury, injury.stabilized ? "restore function" : "stabilize");
  if (injury.stabilized && !result.unresolvedRisk) injury.treated = true;
  return { injury, inventory: nextInventory, result };
}

export function buildDeathReport(params: {
  injuries: InjuryRecord[];
  vitals: ActorVitals;
  killer: string;
  weapon: string;
  survivedMs: number;
  derivedVitals?: DerivedVitals;
  medicalEvents?: MedicalEvent[];
}): MedicalDeathReport {
  const primary = [...params.injuries].sort((a, b) => severityRank(b.severity) - severityRank(a.severity) || b.bleedingRate - a.bleedingRate)[0];
  const missingRequirements = primary ? getCurrentTreatmentRequirements(primary) : [];
  const primaryTool = primary ? getCurrentTreatmentTool(primary) : undefined;
  const missingTools = primaryTool ? [primaryTool] : [];
  const derivedVitals = params.derivedVitals || computeDerivedVitals(params.vitals, params.injuries);
  const criticalInjuryEvent = params.medicalEvents?.find((event) => event.type === "injury_added" && event.severity === "critical");
  const treatmentEvents = params.medicalEvents?.filter((event) => event.type === "treatment_completed") || [];
  const failedTreatments = params.medicalEvents?.filter((event) => event.type === "treatment_interrupted").map((event) => event.result) || [];
  const lastSuccessfulTreatment = treatmentEvents.at(-1)?.result;
  const causeExplanation =
    derivedVitals.breathingCapacity < 0.45
      ? "Death followed severe trauma with respiratory compromise, blood loss, and worsening shock."
      : derivedVitals.shockRisk > 0.6
        ? "Death followed escalating shock under untreated trauma and blood depletion."
        : "Death followed cumulative trauma and progressive blood loss.";
  return {
    primaryFatalInjury: primary ? `${capitalize(primary.severity)} ${primary.category.replaceAll("-", " ")} causing ${primary.bodyRegion} failure` : "Systemic trauma",
    contributingInjuries: params.injuries.slice(1, 4).map((injury) => `${capitalize(injury.severity)} ${injury.bodyRegion} ${injury.category.replaceAll("-", " ")}`),
    causeOfDeath: params.vitals.bloodLevel < 10 ? "Exsanguination and circulatory collapse" : params.vitals.oxygen < 12 ? "Respiratory failure" : params.vitals.shock > 90 ? "Pain shock and multi-system collapse" : "Multi-trauma failure",
    bodyRegion: primary?.bodyRegion || "unknown",
    timeSurvivedMs: params.survivedMs,
    estimatedBloodLossMl: Math.round((100 - params.vitals.bloodLevel) * 55),
    statusEffects: [
      params.vitals.oxygen < 40 ? "Respiratory compromise" : null,
      params.vitals.shock > 60 ? "Pain shock" : null,
      params.vitals.infectionLoad > 35 ? "Infection progression" : null,
      params.vitals.unconscious ? "Unconsciousness" : null,
    ].filter(Boolean) as string[],
    preventability:
      primary && !primary.treated && (primary.requirements.length || primary.requiredTool)
        ? "high"
        : params.injuries.some((injury) => !injury.treated && injury.severity !== "minor")
          ? "moderate"
          : "low",
    missingRequirements,
    missingTools,
    killer: params.killer,
    weapon: params.weapon,
    timeFromCriticalInjuryMs: criticalInjuryEvent ? Math.max(0, params.survivedMs - criticalInjuryEvent.timestampMs) : undefined,
    lastSuccessfulTreatment,
    failedTreatments,
    bloodLossAtDeath: derivedVitals.bloodLossLevel,
    breathingCapacityAtDeath: derivedVitals.breathingCapacity,
    shockRiskAtDeath: derivedVitals.shockRisk,
    causeExplanation,
    timeline: params.injuries.map((injury, index) => ({
      id: injury.id,
      timestampMs: Math.max(0, params.survivedMs - (params.injuries.length - index) * 8000),
      label: capitalize(injury.category.replaceAll("-", " ")),
      detail: `${capitalize(injury.severity)} injury to ${injury.bodyRegion} (${injury.treatmentStage || "untreated"})`,
    })),
    chronologicalTimeline: [...(params.medicalEvents || [])],
  };
}

export function getCurrentTreatmentRequirements(injury: InjuryRecord): InjuryRequirement[] {
  if (!injury.stabilized) {
    return injury.requirements;
  }

  if (injury.treatmentStage === "recovering") {
    switch (injury.category) {
      case "fractured-bone":
      case "dislocated-joint":
        return [
          { supplyId: "wrap", quantity: 1 },
          { supplyId: "painkiller", quantity: 1 },
          { supplyId: "antibiotic", quantity: 1 },
        ];
      case "collapsed-lung":
        return [
          { supplyId: "trauma-pack", quantity: 1 },
          { supplyId: "painkiller", quantity: 1 },
          { supplyId: "water", quantity: 1 },
        ];
      case "organ-trauma":
        return [
          { supplyId: "gauze", quantity: 1 },
          { supplyId: "painkiller", quantity: 1 },
          { supplyId: "water", quantity: 1 },
        ];
      case "concussion":
        return [
          { supplyId: "water", quantity: 1 },
          { supplyId: "painkiller", quantity: 1 },
        ];
      default:
        return [
          { supplyId: "bandage", quantity: 1 },
          { supplyId: "antiseptic", quantity: 1 },
          { supplyId: "antibiotic", quantity: 1 },
        ];
    }
  }

  switch (injury.category) {
    case "fractured-bone":
    case "dislocated-joint":
      return [
        { supplyId: "splint", quantity: 1 },
        { supplyId: "wrap", quantity: injury.severity === "critical" || injury.severity === "severe" ? 2 : 1 },
        { supplyId: "painkiller", quantity: 1 },
      ];
    case "collapsed-lung":
      return [
        { supplyId: "chest-seal", quantity: 1 },
        { supplyId: "trauma-pack", quantity: 1 },
        { supplyId: "painkiller", quantity: 1 },
      ];
    case "organ-trauma":
      return [
        { supplyId: "pressure-bandage", quantity: 1 },
        { supplyId: "gauze", quantity: 1 },
        { supplyId: "painkiller", quantity: 1 },
      ];
    case "concussion":
      return [
        { supplyId: "water", quantity: 1 },
        { supplyId: "painkiller", quantity: 1 },
      ];
    default:
      return injury.requirements.filter((requirement) => requirement.supplyId !== "trauma-pack") || injury.requirements;
  }
}

export function getCurrentTreatmentTool(injury: InjuryRecord): MedicalSupplyId | undefined {
  if (!injury.stabilized) {
    return injury.requiredTool;
  }

  if (injury.category === "fractured-bone" || injury.category === "dislocated-joint") {
    return "medical-scissors";
  }

  return undefined;
}

export function buildMedicalSummary(params: {
  injuries: InjuryRecord[];
  medicalEvents: MedicalEvent[];
  survivedMs: number;
  causeOfDeath: string | null;
  accuracyWhileInjured?: number | null;
}): MatchMedicalSummary {
  const treatmentAttempts = params.medicalEvents.filter((event) => event.type === "treatment_started").length;
  const treatmentCompletions = params.medicalEvents.filter((event) => event.type === "treatment_completed").length;
  const consumablesUsed = params.medicalEvents.filter((event) => event.type === "consumable_used").map((event) => event.result);

  return {
    totalInjuries: params.injuries.length,
    criticalInjuries: params.injuries.filter((injury) => injury.severity === "critical").length,
    causeOfDeath: params.causeOfDeath,
    treatmentAttempts,
    treatmentSuccessRate: treatmentAttempts > 0 ? treatmentCompletions / treatmentAttempts : 0,
    consumablesUsed,
    survivalDurationMs: params.survivedMs,
    accuracyWhileInjured: params.accuracyWhileInjured ?? null,
  };
}

export function isHighSignalMedicalEvent(type: MedicalEventType) {
  return type === "critical_state_entered" || type === "injury_worsened" || type === "treatment_interrupted" || type === "death";
}

function severityRank(severity: InjurySeverity) {
  if (severity === "critical") return 4;
  if (severity === "severe") return 3;
  if (severity === "moderate") return 2;
  return 1;
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
