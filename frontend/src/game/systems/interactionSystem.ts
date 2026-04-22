import type { InteractableDefinition, PhaseOneGateState, Vec3 } from "@/game/core/types";
function distance3D(a: Vec3, b: Vec3) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

export function getNearestInteractable(playerPosition: Vec3, interactables: InteractableDefinition[], maxDistance = 2.6) {
  let nearest: InteractableDefinition | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const interactable of interactables) {
    const verticalGap = Math.abs(playerPosition[1] - interactable.position[1]);
    const currentDistance = distance3D(playerPosition, interactable.position);
    if (verticalGap <= 1.6 && currentDistance <= maxDistance && currentDistance < nearestDistance) {
      nearest = interactable;
      nearestDistance = currentDistance;
    }
  }

  return nearest;
}

export function applyInteractionEffects(params: {
  interactable: InteractableDefinition;
  gateStates: Record<string, PhaseOneGateState>;
  toggleGate: (gateId: string) => boolean;
  setPlayerPosition: (position: Vec3) => void;
  setDisguise: (disguiseId: NonNullable<InteractableDefinition["disguise"]>) => void;
  toggleCarryBody: (bodyId: string) => boolean;
  markSabotage: (sabotageId: string) => void;
  addSuspicion: (delta: number) => void;
  markIllegalAction: (action: string) => void;
  acquirePoison: () => void;
  preparePoison: () => boolean;
  armAccident: () => void;
  completeSecondaryObjective: () => void;
  unlockRoute: (routeId: "annex" | "basement" | "terrace") => void;
  queueTargetDetour: (detour: "none" | "annex_inspection" | "ballroom_recovery" | "vip_fallback") => void;
  splitEscort: (split: "none" | "annex" | "service" | "security") => void;
  advanceSecondaryObjective: (source: "security_hub" | "annex_transfer") => void;
  attemptCloseElimination: (radius: number) => boolean;
  stashBody: () => boolean;
  extractMission: () => boolean;
}) {
  const messages: string[] = [];

  for (const effect of params.interactable.effects || []) {
    if (effect.type === "message") {
      messages.push(effect.message);
    }

    if (effect.type === "teleport") {
      params.setPlayerPosition(effect.destination);
      messages.push(effect.message);
    }

    if (effect.type === "toggleGate") {
      const open = params.toggleGate(effect.gateId);
      messages.push(open ? effect.openMessage : effect.closedMessage);
    }

    if (effect.type === "equipDisguise") {
      params.setDisguise(effect.disguiseId);
      messages.push(effect.message);
    }

    if (effect.type === "toggleCarryBody") {
      const carrying = params.toggleCarryBody(effect.bodyId);
      params.markIllegalAction("body");
      messages.push(carrying ? effect.pickMessage : effect.dropMessage);
    }

    if (effect.type === "markSabotage") {
      params.markSabotage(effect.sabotageId);
      params.addSuspicion(effect.suspicionBurst);
      params.markIllegalAction("sabotage");
      messages.push(effect.message);
    }

    if (effect.type === "acquirePoison") {
      params.acquirePoison();
      messages.push(effect.message);
    }

    if (effect.type === "preparePoison") {
      const prepared = params.preparePoison();
      if (!prepared) {
        messages.push(effect.failMessage);
      } else {
        params.markIllegalAction("poison");
        messages.push(effect.message);
      }
    }

    if (effect.type === "armAccident") {
      params.armAccident();
      if (effect.suspicionBurst) params.addSuspicion(effect.suspicionBurst);
      params.markIllegalAction("accident");
      messages.push(effect.message);
    }

    if (effect.type === "collectObjective") {
      params.completeSecondaryObjective();
      messages.push(effect.message);
    }

    if (effect.type === "unlockRoute") {
      params.unlockRoute(effect.routeId);
      messages.push(effect.message);
    }

    if (effect.type === "queueTargetDetour") {
      params.queueTargetDetour(effect.detour);
      messages.push(effect.message);
    }

    if (effect.type === "splitEscort") {
      params.splitEscort(effect.split);
      messages.push(effect.message);
    }

    if (effect.type === "advanceSecondaryObjective") {
      params.advanceSecondaryObjective(effect.source);
      messages.push(effect.message);
    }

    if (effect.type === "attemptCloseElimination") {
      const success = params.attemptCloseElimination(effect.radius);
      messages.push(success ? effect.successMessage : effect.failMessage);
    }

    if (effect.type === "stashBody") {
      const success = params.stashBody();
      messages.push(success ? effect.message : effect.failMessage);
    }

    if (effect.type === "extractMission") {
      const success = params.extractMission();
      messages.push(success ? effect.successMessage : effect.failMessage);
    }
  }

  return messages;
}
