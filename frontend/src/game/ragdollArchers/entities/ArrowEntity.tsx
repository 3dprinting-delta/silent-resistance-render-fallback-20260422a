"use client";

import { useEffect, useRef } from "react";
import { BallCollider, RigidBody, type RapierRigidBody } from "@react-three/rapier";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { ArrowType } from "@/game/ragdollArchers/core/types";

interface ArrowEntityProps {
  id: string;
  type: ArrowType;
  spawn: [number, number, number];
  velocity: [number, number, number];
  color: string;
  register: (id: string, body: React.RefObject<RapierRigidBody | null> | null) => void;
}

export function ArrowEntity({ id, type, spawn, velocity, color, register }: ArrowEntityProps) {
  const body = useRef<RapierRigidBody>(null);
  const mesh = useRef<THREE.Mesh>(null);

  useEffect(() => {
    register(id, body);
    return () => register(id, null);
  }, [id, register]);

  useEffect(() => {
    if (!body.current) return;
    body.current.setTranslation({ x: spawn[0], y: spawn[1], z: spawn[2] }, true);
    body.current.setLinvel({ x: velocity[0], y: velocity[1], z: velocity[2] }, true);
  }, [spawn, velocity]);

  useFrame(() => {
    if (!body.current || !mesh.current) return;
    const nextVelocity = body.current.linvel();
    const direction = new THREE.Vector3(nextVelocity.x, nextVelocity.y, nextVelocity.z);
    if (direction.lengthSq() < 0.001) return;
    direction.normalize();
    mesh.current.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);
  });

  const tipColor = type === "explosive" ? "#ffaf5f" : type === "light" ? "#86c4f7" : color;

  return (
    <RigidBody ref={body} colliders={false} position={spawn} gravityScale={1} ccd linearDamping={0.02} angularDamping={0.2} mass={0.08}>
      <BallCollider args={[0.08]} restitution={0.02} friction={0.25} />
      <mesh ref={mesh} castShadow>
        <cylinderGeometry args={[0.03, 0.045, 1.35, 10]} />
        <meshStandardMaterial color={color} roughness={0.34} metalness={0.25} />
      </mesh>
      <mesh position={[0, 0, 0.56]} castShadow>
        <coneGeometry args={[0.07, 0.28, 10]} />
        <meshStandardMaterial color={tipColor} roughness={0.26} metalness={0.72} emissive={type === "explosive" ? "#ff6b36" : "#000000"} emissiveIntensity={type === "explosive" ? 0.55 : 0} />
      </mesh>
      <mesh position={[0, 0.06, -0.52]} rotation={[0, 0, Math.PI / 4]} castShadow>
        <boxGeometry args={[0.02, 0.22, 0.22]} />
        <meshStandardMaterial color="#f3dcc3" roughness={0.86} />
      </mesh>
      <mesh position={[0, -0.06, -0.52]} rotation={[0, 0, -Math.PI / 4]} castShadow>
        <boxGeometry args={[0.02, 0.22, 0.22]} />
        <meshStandardMaterial color="#f3dcc3" roughness={0.86} />
      </mesh>
    </RigidBody>
  );
}
