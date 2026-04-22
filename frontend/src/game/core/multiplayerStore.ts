"use client";

import { create } from "zustand";
import type {
  AccessState,
  AgentRoleProfile,
  DisguiseId,
  LobbyState,
  MissionPingMarker,
  ReplicatedMissionState,
  ReplicatedPlayerState,
  SessionState,
  SessionStatus,
  StealthState,
  Vec3,
} from "@/game/core/types";
import { getMultiplayerSocket } from "@/lib/multiplayerClient";

const LOCAL_PROFILE_KEY = "silent-resistance-multiplayer-profile";

function createLocalProfile() {
  return {
    name: `Agent ${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    role: "infiltrator" as AgentRoleProfile,
    deviceId: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `device-${Math.random().toString(36).slice(2, 10)}`,
    identityToken: null as string | null,
    playerId: null as string | null,
  };
}

function loadLocalProfile() {
  if (typeof window === "undefined") return createLocalProfile();
  try {
    const raw = window.localStorage.getItem(LOCAL_PROFILE_KEY);
    if (!raw) return createLocalProfile();
    return { ...createLocalProfile(), ...JSON.parse(raw) };
  } catch {
    return createLocalProfile();
  }
}

function persistLocalProfile(profile: { name: string; role: AgentRoleProfile; deviceId: string; identityToken?: string | null; playerId?: string | null }) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(profile));
}

function defaultMissionState(): ReplicatedMissionState {
  return {
    operationId: null,
    sessionMode: "coop",
    globalAlertLevel: 0,
    targetWindowState: "guarded",
    missionPressure: {
      annexPressure: false,
      ballroomPressure: false,
      securityPressure: false,
      targetProtection: "routine",
      extractionRisk: "low",
      activeLeadIncidentId: null,
    },
    activeIncidents: [],
    teamObjectives: {
      primaryComplete: false,
      secondaryComplete: false,
      targetEliminated: false,
      extractionReady: false,
      missionComplete: false,
      sabotageFlags: {},
      extractedPlayerIds: [],
      compromisedPlayerIds: [],
      assistCount: 0,
      sharedFailure: false,
    },
    pings: [],
    extractionState: "locked",
    authorityRevision: 0,
    authoritySource: "backend",
    serverTime: 0,
    eventLog: [],
    joinInProgressAllowed: true,
  };
}

interface MultiplayerStoreState extends SessionState {
  localProfileName: string;
  localRole: AgentRoleProfile;
  identityToken: string | null;
  lobby: LobbyState | null;
  teamSummary: string | null;
  backendError: string | null;
  identityReady: boolean;
  lastAppliedAuthorityRevision: number;
  lastSentPlayerSequence: number;
  lastSentMissionSequence: number;
  setLocalProfile: (name: string, role: AgentRoleProfile) => void;
  connectBackend: () => void;
  createSession: (params: { operationId: string | null; privacy?: "private" | "public"; quickMatchEligible?: boolean }) => void;
  joinSession: (code: string) => void;
  quickMatch: (operationId?: string | null) => void;
  setReady: (ready: boolean) => void;
  leaveSession: () => void;
  sendPlayerState: (payload: {
    position: Vec3;
    velocity: Vec3;
    facing: number;
    posture: "stand" | "crouch" | "dragging";
    disguiseId: DisguiseId;
    accessState: AccessState;
    stealthState: StealthState;
    suspicion: number;
    currentZoneId: string;
    carriedBodyId: string | null;
  }) => void;
  syncMissionState: (missionState: {
    operationId?: string | null;
    observedTargetWindow?: "guarded" | "vulnerable" | "relocating" | null;
    candidateIncidents?: Array<{
      id: string;
      category: ReplicatedMissionState["activeIncidents"][number]["category"];
      zoneClusterId: string;
      severity: number;
      ownerPlayerId?: string | null;
      createdAt: number;
    }>;
    teamObjectives?: Partial<ReplicatedMissionState["teamObjectives"]>;
    pings?: ReplicatedMissionState["pings"];
  }) => void;
  pushPing: (marker: Omit<MissionPingMarker, "playerId" | "createdAt">) => void;
}

function persistCurrentProfile() {
  const state = useMultiplayerStore.getState();
  const current = loadLocalProfile();
  persistLocalProfile({
    name: state.localProfileName,
    role: state.localRole,
    deviceId: state.deviceId || createLocalProfile().deviceId,
    identityToken: current.identityToken,
    playerId: state.localPlayerId,
  });
}

function applySessionSnapshot(
  set: (partial: Partial<MultiplayerStoreState>) => void,
  snapshot: {
    sessionId: string;
    code: string;
    status: SessionStatus;
    operationId: string | null;
    partyId?: string;
    privacy?: "private" | "public";
    quickMatchEligible?: boolean;
    maxPlayers?: number;
    players: ReplicatedPlayerState[];
    missionState: ReplicatedMissionState;
    localPlayerId?: string | null;
    reconnectToken?: string | null;
    authoritySource?: "backend" | "solo_fallback";
  },
) {
  set({
    sessionId: snapshot.sessionId,
    code: snapshot.code,
    status: snapshot.status,
    operationId: snapshot.operationId,
    players: snapshot.players,
    missionState: snapshot.missionState,
    reconnectToken: snapshot.reconnectToken ?? null,
    lobby: {
      sessionId: snapshot.sessionId,
      code: snapshot.code,
      operationId: snapshot.operationId,
      partyId: snapshot.partyId,
      privacy: snapshot.privacy || "private",
      quickMatchEligible: snapshot.quickMatchEligible !== false,
      status: snapshot.status,
      maxPlayers: snapshot.maxPlayers || 4,
      players: snapshot.players,
      selectedMissionTitle: null,
    },
    localPlayerId: snapshot.localPlayerId ?? null,
    backendConnected: true,
    backendError: null,
    authoritySource: snapshot.authoritySource || "backend",
    lastAppliedAuthorityRevision: snapshot.missionState?.authorityRevision || 0,
  });
}

export const useMultiplayerStore = create<MultiplayerStoreState>((set, get) => ({
  sessionId: null,
  code: null,
  mode: "solo",
  status: "idle",
  localPlayerId: null,
  operationId: null,
  players: [],
  missionState: null,
  reconnectToken: null,
  deviceId: createLocalProfile().deviceId,
  backendConnected: false,
  localProfileName: createLocalProfile().name,
  localRole: "infiltrator",
  identityToken: null,
  lobby: null,
  teamSummary: null,
  backendError: null,
  identityReady: false,
  authoritySource: "solo_fallback",
  lastAppliedAuthorityRevision: 0,
  lastSentPlayerSequence: 0,
  lastSentMissionSequence: 0,
  setLocalProfile: (name, role) => {
    set({ localProfileName: name, localRole: role });
    persistCurrentProfile();
  },
  connectBackend: () => {
    const socket = getMultiplayerSocket();
    const state = get();
    socket.auth = {
      identityToken: loadLocalProfile().identityToken,
      deviceId: state.deviceId,
      name: state.localProfileName,
      role: state.localRole,
    };
    if (socket.connected) return;

    socket.off("connect");
    socket.off("disconnect");
    socket.off("connect_error");
    socket.off("identity:ready");
    socket.off("session:snapshot");
    socket.off("session:error");
    socket.off("session:summary");
    socket.off("session:closed");

    socket.on("connect", () => {
      set({ backendConnected: true, backendError: null });
      const current = get();
      if (current.sessionId && current.reconnectToken) {
        socket.emit("session:resume", {
          sessionId: current.sessionId,
          reconnectToken: current.reconnectToken,
        });
      }
    });
    socket.on("disconnect", () => set({ backendConnected: false, status: get().sessionId ? "disconnected" : "idle" }));
    socket.on("connect_error", (error) => set({ backendError: error.message, backendConnected: false }));
    socket.on("identity:ready", (identity) => {
      set({
        localPlayerId: identity.playerId,
        deviceId: identity.deviceId,
        localProfileName: identity.name,
        localRole: identity.role,
        identityToken: identity.identityToken || null,
        identityReady: true,
      });
      persistLocalProfile({
        name: identity.name,
        role: identity.role,
        deviceId: identity.deviceId,
        identityToken: identity.identityToken,
        playerId: identity.playerId,
      });
    });
    socket.on("session:snapshot", (snapshot) => {
      if ((snapshot.missionState?.authorityRevision || 0) < get().lastAppliedAuthorityRevision) return;
      applySessionSnapshot(set, snapshot);
      persistLocalProfile({
        name: get().localProfileName,
        role: get().localRole,
        deviceId: get().deviceId || loadLocalProfile().deviceId,
        identityToken: loadLocalProfile().identityToken,
        playerId: snapshot.localPlayerId,
      });
    });
    socket.on("session:error", (error) => set({ backendError: typeof error === "string" ? error : error?.message || "Session error" }));
    socket.on("session:summary", (summary) => set({ teamSummary: summary?.text || null }));
    socket.on("session:closed", () =>
      set({
        sessionId: null,
        code: null,
        mode: "solo",
        status: "idle",
        operationId: null,
        players: [],
        missionState: null,
        lobby: null,
        teamSummary: null,
        reconnectToken: null,
        authoritySource: "solo_fallback",
        lastAppliedAuthorityRevision: 0,
      }),
    );
    socket.connect();
  },
  createSession: ({ operationId, privacy = "private", quickMatchEligible = true }) => {
    get().connectBackend();
    const socket = getMultiplayerSocket();
    set({ status: "matchmaking", mode: "coop" });
    socket.emit("session:create", {
      operationId,
      privacy,
      quickMatchEligible,
      role: get().localRole,
    });
  },
  joinSession: (code) => {
    get().connectBackend();
    const socket = getMultiplayerSocket();
    set({ status: "matchmaking", mode: "coop" });
    socket.emit("session:join", {
      code,
      role: get().localRole,
    });
  },
  quickMatch: (operationId) => {
    get().connectBackend();
    const socket = getMultiplayerSocket();
    set({ status: "matchmaking", mode: "coop" });
    socket.emit("session:quick-match", {
      operationId,
      role: get().localRole,
    });
  },
  setReady: (ready) => {
    const socket = getMultiplayerSocket();
    socket.emit("session:set-ready", { ready });
  },
  leaveSession: () => {
    const socket = getMultiplayerSocket();
    socket.emit("session:leave");
    set({
      sessionId: null,
      code: null,
      mode: "solo",
      status: "idle",
      operationId: null,
      players: [],
      missionState: null,
      lobby: null,
      teamSummary: null,
      reconnectToken: null,
      authoritySource: "solo_fallback",
      lastAppliedAuthorityRevision: 0,
    });
  },
  sendPlayerState: (payload) => {
    if (!get().sessionId) return;
    const socket = getMultiplayerSocket();
    const nextSequence = get().lastSentPlayerSequence + 1;
    set({ lastSentPlayerSequence: nextSequence });
    socket.emit("session:player-state", {
      ...payload,
      clientSequence: nextSequence,
      clientSentAt: Date.now(),
    });
  },
  syncMissionState: (missionState) => {
    if (!get().sessionId) return;
    const socket = getMultiplayerSocket();
    const nextSequence = get().lastSentMissionSequence + 1;
    set({ lastSentMissionSequence: nextSequence });
    socket.emit("session:mission-state", {
      ...missionState,
      clientSequence: nextSequence,
      clientSentAt: Date.now(),
    });
  },
  pushPing: (marker) => {
    if (!get().sessionId) return;
    const socket = getMultiplayerSocket();
    socket.emit("session:ping", marker);
  },
}));

if (typeof window !== "undefined") {
  const profile = loadLocalProfile();
  useMultiplayerStore.setState({
    localProfileName: profile.name,
    localRole: profile.role,
    deviceId: profile.deviceId,
    localPlayerId: profile.playerId,
    identityToken: profile.identityToken || null,
  });
}
