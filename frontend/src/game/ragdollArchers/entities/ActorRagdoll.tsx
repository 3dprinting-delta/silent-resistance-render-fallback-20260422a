"use client";

import { useEffect, useMemo, useRef } from "react";
import { BallCollider, CapsuleCollider, CuboidCollider, RigidBody, useRevoluteJoint, useSphericalJoint, type RapierRigidBody } from "@react-three/rapier";
import type { LimbName } from "@/game/ragdollArchers/core/types";

export interface RagdollRigApi {
  actorId: string;
  pelvis: React.RefObject<RapierRigidBody | null>;
  torso: React.RefObject<RapierRigidBody | null>;
  head: React.RefObject<RapierRigidBody | null>;
  limbs: Record<LimbName, React.RefObject<RapierRigidBody | null>>;
}

interface ActorRagdollProps {
  actorId: string;
  color: string;
  spawn: [number, number, number];
  onRegister: (actorId: string, api: RagdollRigApi | null) => void;
}

export function ActorRagdoll({ actorId, color, spawn, onRegister }: ActorRagdollProps) {
  const pelvis = useRef<RapierRigidBody>(null);
  const torso = useRef<RapierRigidBody>(null);
  const head = useRef<RapierRigidBody>(null);
  const upperArmLeft = useRef<RapierRigidBody>(null);
  const lowerArmLeft = useRef<RapierRigidBody>(null);
  const upperArmRight = useRef<RapierRigidBody>(null);
  const lowerArmRight = useRef<RapierRigidBody>(null);
  const upperLegLeft = useRef<RapierRigidBody>(null);
  const lowerLegLeft = useRef<RapierRigidBody>(null);
  const upperLegRight = useRef<RapierRigidBody>(null);
  const lowerLegRight = useRef<RapierRigidBody>(null);
  const jointPelvis = pelvis as React.RefObject<RapierRigidBody>;
  const jointTorso = torso as React.RefObject<RapierRigidBody>;
  const jointHead = head as React.RefObject<RapierRigidBody>;
  const jointUpperArmLeft = upperArmLeft as React.RefObject<RapierRigidBody>;
  const jointLowerArmLeft = lowerArmLeft as React.RefObject<RapierRigidBody>;
  const jointUpperArmRight = upperArmRight as React.RefObject<RapierRigidBody>;
  const jointLowerArmRight = lowerArmRight as React.RefObject<RapierRigidBody>;
  const jointUpperLegLeft = upperLegLeft as React.RefObject<RapierRigidBody>;
  const jointLowerLegLeft = lowerLegLeft as React.RefObject<RapierRigidBody>;
  const jointUpperLegRight = upperLegRight as React.RefObject<RapierRigidBody>;
  const jointLowerLegRight = lowerLegRight as React.RefObject<RapierRigidBody>;

  useSphericalJoint(jointPelvis, jointTorso, [[0, 0.38, 0], [0, -0.36, 0]]);
  useSphericalJoint(jointTorso, jointHead, [[0, 0.44, 0], [0, -0.22, 0]]);
  useSphericalJoint(jointTorso, jointUpperArmLeft, [[-0.36, 0.22, 0], [0, 0.23, 0]]);
  useSphericalJoint(jointTorso, jointUpperArmRight, [[0.36, 0.22, 0], [0, 0.23, 0]]);
  useRevoluteJoint(jointUpperArmLeft, jointLowerArmLeft, [[0, -0.36, 0], [0, 0.28, 0], [1, 0, 0], [-1.25, 0.15]]);
  useRevoluteJoint(jointUpperArmRight, jointLowerArmRight, [[0, -0.36, 0], [0, 0.28, 0], [1, 0, 0], [-1.25, 0.15]]);
  useSphericalJoint(jointPelvis, jointUpperLegLeft, [[-0.18, -0.28, 0], [0, 0.36, 0]]);
  useSphericalJoint(jointPelvis, jointUpperLegRight, [[0.18, -0.28, 0], [0, 0.36, 0]]);
  useRevoluteJoint(jointUpperLegLeft, jointLowerLegLeft, [[0, -0.4, 0], [0, 0.36, 0], [1, 0, 0], [-0.05, 1.2]]);
  useRevoluteJoint(jointUpperLegRight, jointLowerLegRight, [[0, -0.4, 0], [0, 0.36, 0], [1, 0, 0], [-0.05, 1.2]]);

  const api = useMemo<RagdollRigApi>(
    () => ({
      actorId,
      pelvis,
      torso,
      head,
      limbs: {
        head,
        torso,
        pelvis,
        upperArmLeft,
        lowerArmLeft,
        upperArmRight,
        lowerArmRight,
        upperLegLeft,
        lowerLegLeft,
        upperLegRight,
        lowerLegRight,
      },
    }),
    [actorId],
  );

  useEffect(() => {
    onRegister(actorId, api);
    return () => onRegister(actorId, null);
  }, [actorId, api, onRegister]);

  return (
    <>
      <RigidBody ref={pelvis} colliders={false} linearDamping={0.65} angularDamping={1.25} position={spawn} mass={1.4} canSleep={false}>
        <CuboidCollider args={[0.22, 0.18, 0.14]} />
        <mesh castShadow>
          <boxGeometry args={[0.5, 0.34, 0.28]} />
          <meshStandardMaterial color={color} roughness={0.55} metalness={0.08} />
        </mesh>
      </RigidBody>

      <RigidBody ref={torso} colliders={false} linearDamping={0.55} angularDamping={1.1} position={[spawn[0], spawn[1] + 0.78, spawn[2]]} mass={1.7} canSleep={false}>
        <CapsuleCollider args={[0.36, 0.22]} />
        <mesh castShadow>
          <capsuleGeometry args={[0.25, 0.72, 8, 12]} />
          <meshStandardMaterial color={color} roughness={0.52} metalness={0.08} />
        </mesh>
      </RigidBody>

      <RigidBody ref={head} colliders={false} linearDamping={0.48} angularDamping={0.95} position={[spawn[0], spawn[1] + 1.42, spawn[2]]} mass={0.7} canSleep={false}>
        <BallCollider args={[0.18]} />
        <mesh castShadow>
          <sphereGeometry args={[0.19, 18, 18]} />
          <meshStandardMaterial color="#dcc1a4" roughness={0.66} />
        </mesh>
      </RigidBody>

      <RigidBody ref={upperArmLeft} colliders={false} linearDamping={0.5} angularDamping={0.9} position={[spawn[0] - 0.52, spawn[1] + 0.92, spawn[2]]} mass={0.5} canSleep={false}>
        <CapsuleCollider args={[0.24, 0.09]} rotation={[0, 0, Math.PI / 2]} />
        <mesh castShadow rotation-z={Math.PI / 2}>
          <capsuleGeometry args={[0.1, 0.46, 6, 10]} />
          <meshStandardMaterial color={color} roughness={0.5} />
        </mesh>
      </RigidBody>

      <RigidBody ref={lowerArmLeft} colliders={false} linearDamping={0.5} angularDamping={0.9} position={[spawn[0] - 0.86, spawn[1] + 0.74, spawn[2]]} mass={0.42} canSleep={false}>
        <CapsuleCollider args={[0.22, 0.085]} rotation={[0, 0, Math.PI / 2]} />
        <mesh castShadow rotation-z={Math.PI / 2}>
          <capsuleGeometry args={[0.09, 0.42, 6, 10]} />
          <meshStandardMaterial color="#d8c4b1" roughness={0.58} />
        </mesh>
      </RigidBody>

      <RigidBody ref={upperArmRight} colliders={false} linearDamping={0.5} angularDamping={0.9} position={[spawn[0] + 0.52, spawn[1] + 0.92, spawn[2]]} mass={0.5} canSleep={false}>
        <CapsuleCollider args={[0.24, 0.09]} rotation={[0, 0, Math.PI / 2]} />
        <mesh castShadow rotation-z={Math.PI / 2}>
          <capsuleGeometry args={[0.1, 0.46, 6, 10]} />
          <meshStandardMaterial color={color} roughness={0.5} />
        </mesh>
      </RigidBody>

      <RigidBody ref={lowerArmRight} colliders={false} linearDamping={0.5} angularDamping={0.9} position={[spawn[0] + 0.86, spawn[1] + 0.74, spawn[2]]} mass={0.42} canSleep={false}>
        <CapsuleCollider args={[0.22, 0.085]} rotation={[0, 0, Math.PI / 2]} />
        <mesh castShadow rotation-z={Math.PI / 2}>
          <capsuleGeometry args={[0.09, 0.42, 6, 10]} />
          <meshStandardMaterial color="#d8c4b1" roughness={0.58} />
        </mesh>
      </RigidBody>

      <RigidBody ref={upperLegLeft} colliders={false} linearDamping={0.55} angularDamping={0.9} position={[spawn[0] - 0.16, spawn[1] - 0.48, spawn[2]]} mass={0.9} canSleep={false}>
        <CapsuleCollider args={[0.34, 0.11]} />
        <mesh castShadow>
          <capsuleGeometry args={[0.12, 0.64, 6, 10]} />
          <meshStandardMaterial color="#3f5565" roughness={0.52} />
        </mesh>
      </RigidBody>

      <RigidBody ref={lowerLegLeft} colliders={false} linearDamping={0.55} angularDamping={0.9} position={[spawn[0] - 0.16, spawn[1] - 1.26, spawn[2]]} mass={0.8} canSleep={false}>
        <CapsuleCollider args={[0.32, 0.1]} />
        <mesh castShadow>
          <capsuleGeometry args={[0.11, 0.6, 6, 10]} />
          <meshStandardMaterial color="#d3c6ba" roughness={0.58} />
        </mesh>
      </RigidBody>

      <RigidBody ref={upperLegRight} colliders={false} linearDamping={0.55} angularDamping={0.9} position={[spawn[0] + 0.16, spawn[1] - 0.48, spawn[2]]} mass={0.9} canSleep={false}>
        <CapsuleCollider args={[0.34, 0.11]} />
        <mesh castShadow>
          <capsuleGeometry args={[0.12, 0.64, 6, 10]} />
          <meshStandardMaterial color="#3f5565" roughness={0.52} />
        </mesh>
      </RigidBody>

      <RigidBody ref={lowerLegRight} colliders={false} linearDamping={0.55} angularDamping={0.9} position={[spawn[0] + 0.16, spawn[1] - 1.26, spawn[2]]} mass={0.8} canSleep={false}>
        <CapsuleCollider args={[0.32, 0.1]} />
        <mesh castShadow>
          <capsuleGeometry args={[0.11, 0.6, 6, 10]} />
          <meshStandardMaterial color="#d3c6ba" roughness={0.58} />
        </mesh>
      </RigidBody>
    </>
  );
}
