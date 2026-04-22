"use client";

import { useEffect, useRef } from "react";
import { useRagdollArchersStore } from "@/game/ragdollArchers/core/store";
import type { ArrowType } from "@/game/ragdollArchers/core/types";

export interface PlayerInputState {
  moveX: number;
  moveZ: number;
  sprint: boolean;
  jump: boolean;
  drawHeld: boolean;
  drawStarted: boolean;
  drawReleased: boolean;
  yaw: number;
  pitch: number;
  pointerLocked: boolean;
  cycleQueued: 0 | 1 | -1;
  selectedArrowType: ArrowType;
}

export function usePlayerInput(canvasContainerRef: React.RefObject<HTMLDivElement | null>) {
  const cycleArrowType = useRagdollArchersStore((state) => state.cycleArrowType);
  const activeArrowType = useRagdollArchersStore((state) => state.activeArrowType);
  const inputRef = useRef<PlayerInputState>({
    moveX: 0,
    moveZ: 0,
    sprint: false,
    jump: false,
    drawHeld: false,
    drawStarted: false,
    drawReleased: false,
    yaw: 0,
    pitch: -0.14,
    pointerLocked: false,
    cycleQueued: 0,
    selectedArrowType: activeArrowType,
  });

  useEffect(() => {
    inputRef.current.selectedArrowType = activeArrowType;
  }, [activeArrowType]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    try {
      const down = new Set<string>();

      const updateAxes = () => {
        inputRef.current.moveX = (down.has("KeyD") ? 1 : 0) - (down.has("KeyA") ? 1 : 0);
        inputRef.current.moveZ = (down.has("KeyW") ? 1 : 0) - (down.has("KeyS") ? 1 : 0);
        inputRef.current.sprint = down.has("ShiftLeft") || down.has("ShiftRight");
      };

      const handleKeyDown = (event: KeyboardEvent) => {
        down.add(event.code);
        updateAxes();

        if (event.code === "Space") {
          inputRef.current.jump = true;
        }
        if (event.code === "KeyQ" && !event.repeat) {
          cycleArrowType(1);
        }
      };

      const handleKeyUp = (event: KeyboardEvent) => {
        down.delete(event.code);
        updateAxes();
      };

      const handlePointerLock = () => {
        if (typeof document === "undefined") return;
        inputRef.current.pointerLocked = document.pointerLockElement === canvasContainerRef.current;
      };

      const handleMouseMove = (event: MouseEvent) => {
        if (!inputRef.current.pointerLocked) return;
        inputRef.current.yaw -= event.movementX * 0.0025;
        inputRef.current.pitch = Math.max(-1.15, Math.min(0.95, inputRef.current.pitch - event.movementY * 0.002));
      };

      const handleMouseDown = (event: MouseEvent) => {
        if (event.button !== 0) return;
        if (!inputRef.current.pointerLocked && typeof document !== "undefined") {
          try {
            canvasContainerRef.current?.requestPointerLock();
          } catch (error) {
            console.error("Recovered error: player-input-pointer-lock", error);
          }
        }
        inputRef.current.drawHeld = true;
        inputRef.current.drawStarted = true;
      };

      const handleMouseUp = (event: MouseEvent) => {
        if (event.button !== 0) return;
        inputRef.current.drawHeld = false;
        inputRef.current.drawReleased = true;
      };

      const handleBlur = () => {
        down.clear();
        updateAxes();
        inputRef.current.drawHeld = false;
      };

      window.addEventListener("keydown", handleKeyDown);
      window.addEventListener("keyup", handleKeyUp);
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mousedown", handleMouseDown);
      window.addEventListener("mouseup", handleMouseUp);
      window.addEventListener("blur", handleBlur);
      document.addEventListener("pointerlockchange", handlePointerLock);

      return () => {
        window.removeEventListener("keydown", handleKeyDown);
        window.removeEventListener("keyup", handleKeyUp);
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mousedown", handleMouseDown);
        window.removeEventListener("mouseup", handleMouseUp);
        window.removeEventListener("blur", handleBlur);
        document.removeEventListener("pointerlockchange", handlePointerLock);
      };
    } catch (error) {
      console.error("Recovered error: player-input-setup", error);
      return;
    }
  }, [canvasContainerRef, cycleArrowType]);

  return inputRef;
}

export function consumePlayerInputFrame(inputRef: React.MutableRefObject<PlayerInputState>) {
  const snapshot = { ...inputRef.current };
  inputRef.current.jump = false;
  inputRef.current.drawStarted = false;
  inputRef.current.drawReleased = false;
  return snapshot;
}
