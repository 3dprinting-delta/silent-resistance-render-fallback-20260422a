"use client";

import { EntityId } from "@/game/scpNightwatch/core/types";

type CueName = "camera" | "door" | "light" | "alarm" | "footstep" | "breathing" | "impact" | "powerdown" | "static" | "metal" | "echo";

export class NightwatchAudioRuntime {
  context: AudioContext | null = null;
  master: GainNode | null = null;
  ambient: OscillatorNode | null = null;
  ambientGain: GainNode | null = null;
  subAmbient: OscillatorNode | null = null;
  subAmbientGain: GainNode | null = null;
  tensionGain: GainNode | null = null;
  threatLevel = 0;
  silenceActive = false;
  lastCueAt = new Map<CueName, number>();

  ensureReady() {
    if (typeof window === "undefined") return;
    if (!this.context) {
      const AudioCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtor) return;
      this.context = new AudioCtor();
      this.master = this.context.createGain();
      this.master.gain.value = 0.12;
      this.master.connect(this.context.destination);
      this.ambientGain = this.context.createGain();
      this.ambientGain.gain.value = 0.05;
      this.ambientGain.connect(this.master);
      this.ambient = this.context.createOscillator();
      this.ambient.type = "sawtooth";
      this.ambient.frequency.value = 42;
      this.ambient.connect(this.ambientGain);
      this.ambient.start();
      this.subAmbientGain = this.context.createGain();
      this.subAmbientGain.gain.value = 0.024;
      this.subAmbientGain.connect(this.master);
      this.subAmbient = this.context.createOscillator();
      this.subAmbient.type = "triangle";
      this.subAmbient.frequency.value = 87;
      this.subAmbient.connect(this.subAmbientGain);
      this.subAmbient.start();
      this.tensionGain = this.context.createGain();
      this.tensionGain.gain.value = 0.0001;
      this.tensionGain.connect(this.master);
    }
    if (this.context.state === "suspended") {
      void this.context.resume();
    }
  }

  setEmergencyMode(active: boolean) {
    this.ensureReady();
    if (!this.context || !this.ambientGain || !this.ambient || !this.subAmbientGain || !this.subAmbient) return;
    const now = this.context.currentTime;
    this.ambient.frequency.cancelScheduledValues(now);
    this.ambient.frequency.linearRampToValueAtTime(active ? 31 : 42, now + 0.6);
    this.ambientGain.gain.cancelScheduledValues(now);
    this.ambientGain.gain.linearRampToValueAtTime(active ? 0.09 : 0.05, now + 0.6);
    this.subAmbient.frequency.cancelScheduledValues(now);
    this.subAmbient.frequency.linearRampToValueAtTime(active ? 62 : 87, now + 0.8);
    this.subAmbientGain.gain.cancelScheduledValues(now);
    this.subAmbientGain.gain.linearRampToValueAtTime(active ? 0.048 : 0.024, now + 0.8);
  }

  setThreatLevel(level: number) {
    this.ensureReady();
    if (!this.context || !this.tensionGain || !this.ambientGain || !this.subAmbientGain || !this.ambient || !this.subAmbient) return;
    const nextLevel = Math.max(0, Math.min(1, level));
    if (Math.abs(nextLevel - this.threatLevel) < 0.025) return;
    const previousLevel = this.threatLevel;
    this.threatLevel = nextLevel;
    const now = this.context.currentTime;
    this.tensionGain.gain.cancelScheduledValues(now);
    this.ambientGain.gain.cancelScheduledValues(now);
    this.subAmbientGain.gain.cancelScheduledValues(now);
    this.ambient.frequency.cancelScheduledValues(now);
    this.subAmbient.frequency.cancelScheduledValues(now);
    this.tensionGain.gain.linearRampToValueAtTime((this.silenceActive ? 0.0001 : 0.0001 + nextLevel * 0.035), now + 0.4);
    this.ambientGain.gain.linearRampToValueAtTime(this.silenceActive ? 0.004 : 0.05 + nextLevel * 0.024, now + 0.7);
    this.subAmbientGain.gain.linearRampToValueAtTime(this.silenceActive ? 0.002 : 0.024 + nextLevel * 0.016, now + 0.8);
    this.ambient.frequency.linearRampToValueAtTime(42 - nextLevel * 7, now + 0.75);
    this.subAmbient.frequency.linearRampToValueAtTime(87 - nextLevel * 11, now + 0.85);
    if (nextLevel > 0.76 && previousLevel <= 0.76) {
      this.pulse(132, 0.52, "triangle", 0.018, 0.18);
    }
    if (nextLevel > 0.78) {
      this.pulse(164 + nextLevel * 28, 0.42, "triangle", 0.028 + nextLevel * 0.02, 0.22);
    } else if (nextLevel < 0.1) {
      this.tensionGain.gain.linearRampToValueAtTime(0.0001, now + 1.6);
    }
  }

  setSilence(active: boolean) {
    this.ensureReady();
    if (!this.context || !this.master || !this.ambientGain || !this.subAmbientGain || !this.tensionGain) return;
    this.silenceActive = active;
    const now = this.context.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.ambientGain.gain.cancelScheduledValues(now);
    this.subAmbientGain.gain.cancelScheduledValues(now);
    this.tensionGain.gain.cancelScheduledValues(now);
    this.master.gain.linearRampToValueAtTime(active ? 0.03 : 0.12, now + 0.12);
    this.ambientGain.gain.linearRampToValueAtTime(active ? 0.004 : 0.05, now + 0.16);
    this.subAmbientGain.gain.linearRampToValueAtTime(active ? 0.002 : 0.024, now + 0.16);
    this.tensionGain.gain.linearRampToValueAtTime(active ? 0.0001 : 0.0001 + this.threatLevel * 0.035, now + 0.18);
  }

  resetSessionAudio(immediate = false) {
    this.ensureReady();
    if (!this.context || !this.master || !this.ambientGain || !this.subAmbientGain || !this.tensionGain || !this.ambient || !this.subAmbient) return;
    const now = this.context.currentTime;
    const ramp = immediate ? 0.01 : 0.16;
    this.threatLevel = 0;
    this.silenceActive = false;
    this.lastCueAt.clear();
    this.master.gain.cancelScheduledValues(now);
    this.ambientGain.gain.cancelScheduledValues(now);
    this.subAmbientGain.gain.cancelScheduledValues(now);
    this.tensionGain.gain.cancelScheduledValues(now);
    this.ambient.frequency.cancelScheduledValues(now);
    this.subAmbient.frequency.cancelScheduledValues(now);
    this.master.gain.linearRampToValueAtTime(0.12, now + ramp);
    this.ambientGain.gain.linearRampToValueAtTime(0.05, now + ramp);
    this.subAmbientGain.gain.linearRampToValueAtTime(0.024, now + ramp);
    this.tensionGain.gain.linearRampToValueAtTime(0.0001, now + ramp);
    this.ambient.frequency.linearRampToValueAtTime(42, now + ramp);
    this.subAmbient.frequency.linearRampToValueAtTime(87, now + ramp);
  }

  private pulse(frequency: number, duration: number, type: OscillatorType = "square", gainValue = 0.07, delay = 0) {
    this.ensureReady();
    if (!this.context || !this.master) return;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.value = gainValue;
    osc.connect(gain);
    gain.connect(this.master);
    const now = this.context.currentTime;
    const startTime = now + delay;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.setValueAtTime(gainValue, startTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    osc.start(startTime);
    osc.stop(startTime + duration);
  }

  playCue(name: CueName, entity?: EntityId) {
    this.ensureReady();
    const nowMs = this.context ? this.context.currentTime * 1000 : Date.now();
    const lastCue = this.lastCueAt.get(name) ?? -10_000;
    const minimumSpacing =
      name === "camera" ? 90
      : name === "light" ? 80
      : name === "door" ? 120
      : name === "alarm" ? 220
      : name === "breathing" ? 260
      : name === "footstep" ? 110
      : name === "impact" ? 320
      : name === "static" ? 180
      : name === "metal" ? 220
      : name === "echo" ? 260
      : 400;
    if (nowMs - lastCue < minimumSpacing) return;
    this.lastCueAt.set(name, nowMs);
    switch (name) {
      case "camera":
        this.pulse(188, 0.08, "square", 0.05);
        break;
      case "door":
        this.pulse(90, 0.2, "sawtooth", 0.08);
        break;
      case "light":
        this.pulse(620, 0.06, "square", 0.03);
        break;
      case "alarm":
        this.pulse(730, 0.18, "triangle", 0.07);
        this.pulse(520, 0.22, "triangle", 0.05);
        break;
      case "footstep":
        this.pulse(entity === "scp173" ? 56 : 74, 0.15, "sawtooth", 0.07);
        break;
      case "breathing":
        this.pulse(220, 0.3, "triangle", 0.05);
        break;
      case "impact":
        this.pulse(44, 0.36, "square", 0.1);
        break;
      case "powerdown":
        this.pulse(120, 0.8, "sawtooth", 0.09);
        break;
      case "static":
        this.pulse(1480, 0.05, "square", 0.035);
        this.pulse(960, 0.08, "square", 0.018, 0.02);
        break;
      case "metal":
        this.pulse(128, 0.16, "triangle", 0.045);
        this.pulse(212, 0.12, "triangle", 0.028, 0.04);
        break;
      case "echo":
        this.pulse(412, 0.08, "triangle", 0.026);
        this.pulse(286, 0.12, "triangle", 0.018, 0.08);
        break;
      default:
        break;
    }
  }
}

export const nightwatchAudio = new NightwatchAudioRuntime();
