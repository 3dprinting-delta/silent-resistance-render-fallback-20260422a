import { DoorSide, LockdownState } from "@/game/scpNightwatch/core/types";

export function computePowerDrain(params: {
  cameraMonitorOpen: boolean;
  doors: Record<DoorSide, boolean>;
  lights: Record<DoorSide, boolean>;
  lockdown: LockdownState;
  nearbyThreatPressure?: boolean;
}): number {
  return (
    0.11 +
    (params.cameraMonitorOpen ? 0.08 : 0) +
    (params.doors.left ? 0.11 : 0) +
    (params.doors.right ? 0.11 : 0) +
    (params.lights.left ? 0.09 : 0) +
    (params.lights.right ? 0.09 : 0) +
    (params.lockdown.active ? 0.33 : 0) +
    (params.nearbyThreatPressure ? 0.04 : 0)
  );
}

export function applyPowerTick(currentPower: number, deltaMs: number, drainRate: number): { power: number; emergencyMode: boolean } {
  const power = Math.max(0, currentPower - drainRate * (deltaMs / 1000));
  return {
    power,
    emergencyMode: power <= 0.001,
  };
}

