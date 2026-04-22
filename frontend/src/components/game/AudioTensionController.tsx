"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useCampaignStore } from "@/game/core/campaignStore";
import { usePhaseOneStore } from "@/game/core/phaseOneStore";
import type { AudioTensionState } from "@/game/core/types";

type AudioCueName = "near_detection" | "body_discovered" | "target_isolated" | "objective_complete" | "extraction_open" | "mission_result" | "danger_spike";

type RuntimeLayerProfile = {
  droneLevel: number;
  pulseLevel: number;
  noiseLevel: number;
  filterFrequency: number;
  pulseRate: number;
};

type AudioRuntime = {
  context: AudioContext;
  master: GainNode;
  droneGain: GainNode;
  pulseGain: GainNode;
  noiseGain: GainNode;
  droneOsc: OscillatorNode;
  pulseOsc: OscillatorNode;
  pulseTone: OscillatorNode;
  noiseSource: AudioBufferSourceNode;
  noiseFilter: BiquadFilterNode;
};

const layerProfiles: Record<AudioTensionState, RuntimeLayerProfile> = {
  calm: { droneLevel: 0.018, pulseLevel: 0.002, noiseLevel: 0.001, filterFrequency: 360, pulseRate: 0.6 },
  suspicion: { droneLevel: 0.03, pulseLevel: 0.015, noiseLevel: 0.004, filterFrequency: 520, pulseRate: 1.1 },
  investigation: { droneLevel: 0.05, pulseLevel: 0.03, noiseLevel: 0.008, filterFrequency: 760, pulseRate: 1.8 },
  alert: { droneLevel: 0.07, pulseLevel: 0.05, noiseLevel: 0.014, filterFrequency: 1100, pulseRate: 2.5 },
  crisis: { droneLevel: 0.09, pulseLevel: 0.075, noiseLevel: 0.02, filterFrequency: 1600, pulseRate: 3.4 },
};

function createNoiseBuffer(context: AudioContext) {
  const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < data.length; index += 1) {
    data[index] = (Math.random() * 2 - 1) * 0.4;
  }
  return buffer;
}

function ramp(audioParam: AudioParam, value: number, duration = 0.45, context?: AudioContext) {
  const now = context?.currentTime || 0;
  audioParam.cancelScheduledValues(now);
  audioParam.setValueAtTime(audioParam.value, now);
  audioParam.linearRampToValueAtTime(value, now + duration);
}

function createAudioRuntime(): AudioRuntime | null {
  const ContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!ContextCtor) return null;

  const context = new ContextCtor();
  const master = context.createGain();
  master.gain.value = 0;
  master.connect(context.destination);

  const droneGain = context.createGain();
  droneGain.gain.value = 0;
  const pulseGain = context.createGain();
  pulseGain.gain.value = 0;
  const noiseGain = context.createGain();
  noiseGain.gain.value = 0;

  const droneOsc = context.createOscillator();
  droneOsc.type = "sawtooth";
  droneOsc.frequency.value = 58;
  const pulseOsc = context.createOscillator();
  pulseOsc.type = "triangle";
  pulseOsc.frequency.value = 0.6;

  const pulseDepth = context.createGain();
  pulseDepth.gain.value = 0.01;
  pulseOsc.connect(pulseDepth);
  pulseDepth.connect(droneGain.gain);

  const droneFilter = context.createBiquadFilter();
  droneFilter.type = "lowpass";
  droneFilter.frequency.value = 900;

  const noiseSource = context.createBufferSource();
  noiseSource.buffer = createNoiseBuffer(context);
  noiseSource.loop = true;
  const noiseFilter = context.createBiquadFilter();
  noiseFilter.type = "bandpass";
  noiseFilter.frequency.value = 360;
  noiseFilter.Q.value = 0.8;

  droneOsc.connect(droneFilter);
  droneFilter.connect(droneGain);
  droneGain.connect(master);

  const pulseTone = context.createOscillator();
  pulseTone.type = "sine";
  pulseTone.frequency.value = 168;
  const pulseToneGain = context.createGain();
  pulseToneGain.gain.value = 0.02;
  pulseOsc.connect(pulseToneGain.gain);
  pulseTone.connect(pulseGain);
  pulseGain.connect(master);
  pulseToneGain.connect(pulseTone.frequency);

  noiseSource.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(master);

  droneOsc.start();
  pulseOsc.start();
  pulseTone.start();
  noiseSource.start();

  return { context, master, droneGain, pulseGain, noiseGain, droneOsc, pulseOsc, pulseTone, noiseSource, noiseFilter };
}

function deriveAudioState(params: {
  suspicion: number;
  accessState: string;
  activeWatchers: number;
  activeIncidents: number;
  globalAlertLevel: number;
  targetWindowState: string;
  extractionRisk: string;
  missionComplete: boolean;
}) {
  if (params.missionComplete || params.globalAlertLevel >= 3 || (params.extractionRisk === "severe" && params.activeIncidents > 2)) {
    return "crisis" as const;
  }
  if (params.globalAlertLevel >= 2 || params.suspicion >= 72 || params.activeIncidents >= 3) {
    return "alert" as const;
  }
  if (params.activeIncidents > 0 || params.activeWatchers >= 2 || params.suspicion >= 40 || params.targetWindowState === "vulnerable") {
    return "investigation" as const;
  }
  if (params.accessState !== "legal" || params.activeWatchers > 0 || params.suspicion >= 18) {
    return "suspicion" as const;
  }
  return "calm" as const;
}

export default function AudioTensionController() {
  const selectedOperation = useCampaignStore((state) => state.getSelectedOperation());
  const onboardingStage = useCampaignStore((state) => state.progress.onboardingStage);
  const suspicion = usePhaseOneStore((state) => state.suspicion);
  const accessState = usePhaseOneStore((state) => state.accessState);
  const activeWatchers = usePhaseOneStore((state) => state.activeWatcherIds.length);
  const activeIncidents = usePhaseOneStore((state) => state.activeIncidents.length);
  const targetWindowState = usePhaseOneStore((state) => state.targetWindowState);
  const globalAlertLevel = usePhaseOneStore((state) => state.globalAlertLevel);
  const mission = usePhaseOneStore((state) => state.mission);
  const extractionRisk = usePhaseOneStore((state) => state.missionPressure.extractionRisk);
  const missionStartTime = usePhaseOneStore((state) => state.missionStartTime);

  const audioEnabled = useCampaignStore((state) => state.audioEnabled);
  const audioUnlocked = useCampaignStore((state) => state.audioUnlocked);
  const setAudioEnabled = useCampaignStore((state) => state.setAudioEnabled);
  const setAudioState = useCampaignStore((state) => state.setAudioState);
  const unlockAudio = useCampaignStore((state) => state.unlockAudio);

  const runtimeRef = useRef<AudioRuntime | null>(null);
  const previousStateRef = useRef<AudioTensionState>("calm");
  const previousIncidentCountRef = useRef(0);
  const previousVulnerabilityRef = useRef(targetWindowState);
  const previousMissionResolvedRef = useRef(false);
  const previousSecondaryObjectiveRef = useRef(false);
  const previousTargetEliminationRef = useRef(false);
  const previousMomentCountRef = useRef(0);
  const firstScareCueFiredRef = useRef(false);
  const [audioClock, setAudioClock] = useState(() => Date.now());
  const isIntroOnboarding = onboardingStage === "first_run" && selectedOperation?.variantId === "azure-summit-fall";
  const calmStartActive = isIntroOnboarding && audioClock - missionStartTime < 15000;

  const audioState = useMemo(
    () =>
      calmStartActive
        ? ("calm" as const)
        : deriveAudioState({
            suspicion,
            accessState,
            activeWatchers,
            activeIncidents,
            globalAlertLevel,
            targetWindowState,
            extractionRisk,
            missionComplete: mission.missionComplete,
          }),
    [accessState, activeIncidents, activeWatchers, calmStartActive, extractionRisk, globalAlertLevel, mission.missionComplete, suspicion, targetWindowState],
  );

  useEffect(() => {
    if (!isIntroOnboarding) return;
    setAudioClock(Date.now());
    firstScareCueFiredRef.current = false;
    const intervalId = window.setInterval(() => {
      setAudioClock(Date.now());
    }, 500);
    return () => window.clearInterval(intervalId);
  }, [isIntroOnboarding, missionStartTime]);

  useEffect(() => {
    const activateAudio = async () => {
      if (runtimeRef.current) {
        if (runtimeRef.current.context.state === "suspended") {
          await runtimeRef.current.context.resume();
        }
        unlockAudio();
        return;
      }

      const runtime = createAudioRuntime();
      if (!runtime) return;
      runtimeRef.current = runtime;
      await runtime.context.resume();
      unlockAudio();
    };

    const handleUserGesture = () => {
      void activateAudio();
    };

    window.addEventListener("pointerdown", handleUserGesture, { once: true });
    window.addEventListener("keydown", handleUserGesture, { once: true });
    return () => {
      window.removeEventListener("pointerdown", handleUserGesture);
      window.removeEventListener("keydown", handleUserGesture);
    };
  }, [unlockAudio]);

  useEffect(() => {
    setAudioState(audioState);
  }, [audioState, setAudioState]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime || !audioUnlocked) return;
    const profile = layerProfiles[audioState];
    const sonicIdentity = selectedOperation?.story.delivery.sonicIdentity || "cold_hum";
    const sonicBias =
      sonicIdentity === "luxury_dread"
        ? { drone: 1.12, pulse: 0.86, noise: 0.82, filter: 0.88, droneHz: 62 }
        : sonicIdentity === "industrial_pulse"
          ? { drone: 0.94, pulse: 1.28, noise: 1.2, filter: 1.3, droneHz: 54 }
          : sonicIdentity === "fracture_static"
            ? { drone: 0.98, pulse: 1.08, noise: 1.34, filter: 1.12, droneHz: 66 }
            : { drone: 1, pulse: 1, noise: 1, filter: 1, droneHz: 58 };
    const calmProfile = calmStartActive
      ? {
          master: audioEnabled ? 0.18 : 0,
          drone: audioEnabled ? 0.0058 * sonicBias.drone : 0,
          pulse: 0,
          noise: audioEnabled ? 0.0016 * sonicBias.noise : 0,
          filter: 320,
          droneHz: 52,
          duration: 0.9,
        }
      : null;
    const targetMaster = calmProfile ? calmProfile.master : audioEnabled ? 0.72 : 0;
    ramp(runtime.master.gain, targetMaster, 0.35, runtime.context);
    ramp(runtime.droneGain.gain, calmProfile ? calmProfile.drone : audioEnabled ? profile.droneLevel * sonicBias.drone : 0, calmProfile?.duration || 0.55, runtime.context);
    ramp(runtime.pulseGain.gain, calmProfile ? calmProfile.pulse : audioEnabled ? profile.pulseLevel * sonicBias.pulse : 0, calmProfile?.duration || 0.5, runtime.context);
    ramp(runtime.noiseGain.gain, calmProfile ? calmProfile.noise : audioEnabled ? profile.noiseLevel * sonicBias.noise : 0, calmProfile?.duration || 0.45, runtime.context);
    ramp(runtime.pulseOsc.frequency, calmProfile ? 0.4 : profile.pulseRate, calmProfile?.duration || 0.5, runtime.context);
    ramp(runtime.noiseFilter.frequency, calmProfile ? calmProfile.filter : profile.filterFrequency * sonicBias.filter, calmProfile?.duration || 0.45, runtime.context);
    ramp(runtime.droneOsc.frequency, calmProfile ? calmProfile.droneHz : sonicBias.droneHz, calmProfile?.duration || 0.45, runtime.context);
  }, [audioEnabled, audioState, audioUnlocked, calmStartActive, selectedOperation]);

  useEffect(() => {
    if (!audioUnlocked) return;
    const runtime = runtimeRef.current;
    if (!runtime) return;

    let cueFiredThisPass = false;

    const fireCue = (event: AudioCueName) => {
      if (cueFiredThisPass) return;
      const cueOsc = runtime.context.createOscillator();
      const cueGain = runtime.context.createGain();
      cueOsc.type = event === "near_detection" || event === "body_discovered" ? "square" : "sine";
      cueOsc.frequency.value =
        event === "body_discovered"
          ? 122
          : event === "target_isolated"
            ? 264
            : event === "objective_complete"
              ? 310
              : event === "extraction_open"
                ? 208
                : event === "mission_result"
                  ? 156
                  : 176;
      cueGain.gain.value = 0.0001;
      cueOsc.connect(cueGain);
      cueGain.connect(runtime.master);
      const now = runtime.context.currentTime;
      cueGain.gain.exponentialRampToValueAtTime(0.048, now + 0.02);
      cueGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
      cueOsc.start(now);
      cueOsc.stop(now + 0.2);
      cueFiredThisPass = true;
    };

    if (calmStartActive) {
      previousStateRef.current = "calm";
      previousIncidentCountRef.current = activeIncidents;
      previousVulnerabilityRef.current = targetWindowState;
      previousMissionResolvedRef.current = mission.missionComplete;
      previousSecondaryObjectiveRef.current = mission.secondaryObjectiveComplete;
      previousTargetEliminationRef.current = mission.targetEliminated;
      previousMomentCountRef.current = mission.notableMoments.length;
      return;
    }

    const firstScareTriggered =
      !firstScareCueFiredRef.current &&
      isIntroOnboarding &&
      !calmStartActive &&
      (audioState === "investigation" || audioState === "alert" || audioState === "crisis" || suspicion >= 24 || activeWatchers > 0);
    if (firstScareTriggered) {
      fireCue("near_detection");
      firstScareCueFiredRef.current = true;
    }

    if (previousStateRef.current !== audioState) {
      if (!firstScareTriggered && (audioState === "investigation" || audioState === "alert" || audioState === "crisis")) {
        fireCue(audioState === "investigation" ? "near_detection" : "danger_spike");
      }
      previousStateRef.current = audioState;
    }

    if (activeIncidents > previousIncidentCountRef.current) {
      fireCue("body_discovered");
    }
    previousIncidentCountRef.current = activeIncidents;

    if (previousVulnerabilityRef.current !== "vulnerable" && targetWindowState === "vulnerable") {
      fireCue("target_isolated");
    }
    previousVulnerabilityRef.current = targetWindowState;

    if (!previousMissionResolvedRef.current && mission.extractionReady) {
      fireCue("extraction_open");
    }
    if (!previousSecondaryObjectiveRef.current && mission.secondaryObjectiveComplete) {
      fireCue("objective_complete");
    }
    if (!previousTargetEliminationRef.current && mission.targetEliminated) {
      fireCue("objective_complete");
    }
    if (!previousMissionResolvedRef.current && mission.missionComplete) {
      fireCue("mission_result");
    }
    previousSecondaryObjectiveRef.current = mission.secondaryObjectiveComplete;
    previousTargetEliminationRef.current = mission.targetEliminated;
    previousMissionResolvedRef.current = mission.missionComplete;
    if (mission.notableMoments.length > previousMomentCountRef.current) {
      fireCue("danger_spike");
    }
    previousMomentCountRef.current = mission.notableMoments.length;
  }, [activeIncidents, activeWatchers, audioState, audioUnlocked, calmStartActive, isIntroOnboarding, mission.extractionReady, mission.missionComplete, mission.notableMoments.length, mission.secondaryObjectiveComplete, mission.targetEliminated, suspicion, targetWindowState]);

  useEffect(
    () => () => {
      const runtime = runtimeRef.current;
      if (!runtime) return;
      runtime.droneOsc.stop();
      runtime.pulseOsc.stop();
      runtime.pulseTone.stop();
      runtime.noiseSource.stop();
      void runtime.context.close();
      runtimeRef.current = null;
    },
    [],
  );

  useEffect(() => {
    if (audioUnlocked && !audioEnabled) {
      setAudioEnabled(true);
    }
  }, [audioEnabled, audioUnlocked, setAudioEnabled]);

  return null;
}
