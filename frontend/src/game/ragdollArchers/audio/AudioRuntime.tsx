"use client";

import { useEffect, useRef } from "react";
import { useRagdollArchersStore } from "@/game/ragdollArchers/core/store";
import type { AudioEvent } from "@/game/ragdollArchers/core/types";

function playEvent(audioContext: AudioContext, event: AudioEvent) {
  const now = audioContext.currentTime;

  if (event.kind === "draw" || event.kind === "release" || event.kind === "whistle") {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = event.kind === "release" ? "triangle" : "sine";
    oscillator.frequency.setValueAtTime(event.kind === "whistle" ? 450 : 180 + event.strength * 140, now);
    oscillator.frequency.exponentialRampToValueAtTime(event.kind === "release" ? 860 : 340, now + 0.12);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.04 + event.strength * 0.03, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.16);
    return;
  }

  const bufferSize = audioContext.sampleRate * 0.18;
  const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let index = 0; index < bufferSize; index += 1) {
    channel[index] = (Math.random() * 2 - 1) * (1 - index / bufferSize);
  }
  const source = audioContext.createBufferSource();
  source.buffer = buffer;
  const filter = audioContext.createBiquadFilter();
  filter.type = event.kind === "explosion" ? "lowpass" : "bandpass";
  filter.frequency.value = event.kind === "explosion" ? 380 : 1200;
  const gain = audioContext.createGain();
  gain.gain.setValueAtTime(event.kind === "explosion" ? 0.18 : 0.1, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + (event.kind === "explosion" ? 0.28 : 0.18));
  source.connect(filter).connect(gain).connect(audioContext.destination);
  source.start(now);
}

export function AudioRuntime() {
  const shiftAudioEvent = useRagdollArchersStore((state) => state.shiftAudioEvent);
  const contextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let raf = 0;

    const pump = () => {
      try {
        if (!contextRef.current && typeof window !== "undefined") {
          const AudioCtor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
          if (AudioCtor) contextRef.current = new AudioCtor();
        }

        const context = contextRef.current;
        if (context) {
          const event = shiftAudioEvent();
          if (event) {
            if (context.state === "suspended") void context.resume().catch((error) => console.error("Recovered error: audio-resume", error));
            playEvent(context, event);
          }
        }
      } catch (error) {
        console.error("Recovered error: audio-pump", error);
      }

      raf = window.requestAnimationFrame(pump);
    };

    raf = window.requestAnimationFrame(pump);
    return () => {
      window.cancelAnimationFrame(raf);
      try {
        void contextRef.current?.close();
      } catch (error) {
        console.error("Recovered error: audio-close", error);
      } finally {
        contextRef.current = null;
      }
    };
  }, [shiftAudioEvent]);

  return null;
}
