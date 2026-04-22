import type { ArrowType } from "@/game/ragdollArchers/core/types";

export interface ControllerIntent {
  moveX: number;
  moveZ: number;
  aimYaw: number;
  aimPitch: number;
  jump: boolean;
  sprint: boolean;
  drawHeld: boolean;
  drawStarted: boolean;
  drawReleased: boolean;
  selectedArrowType: ArrowType;
}

export interface ControllerContext {
  actorId: string;
  actorPosition: [number, number, number];
  targetPosition?: [number, number, number];
  targetVelocity?: [number, number, number];
  wind: [number, number, number];
  elapsed: number;
}

export interface HumanController {
  kind: "human";
  readIntent: () => ControllerIntent;
}

export interface AiController {
  kind: "ai";
  readIntent: (context: ControllerContext) => ControllerIntent;
}

export interface RemoteController {
  kind: "remote";
  readIntent: () => ControllerIntent;
}
