"use client";

import { create } from "zustand";

const defaultWorld = {
  gameTime: "Day 1 06:00",
  regions: [],
  highCommand: [],
  keyNpcs: [],
  newsFeed: [],
  missionConsequences: [],
};

export const useWorldStore = create((set) => ({
  world: defaultWorld,
  connectionState: "connecting",
  updateWorld: (world) => set({ world }),
  setConnectionState: (connectionState) => set({ connectionState }),
}));
