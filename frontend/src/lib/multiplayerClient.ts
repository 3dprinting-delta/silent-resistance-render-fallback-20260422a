"use client";

import { io, type Socket } from "socket.io-client";
import { getPublicBackendBaseUrl } from "@/lib/backendUrl";

let socket: Socket | null = null;

function resolveMultiplayerUrl() {
  return getPublicBackendBaseUrl();
}

export function getMultiplayerSocket() {
  if (socket) return socket;
  socket = io(resolveMultiplayerUrl(), {
    autoConnect: false,
    transports: ["websocket", "polling"],
  });
  return socket;
}

export function disconnectMultiplayerSocket() {
  if (!socket) return;
  socket.disconnect();
}
