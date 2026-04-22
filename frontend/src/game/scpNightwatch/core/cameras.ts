import { CAMERA_NODES } from "@/game/scpNightwatch/data/content";
import { CameraId, CameraNode, DoorSide, RoomId } from "@/game/scpNightwatch/core/types";

export function getCameraNode(cameraId: CameraId): CameraNode {
  return CAMERA_NODES.find((camera) => camera.id === cameraId) ?? CAMERA_NODES[0];
}

export function getCameraRoom(cameraId: CameraId): RoomId {
  return getCameraNode(cameraId).roomId;
}

export function isHallRoom(roomId: RoomId, side: DoorSide): boolean {
  return side === "left" ? roomId === "westHall" || roomId === "leftDoor" : roomId === "eastHall" || roomId === "rightDoor";
}

export function isRoomObserved(params: {
  selectedCamera: CameraId;
  cameraMonitorOpen: boolean;
  lights: Record<DoorSide, boolean>;
  roomId: RoomId;
}): boolean {
  const cameraObserved = params.cameraMonitorOpen && getCameraRoom(params.selectedCamera) === params.roomId;
  const leftLightObserved = params.lights.left && isHallRoom(params.roomId, "left");
  const rightLightObserved = params.lights.right && isHallRoom(params.roomId, "right");
  return cameraObserved || leftLightObserved || rightLightObserved;
}

