"use client";

import { useMemo, useRef } from "react";
import { CuboidCollider, RigidBody, type RapierRigidBody } from "@react-three/rapier";
import { useFrame } from "@react-three/fiber";
import { getArenaConfig } from "@/game/ragdollArchers/arenas/arenaCatalog";
import { sampleArenaHeight } from "@/game/ragdollArchers/physics/terrain";
import type { ArenaConfig, ArenaId, ArenaPropDescriptor } from "@/game/ragdollArchers/core/types";

export interface PropBodyApi {
  id: string;
  descriptor: ArenaPropDescriptor;
  body: React.RefObject<RapierRigidBody | null>;
}

interface ArenaSceneProps {
  arenaId: ArenaId;
  registerProp: (api: PropBodyApi | null, id: string) => void;
}

function PlatformProp({ descriptor, registerProp }: { descriptor: ArenaPropDescriptor; registerProp: ArenaSceneProps["registerProp"] }) {
  const body = useRef<RapierRigidBody>(null);
  const base = descriptor.position;

  useFrame(({ clock }) => {
    if (!body.current) return;
    const offset = Math.sin(clock.elapsedTime * (descriptor.speed || 0.8)) * (descriptor.travel || 0);
    const next: [number, number, number] =
      descriptor.movingAxis === "x" ? [base[0] + offset, base[1], base[2]] : [base[0], base[1], base[2] + offset];
    body.current.setNextKinematicTranslation({ x: next[0], y: next[1], z: next[2] });
  });

  useMemo(() => {
    registerProp({ id: descriptor.id, descriptor, body }, descriptor.id);
    return null;
  }, [descriptor, registerProp]);

  return (
    <RigidBody type="kinematicPosition" ref={body} colliders={false} position={descriptor.position}>
      <CuboidCollider args={[descriptor.size[0] / 2, descriptor.size[1] / 2, descriptor.size[2] / 2]} friction={1.2} />
      <mesh receiveShadow castShadow>
        <boxGeometry args={descriptor.size} />
        <meshStandardMaterial color="#6f7f90" roughness={0.4} metalness={0.18} />
      </mesh>
    </RigidBody>
  );
}

function StaticProp({ descriptor, registerProp }: { descriptor: ArenaPropDescriptor; registerProp: ArenaSceneProps["registerProp"] }) {
  const body = useRef<RapierRigidBody>(null);
  const type = descriptor.mass ? "dynamic" : "fixed";

  useMemo(() => {
    registerProp({ id: descriptor.id, descriptor, body }, descriptor.id);
    return null;
  }, [descriptor, registerProp]);

  const color =
    descriptor.kind === "barrel" ? "#a85f3b" : descriptor.kind === "pillar" ? "#7d8ca1" : descriptor.kind === "crate" ? "#8c6a43" : "#8291a4";

  return (
    <RigidBody ref={body} colliders={false} type={type as "fixed" | "dynamic"} position={descriptor.position} mass={descriptor.mass || 1}>
      <CuboidCollider args={[descriptor.size[0] / 2, descriptor.size[1] / 2, descriptor.size[2] / 2]} friction={1} restitution={descriptor.explosive ? 0.15 : 0.05} />
      <mesh castShadow receiveShadow>
        <boxGeometry args={descriptor.size} />
        <meshStandardMaterial color={color} roughness={0.7} metalness={descriptor.kind === "pillar" ? 0.1 : 0.02} />
      </mesh>
    </RigidBody>
  );
}

function TerrainBlocks({ arena }: { arena: ArenaConfig }) {
  const blocks = useMemo<
    { id: string; position: [number, number, number]; size: [number, number, number]; color: string }[]
  >(() => {
    if (arena.floorType === "flat") {
      return [{ id: "floor", position: [0, -1, 0] as [number, number, number], size: [80, 2, 80] as [number, number, number], color: arena.floorColor }];
    }
    if (arena.floorType === "hills") {
      const tiles: { id: string; position: [number, number, number]; size: [number, number, number]; color: string }[] = [];
      for (let x = -8; x <= 8; x += 1) {
        for (let z = -8; z <= 8; z += 1) {
          const worldX = x * 4;
          const worldZ = z * 4;
          const height = sampleArenaHeight(arena, worldX, worldZ);
          tiles.push({
            id: `hill-${x}-${z}`,
            position: [worldX, height - 1.6, worldZ],
            size: [4.2, 3.2, 4.2],
            color: arena.floorColor,
          });
        }
      }
      return tiles;
    }
    return [
      { id: "isle-1", position: [-10, 5.1, -2], size: [12, 2.2, 12], color: arena.floorColor },
      { id: "isle-2", position: [0, 5.7, 0], size: [14, 2.4, 12], color: arena.floorColor },
      { id: "isle-3", position: [10, 5.2, 3], size: [12, 2, 11], color: arena.floorColor },
      { id: "isle-4", position: [18, 7.4, -7], size: [10, 2, 10], color: arena.floorColor },
      { id: "isle-5", position: [21, 6.2, 10], size: [12, 2, 12], color: arena.floorColor },
      { id: "bridge-1", position: [5.5, 5.3, 1], size: [11, 0.6, 2.8], color: "#697689" },
      { id: "bridge-2", position: [15, 6, -2], size: [9, 0.5, 2.4], color: "#667485" },
    ];
  }, [arena]);

  return (
    <>
      {blocks.map((block) => (
        <RigidBody key={block.id} type="fixed" colliders={false} position={block.position}>
          <CuboidCollider args={[block.size[0] / 2, block.size[1] / 2, block.size[2] / 2]} friction={1.15} />
          <mesh receiveShadow>
            <boxGeometry args={block.size} />
            <meshStandardMaterial color={block.color} roughness={0.92} />
          </mesh>
        </RigidBody>
      ))}
    </>
  );
}

export function ArenaScene({ arenaId, registerProp }: ArenaSceneProps) {
  const arena = getArenaConfig(arenaId);

  return (
    <>
      <TerrainBlocks arena={arena} />
      {arena.props.map((descriptor) =>
        descriptor.kind === "platform" ? (
          <PlatformProp key={descriptor.id} descriptor={descriptor} registerProp={registerProp} />
        ) : (
          <StaticProp key={descriptor.id} descriptor={descriptor} registerProp={registerProp} />
        ),
      )}
    </>
  );
}
