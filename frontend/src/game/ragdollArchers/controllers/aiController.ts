import { arrowOrder, difficultyTuning } from "@/game/ragdollArchers/core/constants";
import { clamp, distanceBetween } from "@/game/ragdollArchers/systems/math";
import type { ControllerContext, ControllerIntent } from "@/game/ragdollArchers/controllers/controllerTypes";
import type { ArenaConfig, DifficultyId } from "@/game/ragdollArchers/core/types";

export function computeAiIntent(params: {
  difficulty: DifficultyId;
  arena: ArenaConfig;
  selfPosition: [number, number, number];
  targetPosition: [number, number, number];
  targetVelocity: [number, number, number];
  elapsed: number;
  actorIndex: number;
}): ControllerIntent {
  const { difficulty, arena, selfPosition, targetPosition, targetVelocity, elapsed, actorIndex } = params;
  const tuning = difficultyTuning[difficulty];
  const distance = distanceBetween(selfPosition, targetPosition);
  const coverNode = arena.coverNodes[actorIndex % arena.coverNodes.length] || targetPosition;
  const strafeDirection = actorIndex % 2 === 0 ? 1 : -1;
  const moveBias = distance > 16 ? 1 : distance < 8 ? -0.6 : 0.2;
  const desiredX = clamp((coverNode[0] - selfPosition[0]) * 0.15 + Math.sin(elapsed * 0.7 + actorIndex) * 0.25 * strafeDirection, -1, 1);
  const desiredZ = clamp((coverNode[2] - selfPosition[2]) * 0.15 + moveBias, -1, 1);

  const leadScale = 0.06 + 0.02 * tuning.enemyAccuracy;
  const predictedTarget: [number, number, number] = [
    targetPosition[0] + targetVelocity[0] * leadScale * distance,
    targetPosition[1] + targetVelocity[1] * 0.03,
    targetPosition[2] + targetVelocity[2] * leadScale * distance,
  ];

  const dx = predictedTarget[0] - selfPosition[0];
  const dy = predictedTarget[1] + 1.15 - selfPosition[1];
  const dz = predictedTarget[2] - selfPosition[2];
  const yaw = Math.atan2(dx, dz);
  const pitch = clamp(Math.atan2(dy, Math.max(0.1, Math.hypot(dx, dz))), -0.7, 0.65);
  const drawWindow = 0.65 + tuning.enemyAccuracy * 0.28;
  const pulse = (Math.sin(elapsed * (0.9 + actorIndex * 0.08)) + 1) * 0.5;

  return {
    moveX: desiredX,
    moveZ: desiredZ,
    aimYaw: yaw,
    aimPitch: pitch,
    jump: arena.id === "shatter-isles" && pulse > 0.985,
    sprint: distance > 14,
    drawHeld: pulse < drawWindow,
    drawStarted: false,
    drawReleased: pulse >= drawWindow && pulse < drawWindow + 0.04,
    selectedArrowType: arrowOrder[(actorIndex + Math.floor(elapsed / 9)) % arrowOrder.length],
  };
}
