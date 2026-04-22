"use client";

import { Fragment, useEffect, useMemo, useRef } from "react";
import { Line, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useCampaignStore } from "@/game/core/campaignStore";
import { useMultiplayerStore } from "@/game/core/multiplayerStore";
import { foundationEnvironmentProfiles, foundationShell } from "@/game/data/foundationShell";
import { getLayoutVariant } from "@/game/data/generatedMissionCatalog";
import { usePhaseOneStore } from "@/game/core/phaseOneStore";
import type { GeneratedMissionDefinition, InteractableDefinition, MissionProgressState, PatrolRoute, Vec3, WatcherDefinition } from "@/game/core/types";

const interactablePalette: Record<InteractableDefinition["type"], string> = {
  disguise: "#9a958b",
  poison: "#4e7a5e",
  sabotage: "#907040",
  container: "#53616d",
  extraction: "#3a7094",
  intel: "#8e8372",
  pickup: "#7a887f",
  door: "#705540",
  body: "#896c58",
};

const actorHeights = {
  civilian: 1.46,
  staff: 1.5,
  guard: 1.62,
  target: 1.68,
  bodyguard: 1.66,
} as const;

const propClusters = [
  { id: "lobby-planters", type: "planter", position: [-14, 1, 18], count: 4, gap: 9, axis: "x" as const },
  { id: "arrival-baggage", type: "luggage", position: [12, 1, 36], count: 3, gap: 3.8, axis: "x" as const },
  { id: "ballroom-stanchions", type: "stanchion", position: [-12, 1, 3], count: 5, gap: 6, axis: "x" as const },
  { id: "ballroom-banquettes", type: "banquette", position: [12, 1, 5], count: 3, gap: 9, axis: "x" as const },
  { id: "ballroom-cocktail", type: "cocktail", position: [-10, 1, -2], count: 4, gap: 6.5, axis: "x" as const },
  { id: "service-carts", type: "cart", position: [-36, 1, 12], count: 3, gap: 7, axis: "z" as const },
  { id: "kitchen-linen", type: "linen", position: [-28, 1, 2], count: 3, gap: 4.4, axis: "x" as const },
  { id: "kitchen-stacks", type: "prep", position: [-34, 1, -3], count: 3, gap: 4.4, axis: "x" as const },
  { id: "marina-pallets", type: "pallet", position: [44, 1, 15], count: 4, gap: 4.6, axis: "z" as const },
  { id: "marina-lounge", type: "lounger", position: [28, 1, 10], count: 3, gap: 6.6, axis: "x" as const },
  { id: "annex-seating", type: "sofa", position: [60, 1, -24], count: 3, gap: 8, axis: "x" as const },
  { id: "annex-dividers", type: "divider", position: [67, 1, -10], count: 3, gap: 7.5, axis: "z" as const },
  { id: "annex-signage", type: "signage", position: [72, 1, -18], count: 2, gap: 20, axis: "z" as const },
  { id: "pier-barricades", type: "barricade", position: [58, 1, -46], count: 4, gap: 3.6, axis: "x" as const },
  { id: "cellar-racks", type: "rack", position: [-20, -2, -12], count: 4, gap: 6, axis: "x" as const },
  { id: "utility-crates", type: "crate", position: [16, -2, -10], count: 5, gap: 4.2, axis: "x" as const },
  { id: "utility-pipes", type: "pipe", position: [24, -2, -18], count: 3, gap: 7.8, axis: "x" as const },
  { id: "vip-lamps", type: "lamp", position: [6, 1, -24], count: 2, gap: 12, axis: "x" as const },
  { id: "vip-console", type: "console", position: [7, 1, -17], count: 2, gap: 8.5, axis: "x" as const },
];

function propOffset(axis: "x" | "z", index: number, gap: number, count: number): [number, number] {
  const shift = (index - (count - 1) / 2) * gap;
  return axis === "x" ? [shift, 0] : [0, shift];
}

function getEnvironmentProfile(zoneId: string | undefined) {
  return foundationEnvironmentProfiles.find((profile) => zoneId && profile.zoneIds.includes(zoneId)) || foundationEnvironmentProfiles[0];
}

function seedNumber(value: string) {
  return value.split("").reduce((total, character, index) => total + character.charCodeAt(0) * (index + 1), 0);
}

function shiftHex(hex: string, hueShift: number, lightnessShift = 0) {
  const color = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  color.getHSL(hsl);
  color.setHSL((hsl.h + hueShift + 1) % 1, Math.min(1, Math.max(0.08, hsl.s)), Math.min(0.92, Math.max(0.08, hsl.l + lightnessShift)));
  return `#${color.getHexString()}`;
}

function useMissionVariantPresentation() {
  const selectedOperation = useCampaignStore((state) => state.getSelectedOperation());
  const layoutVariant = getLayoutVariant(selectedOperation?.runtimeConfig.layoutVariantId || "lobby-pressure");
  const seed = seedNumber(selectedOperation?.id || layoutVariant.id);
  const securityTier = selectedOperation?.runtimeConfig.securityTier || "guarded";
  const hueShift = ((seed % 9) - 4) * 0.008;
  const palette =
    layoutVariant.landmarkFocus === "service"
      ? {
          publicAccent: shiftHex("#7b6b60", hueShift, -0.04),
          warmAccent: shiftHex("#ab7142", hueShift, -0.02),
          coolAccent: shiftHex("#7ca3bf", hueShift, 0.03),
          practical: shiftHex("#c98a54", hueShift, 0.02),
          cloth: shiftHex("#5d6168", hueShift, -0.01),
        }
      : layoutVariant.landmarkFocus === "marina"
        ? {
            publicAccent: shiftHex("#6a6f76", hueShift, -0.03),
            warmAccent: shiftHex("#d08d5c", hueShift, 0.01),
            coolAccent: shiftHex("#6d97b5", hueShift, 0.05),
            practical: shiftHex("#ebb37d", hueShift, 0.03),
            cloth: shiftHex("#70767f", hueShift, 0.01),
          }
        : layoutVariant.landmarkFocus === "annex"
          ? {
              publicAccent: shiftHex("#7d6b62", hueShift, -0.01),
              warmAccent: shiftHex("#b96d4b", hueShift, 0.02),
              coolAccent: shiftHex("#8094aa", hueShift, 0.01),
              practical: shiftHex("#d8a06d", hueShift, 0.04),
              cloth: shiftHex("#64606a", hueShift, -0.02),
            }
          : {
              publicAccent: shiftHex("#7f6f64", hueShift, 0),
              warmAccent: shiftHex("#b86146", hueShift, 0.03),
              coolAccent: shiftHex("#7f97aa", hueShift, 0.02),
              practical: shiftHex("#d8a678", hueShift, 0.04),
              cloth: shiftHex("#6b6060", hueShift, -0.01),
            };

  return { selectedOperation, layoutVariant, seed, hueShift, securityTier, palette };
}

function surfaceMaterial(type: "marble" | "stone" | "carpet" | "service_tile" | "concrete" | "roof" | "paneled" | "plaster" | "service_paint" | "utility_concrete" | "glass", accent?: string) {
  switch (type) {
    case "marble":
      return <meshPhysicalMaterial color={accent || "#2c3136"} roughness={0.44} metalness={0.05} reflectivity={0.5} clearcoat={0.18} clearcoatRoughness={0.42} />;
    case "carpet":
      return <meshStandardMaterial color={accent || "#312826"} roughness={0.97} metalness={0.01} emissive={accent || "#312826"} emissiveIntensity={0.015} />;
    case "service_tile":
      return <meshStandardMaterial color={accent || "#3c4449"} roughness={0.5} metalness={0.16} />;
    case "concrete":
      return <meshStandardMaterial color={accent || "#30353a"} roughness={0.92} metalness={0.04} />;
    case "roof":
      return <meshStandardMaterial color={accent || "#41474c"} roughness={0.86} metalness={0.12} />;
    case "paneled":
      return <meshPhysicalMaterial color={accent || "#4b4038"} roughness={0.68} metalness={0.08} reflectivity={0.12} clearcoat={0.05} clearcoatRoughness={0.6} />;
    case "service_paint":
      return <meshStandardMaterial color={accent || "#49555e"} roughness={0.72} metalness={0.18} />;
    case "utility_concrete":
      return <meshStandardMaterial color={accent || "#2e3438"} roughness={0.92} metalness={0.04} />;
    case "glass":
      return <meshPhysicalMaterial color={accent || "#597286"} roughness={0.3} metalness={0.08} transmission={0.05} transparent opacity={0.3} reflectivity={0.18} clearcoat={0.08} clearcoatRoughness={0.58} />;
    case "plaster":
      return <meshStandardMaterial color={accent || "#575148"} roughness={0.92} metalness={0.01} />;
    default:
      return <meshStandardMaterial color={accent || "#394147"} roughness={0.76} metalness={0.1} />;
  }
}

function ZonePlanes() {
  return null;
}

function WaterfrontShell() {
  return (
    <>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[176, 152]} />
        <meshStandardMaterial color="#0d1013" roughness={1} metalness={0.03} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[39, 0.02, 18]} receiveShadow>
        <planeGeometry args={[34, 28]} />
        <meshPhysicalMaterial color="#0d2b38" metalness={0.28} roughness={0.26} clearcoat={0.6} clearcoatRoughness={0.22} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[66, 0.02, 16]} receiveShadow>
        <planeGeometry args={[30, 44]} />
        <meshPhysicalMaterial color="#0d2734" metalness={0.24} roughness={0.32} clearcoat={0.52} clearcoatRoughness={0.2} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.04, 40]} receiveShadow>
        <planeGeometry args={[44, 24]} />
        {surfaceMaterial("stone", "#2a2f33")}
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.06, 18]} receiveShadow>
        <planeGeometry args={[40, 22]} />
        {surfaceMaterial("marble", "#262a2d")}
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.08, 0]} receiveShadow>
        <planeGeometry args={[48, 18]} />
        {surfaceMaterial("marble", "#231d1a")}
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[-33, 0.1, 10]} receiveShadow>
        <planeGeometry args={[32, 36]} />
        {surfaceMaterial("service_tile", "#262c31")}
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[35, 0.1, -12]} receiveShadow>
        <planeGeometry args={[24, 22]} />
        {surfaceMaterial("concrete", "#1d2023")}
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[64, 0.1, -22]} receiveShadow>
        <planeGeometry args={[28, 46]} />
        {surfaceMaterial("marble", "#22262a")}
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[29, 4.02, -30]} receiveShadow>
        <planeGeometry args={[26, 18]} />
        {surfaceMaterial("roof", "#343b40")}
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[34, 6.02, -47]} receiveShadow>
        <planeGeometry args={[34, 20]} />
        {surfaceMaterial("roof", "#41484d")}
      </mesh>
      <ZonePlanes />
    </>
  );
}

function StructureMeshes() {
  const selectedOperation = useCampaignStore((state) => state.getSelectedOperation());
  const onboardingStage = useCampaignStore((state) => state.progress.onboardingStage);
  const isIntroOnboarding = onboardingStage === "first_run" && selectedOperation?.variantId === "azure-summit-fall";
  const hiddenStructureIds = isIntroOnboarding ? new Set(["lobby-fountain", "ballroom-stage", "arrival-kiosk", "ballroom-runner"]) : null;

  return (
    <>
      {foundationShell.structures
        .filter((structure) => !(hiddenStructureIds && hiddenStructureIds.has(structure.id)))
        .map((structure) => {
        const profile = getEnvironmentProfile(
          foundationShell.zones.find(
            (zone) =>
              structure.position[0] >= zone.bounds.minX &&
              structure.position[0] <= zone.bounds.maxX &&
              structure.position[2] >= zone.bounds.minZ &&
              structure.position[2] <= zone.bounds.maxZ,
          )?.id,
        );
        const wallMaterial = structure.type === "platform" ? profile.floorMaterial : profile.wallMaterial;
        return (
          <group key={structure.id} position={structure.position}>
            <mesh castShadow receiveShadow>
              <boxGeometry args={structure.type === "building" ? [structure.size[0] * 0.94, structure.size[1], structure.size[2] * 0.94] : structure.size} />
              {surfaceMaterial(wallMaterial, structure.type === "prop" ? profile.accentColor : structure.color)}
            </mesh>
            {structure.type === "building" ? (
              <>
                <mesh position={[0, -structure.size[1] * 0.43, 0]} castShadow receiveShadow>
                  <boxGeometry args={[structure.size[0], Math.max(0.24, structure.size[1] * 0.12), structure.size[2]]} />
                  {surfaceMaterial("stone", "#25282c")}
                </mesh>
                <mesh position={[0, structure.size[1] * 0.43, 0]} castShadow receiveShadow>
                  <boxGeometry args={[structure.size[0], Math.max(0.18, structure.size[1] * 0.08), structure.size[2]]} />
                  {surfaceMaterial("paneled", "#5e4f43")}
                </mesh>
                <mesh position={[0, structure.size[1] * 0.18, structure.size[2] * 0.48]} castShadow receiveShadow>
                  <boxGeometry args={[structure.size[0] * 0.92, structure.size[1] * 0.22, 0.24]} />
                  {surfaceMaterial("paneled", profile.trimColor)}
                </mesh>
                <mesh position={[0, -structure.size[1] * 0.18, -structure.size[2] * 0.48]} castShadow receiveShadow>
                  <boxGeometry args={[structure.size[0] * 0.88, structure.size[1] * 0.16, 0.22]} />
                  {surfaceMaterial("paneled", "#302822")}
                </mesh>
                <mesh position={[-structure.size[0] * 0.48, 0, 0]} castShadow receiveShadow>
                  <boxGeometry args={[0.24, structure.size[1] * 0.9, structure.size[2] * 0.88]} />
                  {surfaceMaterial("paneled", profile.trimColor)}
                </mesh>
                <mesh position={[structure.size[0] * 0.48, 0, 0]} castShadow receiveShadow>
                  <boxGeometry args={[0.24, structure.size[1] * 0.9, structure.size[2] * 0.88]} />
                  {surfaceMaterial("paneled", profile.trimColor)}
                </mesh>
                {[-1, 1].map((xSign) =>
                  [-1, 1].map((zSign) => (
                    <mesh
                      key={`${structure.id}-corner-${xSign}-${zSign}`}
                      position={[structure.size[0] * 0.43 * xSign, 0, structure.size[2] * 0.43 * zSign]}
                      castShadow
                      receiveShadow
                    >
                      <boxGeometry args={[0.26, structure.size[1] * 0.92, 0.26]} />
                      {surfaceMaterial("paneled", "#4b4039")}
                    </mesh>
                  )),
                )}
              </>
            ) : null}
          </group>
        );
      })}
    </>
  );
}

function ArchitecturalDetail() {
  const selectedOperation = useCampaignStore((state) => state.getSelectedOperation());
  const onboardingStage = useCampaignStore((state) => state.progress.onboardingStage);
  const isIntroOnboarding = onboardingStage === "first_run" && selectedOperation?.variantId === "azure-summit-fall";

  return (
    <>
      {!isIntroOnboarding ? (
        <mesh position={[0, 2.2, 18]} castShadow receiveShadow>
          <boxGeometry args={[28, 0.22, 0.42]} />
          {surfaceMaterial("paneled", "#8f6d52")}
        </mesh>
      ) : null}
      <mesh position={[0, 2.4, 0]} castShadow receiveShadow>
        <boxGeometry args={[42, 0.26, 0.38]} />
        {surfaceMaterial("paneled", "#7a5d46")}
      </mesh>
      <mesh position={[60, 2.2, -18]} castShadow receiveShadow>
        <boxGeometry args={[20, 0.22, 0.4]} />
        {surfaceMaterial("paneled", "#876a4f")}
      </mesh>
      {(isIntroOnboarding ? [-16, 16] : [-16, -8, 8, 16]).map((x) => (
        <group key={`lobby-column-${x}`} position={[x, 2.5, 18]}>
          <mesh castShadow receiveShadow position={[0, -2.15, 0]}>
            <boxGeometry args={[1.18, 0.38, 1.18]} />
            {surfaceMaterial("stone", "#2b2b2d")}
          </mesh>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.76, 4.72, 0.76]} />
            {surfaceMaterial("paneled", "#4e433e")}
          </mesh>
          <mesh castShadow receiveShadow position={[0, 2.2, 0]}>
            <boxGeometry args={[1.04, 0.42, 1.04]} />
            {surfaceMaterial("paneled", "#6f5a4b")}
          </mesh>
        </group>
      ))}
      {[22, 30, 38].map((x) => (
        <group key={`terrace-beam-${x}`} position={[x, 3.8, -6]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.58, 3.3, 0.58]} />
            {surfaceMaterial("paneled", "#55545a")}
          </mesh>
          <mesh castShadow receiveShadow position={[0, -1.72, 0]}>
            <boxGeometry args={[0.92, 0.22, 0.92]} />
            {surfaceMaterial("stone", "#31353b")}
          </mesh>
        </group>
      ))}
      <mesh position={[34, 5.2, -46]} castShadow receiveShadow>
        <boxGeometry args={[28, 0.22, 16]} />
        {surfaceMaterial("glass", "#5f7180")}
      </mesh>
      <mesh position={[0, -0.7, -12]} castShadow receiveShadow>
        <boxGeometry args={[30, 0.16, 10]} />
        {surfaceMaterial("service_tile", "#3a4147")}
      </mesh>
    </>
  );
}

function DecorativeProps() {
  const { layoutVariant, seed, palette } = useMissionVariantPresentation();
  const focus = layoutVariant.landmarkFocus;
  const selectedOperation = useCampaignStore((state) => state.getSelectedOperation());
  const onboardingStage = useCampaignStore((state) => state.progress.onboardingStage);
  const isIntroOnboarding = onboardingStage === "first_run" && selectedOperation?.variantId === "azure-summit-fall";
  const hiddenClusters = isIntroOnboarding
    ? new Set(["arrival-baggage", "ballroom-stanchions", "ballroom-banquettes", "ballroom-cocktail", "lobby-planters", "service-carts"])
    : null;

  return (
    <>
      {propClusters
        .filter((cluster) => !(hiddenClusters && hiddenClusters.has(cluster.id)))
        .map((cluster) =>
        Array.from({
          length: Math.max(
            1,
            cluster.count +
              (cluster.id.includes(focus) ? 1 : 0) -
              (!cluster.id.includes(focus) && (seed + cluster.count) % 4 === 0 ? 1 : 0),
          ),
        }).map((_, index) => {
          const [offsetX, offsetZ] = propOffset(cluster.axis, index, cluster.gap, cluster.count);
          const emphasis = cluster.id.includes(focus) ? 1 : 0.45;
          const driftX = (((seed + index * 11) % 5) - 2) * 0.22 * emphasis;
          const driftZ = (((seed + index * 7) % 5) - 2) * 0.18 * emphasis;
          const position: Vec3 = [cluster.position[0] + offsetX + driftX, cluster.position[1], cluster.position[2] + offsetZ + driftZ];

          if (cluster.type === "planter") {
            return (
              <group key={`${cluster.id}-${index}`} position={position}>
                <mesh castShadow receiveShadow position={[0, 0.45, 0]}>
                  <cylinderGeometry args={[0.62, 0.72, 0.9, 10]} />
                  <meshStandardMaterial color={shiftHex("#3b3c40", (seed % 5) * 0.004)} />
                </mesh>
                <mesh castShadow position={[0, 1.1, 0]}>
                  <sphereGeometry args={[0.7, 12, 12]} />
                  <meshStandardMaterial color={shiftHex("#31523b", (seed % 7) * 0.006, cluster.id.includes(focus) ? 0.04 : 0)} />
                </mesh>
              </group>
            );
          }

          if (cluster.type === "luggage") {
            return (
              <group key={`${cluster.id}-${index}`} position={position}>
                <mesh castShadow receiveShadow position={[0, 0.28, 0]}>
                  <boxGeometry args={[1.1, 0.56, 0.78]} />
                  <meshStandardMaterial color={index % 2 ? palette.coolAccent : palette.publicAccent} />
                </mesh>
                <mesh castShadow receiveShadow position={[0.18, 0.72, 0]}>
                  <boxGeometry args={[0.42, 0.2, 0.12]} />
                  <meshStandardMaterial color="#2c2d31" />
                </mesh>
              </group>
            );
          }

          if (cluster.type === "stanchion") {
            return (
              <group key={`${cluster.id}-${index}`} position={position}>
                <mesh castShadow position={[0, 0.56, 0]}>
                  <cylinderGeometry args={[0.09, 0.12, 1.12, 10]} />
                  <meshStandardMaterial color={palette.publicAccent} metalness={0.35} roughness={0.45} />
                </mesh>
                <mesh castShadow position={[0, 1.08, 0]}>
                  <sphereGeometry args={[0.12, 10, 10]} />
                  <meshStandardMaterial color={palette.warmAccent} metalness={0.35} roughness={0.45} />
                </mesh>
              </group>
            );
          }

          if (cluster.type === "cart") {
            return (
              <group key={`${cluster.id}-${index}`} position={position}>
                <mesh castShadow receiveShadow position={[0, 0.5, 0]}>
                  <boxGeometry args={[1.6, 0.8, 1]} />
                  {surfaceMaterial("service_paint", "#566169")}
                </mesh>
                <mesh castShadow receiveShadow position={[0, 1.05, 0]}>
                  <boxGeometry args={[1.4, 0.14, 0.9]} />
                  {surfaceMaterial("service_tile", "#778088")}
                </mesh>
              </group>
            );
          }

          if (cluster.type === "linen") {
            return (
              <group key={`${cluster.id}-${index}`} position={position}>
                <mesh castShadow receiveShadow position={[0, 0.5, 0]}>
                  <boxGeometry args={[1.2, 1, 0.9]} />
                  {surfaceMaterial("plaster", "#a9a69d")}
                </mesh>
              </group>
            );
          }

          if (cluster.type === "prep") {
            return (
              <group key={`${cluster.id}-${index}`} position={position}>
                <mesh castShadow receiveShadow position={[0, 0.48, 0]}>
                  <boxGeometry args={[1.4, 0.96, 1.1]} />
                  {surfaceMaterial("service_tile", "#56616a")}
                </mesh>
                <mesh castShadow receiveShadow position={[0, 1.05, 0]}>
                  <boxGeometry args={[1.2, 0.12, 0.92]} />
                  {surfaceMaterial("stone", "#7e878d")}
                </mesh>
              </group>
            );
          }

          if (cluster.type === "pallet" || cluster.type === "crate") {
            return (
              <group key={`${cluster.id}-${index}`} position={position}>
                <mesh castShadow receiveShadow position={[0, 0.44, 0]}>
                  <boxGeometry args={[1.4, 0.88, 1.1]} />
                  {surfaceMaterial(cluster.type === "crate" ? "paneled" : "paneled", cluster.type === "crate" ? "#675342" : "#6b5847")}
                </mesh>
              </group>
            );
          }

          if (cluster.type === "sofa") {
            return (
              <group key={`${cluster.id}-${index}`} position={position}>
                <mesh castShadow receiveShadow position={[0, 0.42, 0]}>
                  <boxGeometry args={[2.2, 0.84, 1]} />
                  {surfaceMaterial("plaster", "#50535a")}
                </mesh>
                <mesh castShadow receiveShadow position={[0, 0.95, -0.34]}>
                  <boxGeometry args={[2.2, 0.7, 0.18]} />
                  {surfaceMaterial("plaster", "#585d63")}
                </mesh>
              </group>
            );
          }

          if (cluster.type === "banquette") {
            return (
              <group key={`${cluster.id}-${index}`} position={position}>
                <mesh castShadow receiveShadow position={[0, 0.5, 0]}>
                  <boxGeometry args={[3, 1, 1.2]} />
                  {surfaceMaterial("plaster", "#5a4340")}
                </mesh>
                <mesh castShadow receiveShadow position={[0, 1.15, -0.46]}>
                  <boxGeometry args={[3, 1.1, 0.18]} />
                  {surfaceMaterial("paneled", "#6f514b")}
                </mesh>
              </group>
            );
          }

          if (cluster.type === "cocktail") {
            return (
              <group key={`${cluster.id}-${index}`} position={position}>
                <mesh castShadow receiveShadow position={[0, 0.72, 0]}>
                  <cylinderGeometry args={[0.44, 0.52, 0.1, 16]} />
                  {surfaceMaterial("marble", "#494a4f")}
                </mesh>
                <mesh castShadow receiveShadow position={[0, 0.35, 0]}>
                  <cylinderGeometry args={[0.08, 0.1, 0.7, 12]} />
                  {surfaceMaterial("paneled", "#7d6855")}
                </mesh>
              </group>
            );
          }

          if (cluster.type === "divider") {
            return (
              <group key={`${cluster.id}-${index}`} position={position}>
                <mesh castShadow receiveShadow position={[0, 1.2, 0]}>
                  <boxGeometry args={[0.22, 2.4, 3.8]} />
                  {surfaceMaterial("paneled", "#454b53")}
                </mesh>
              </group>
            );
          }

          if (cluster.type === "barricade") {
            return (
              <group key={`${cluster.id}-${index}`} position={position}>
                <mesh castShadow receiveShadow position={[0, 0.6, 0]}>
                  <boxGeometry args={[1.8, 1.2, 0.42]} />
                  {surfaceMaterial("paneled", "#75503c")}
                </mesh>
              </group>
            );
          }

          if (cluster.type === "lounger") {
            return (
              <group key={`${cluster.id}-${index}`} position={position}>
                <mesh castShadow receiveShadow position={[0, 0.28, 0]}>
                  <boxGeometry args={[2.4, 0.22, 0.88]} />
                  {surfaceMaterial("plaster", "#6f736e")}
                </mesh>
                <mesh castShadow receiveShadow position={[0, 0.6, -0.26]} rotation-x={-0.26}>
                  <boxGeometry args={[2.2, 0.18, 0.92]} />
                  {surfaceMaterial("plaster", "#868a84")}
                </mesh>
              </group>
            );
          }

          if (cluster.type === "signage") {
            return (
              <group key={`${cluster.id}-${index}`} position={position}>
                <mesh castShadow receiveShadow position={[0, 1.4, 0]}>
                  <boxGeometry args={[2.4, 1.2, 0.14]} />
                  <meshPhysicalMaterial color="#1e2429" roughness={0.28} metalness={0.42} emissive="#5b2518" emissiveIntensity={0.55} />
                </mesh>
              </group>
            );
          }

          if (cluster.type === "pipe") {
            return (
              <group key={`${cluster.id}-${index}`} position={position}>
                <mesh castShadow receiveShadow position={[0, 1.8, 0]} rotation-z={Math.PI / 2}>
                  <cylinderGeometry args={[0.15, 0.15, 4.4, 12]} />
                  {surfaceMaterial("service_tile", "#7b8d96")}
                </mesh>
              </group>
            );
          }

          if (cluster.type === "lamp") {
            return (
              <group key={`${cluster.id}-${index}`} position={position}>
                <mesh castShadow receiveShadow position={[0, 0.9, 0]}>
                  <cylinderGeometry args={[0.12, 0.14, 1.8, 10]} />
                  {surfaceMaterial("paneled", "#866c58")}
                </mesh>
                <mesh castShadow position={[0, 1.95, 0]}>
                  <cylinderGeometry args={[0.46, 0.58, 0.7, 14]} />
                  <meshPhysicalMaterial color={palette.practical} roughness={0.38} emissive={palette.warmAccent} emissiveIntensity={0.32} />
                </mesh>
              </group>
            );
          }

          if (cluster.type === "console") {
            return (
              <group key={`${cluster.id}-${index}`} position={position}>
                <mesh castShadow receiveShadow position={[0, 0.7, 0]}>
                  <boxGeometry args={[2.8, 1.4, 0.7]} />
                  {surfaceMaterial("paneled", palette.publicAccent)}
                </mesh>
                <mesh castShadow receiveShadow position={[0, 1.48, 0]}>
                  <boxGeometry args={[2.4, 0.1, 0.52]} />
                  {surfaceMaterial("marble", "#4a4440")}
                </mesh>
              </group>
            );
          }

          return (
            <group key={`${cluster.id}-${index}`} position={position}>
              <mesh castShadow receiveShadow position={[0, 1.1, 0]}>
                <boxGeometry args={[2.2, 2.2, 0.5]} />
                <meshStandardMaterial color="#4b3f36" />
              </mesh>
            </group>
          );
        }),
      )}
    </>
  );
}

function FirstPlayableAreaShell() {
  const pulse = useRef(0);

  useFrame((_, delta) => {
    pulse.current += delta;
  });

  const deskScreenGlow = 0.68 + Math.sin(pulse.current * 1.9) * 0.07;
  const deskScreenFill = 0.16 + Math.sin(pulse.current * 1.7 + 0.35) * 0.015;

  return (
    <>
      <group position={[0, 0, 24]}>
        <mesh position={[0.02, 0.04, -0.03]} rotation-x={-Math.PI / 2} rotation-z={0.006} receiveShadow>
          <planeGeometry args={[22, 22]} />
          {surfaceMaterial("stone", "#272b2f")}
        </mesh>
        <mesh position={[-0.03, 0.045, -6.98]} rotation-x={-Math.PI / 2} rotation-z={-0.004} receiveShadow>
          <planeGeometry args={[16, 6.2]} />
          {surfaceMaterial("marble", "#302c29")}
        </mesh>
        <mesh position={[-7.86, 0.05, 4.4]} rotation-x={-Math.PI / 2} rotation-z={-0.372} receiveShadow>
          <planeGeometry args={[15.6, 2.5]} />
          {surfaceMaterial("service_tile", "#353d43")}
        </mesh>
        <mesh position={[1.02, 0.12, 4.84]} rotation-x={-Math.PI / 2} rotation-z={0.005} receiveShadow>
          <planeGeometry args={[5.8, 6.8]} />
          {surfaceMaterial("carpet", "#4a332c")}
        </mesh>
        <mesh position={[2.02, 0.06, 2.08]} rotation-x={-Math.PI / 2} receiveShadow>
          <planeGeometry args={[10.8, 1.4]} />
          {surfaceMaterial("stone", "#3a3430")}
        </mesh>

        <group position={[-4.58, 0, 4.82]} rotation-z={0.004}>
          <mesh position={[0, 0.24, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.68, 0.48, 18.2]} />
            {surfaceMaterial("stone", "#2d3135")}
          </mesh>
          <mesh position={[0, 1.85, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.52, 2.58, 18]} />
            {surfaceMaterial("plaster", "#645b54")}
          </mesh>
          <mesh position={[0, 3.48, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.62, 0.26, 18.1]} />
            {surfaceMaterial("paneled", "#766351")}
          </mesh>
          {[-5.9, 0, 5.9].map((z, index) => (
            <mesh key={`left-wall-panel-${index}`} position={[0.07, 1.86, z]} castShadow receiveShadow>
              <boxGeometry args={[0.12, 2.32, 0.32]} />
              {surfaceMaterial("paneled", index === 1 ? "#705c4c" : "#675547")}
            </mesh>
          ))}
        </group>

        <group position={[-17.43, 0, 17.38]} rotation-y={-0.418}>
          <mesh position={[0, 0.24, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.72, 0.48, 14.2]} />
            {surfaceMaterial("stone", "#2f3337")}
          </mesh>
          <mesh position={[0, 1.82, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.54, 2.54, 14]} />
            {surfaceMaterial("plaster", "#5f5750")}
          </mesh>
          <mesh position={[0, 3.44, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.64, 0.24, 14.1]} />
            {surfaceMaterial("paneled", "#6f5d4d")}
          </mesh>
          {[-4.2, 3.9].map((z, index) => (
            <mesh key={`corridor-wall-panel-${index}`} position={[0.07, 1.8, z]} castShadow receiveShadow>
              <boxGeometry args={[0.12, 2.22, 0.28]} />
              {surfaceMaterial("paneled", index === 0 ? "#66574b" : "#705f50")}
            </mesh>
          ))}
        </group>

        <group position={[8.37, 0, 5.98]} rotation-z={-0.003}>
          <mesh position={[0, 0.24, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.72, 0.48, 16.2]} />
            {surfaceMaterial("stone", "#31353a")}
          </mesh>
          <mesh position={[0, 1.84, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.54, 2.56, 16]} />
            {surfaceMaterial("plaster", "#5e5853")}
          </mesh>
          <mesh position={[0, 3.46, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.64, 0.24, 16.1]} />
            {surfaceMaterial("paneled", "#6e5c4c")}
          </mesh>
          {[-4.9, 0.3, 4.9].map((z, index) => (
            <mesh key={`right-wall-panel-${index}`} position={[-0.07, 1.84, z]} castShadow receiveShadow>
              <boxGeometry args={[0.12, 2.26, 0.28]} />
              {surfaceMaterial("paneled", index === 1 ? "#776452" : "#675546")}
            </mesh>
          ))}
        </group>

        <group position={[1.83, 0, 9.42]} rotation-z={0.004}>
          <mesh position={[0, 3.7, 0]} castShadow receiveShadow>
            <boxGeometry args={[14.2, 0.16, 8.96]} />
            {surfaceMaterial("paneled", "#6e6a65")}
          </mesh>
          <mesh position={[0, 3.44, 0]} castShadow receiveShadow>
            <boxGeometry args={[14.02, 0.18, 0.42]} />
            {surfaceMaterial("paneled", "#7a6653")}
          </mesh>
          <mesh position={[0, 3.44, 3.98]} castShadow receiveShadow>
            <boxGeometry args={[14.02, 0.18, 0.42]} />
            {surfaceMaterial("paneled", "#6d5d50")}
          </mesh>
          {[-3.02, 0.08, 3.02].map((x, index) => (
            <mesh key={`lobby-ceiling-band-${index}`} position={[x, 3.56, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.26, 0.34, 8.7]} />
              {surfaceMaterial("plaster", index === 1 ? "#73706a" : "#66635f")}
            </mesh>
          ))}
        </group>

        <group position={[-10.42, 0, 17.57]} rotation-y={-0.418}>
          <mesh position={[0, 3.66, 0]} castShadow receiveShadow>
            <boxGeometry args={[12.96, 0.16, 9.34]} />
            {surfaceMaterial("paneled", "#696562")}
          </mesh>
          <mesh position={[0, 3.42, 0]} castShadow receiveShadow>
            <boxGeometry args={[12.8, 0.16, 0.34]} />
            {surfaceMaterial("paneled", "#6c604f")}
          </mesh>
          <mesh position={[0, 3.42, 4.18]} castShadow receiveShadow>
            <boxGeometry args={[12.8, 0.16, 0.34]} />
            {surfaceMaterial("paneled", "#5f564d")}
          </mesh>
          {[-2.8, 2.8].map((x, index) => (
            <mesh key={`corridor-ceiling-rib-${index}`} position={[x, 3.5, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.22, 0.28, 9.12]} />
              {surfaceMaterial("plaster", index === 0 ? "#5f5b57" : "#6d6862")}
            </mesh>
          ))}
        </group>

        <group position={[2.02, 0, 2.1]}>
          <mesh position={[0, 0.18, 0]} castShadow receiveShadow>
            <boxGeometry args={[10.6, 0.36, 0.72]} />
            {surfaceMaterial("stone", "#2e3237")}
          </mesh>
          <mesh position={[0, 1.78, 0]} castShadow receiveShadow>
            <boxGeometry args={[10.4, 2.52, 0.42]} />
            {surfaceMaterial("plaster", "#6a5e54")}
          </mesh>
          <mesh position={[0, 3.16, 0]} castShadow receiveShadow>
            <boxGeometry args={[10.9, 0.2, 0.82]} />
            {surfaceMaterial("paneled", "#7c6653")}
          </mesh>
          <mesh position={[-3.06, 1.82, 0.06]} castShadow receiveShadow>
            <boxGeometry args={[2.02, 2.86, 0.18]} />
            {surfaceMaterial("paneled", "#5f4f42")}
          </mesh>
          <mesh position={[3.12, 1.82, 0.06]} castShadow receiveShadow>
            <boxGeometry args={[2.42, 2.86, 0.18]} />
            {surfaceMaterial("paneled", "#655447")}
          </mesh>
          <mesh position={[-4.18, 1.82, 0.06]} castShadow receiveShadow rotation-y={0.01}>
            <boxGeometry args={[0.72, 3.62, 0.92]} />
            {surfaceMaterial("paneled", "#6e594b")}
          </mesh>
          <mesh position={[6.18, 1.82, 0.06]} castShadow receiveShadow rotation-y={-0.008}>
            <boxGeometry args={[0.72, 3.62, 0.92]} />
            {surfaceMaterial("paneled", "#695548")}
          </mesh>
          <mesh position={[-1.92, 1.55, 0.02]} castShadow receiveShadow>
            <boxGeometry args={[2.2, 3.1, 0.58]} />
            {surfaceMaterial("glass", "#6a7d8a")}
          </mesh>
          <mesh position={[4.18, 1.55, 0.04]} castShadow receiveShadow>
            <boxGeometry args={[2.8, 3.1, 0.58]} />
            {surfaceMaterial("glass", "#708291")}
          </mesh>
        </group>

        <group position={[-8.82, 0, 12.58]} rotation-y={-0.374}>
          <mesh position={[0, 0.18, 0]} castShadow receiveShadow>
            <boxGeometry args={[4.62, 0.36, 0.74]} />
            {surfaceMaterial("stone", "#32373b")}
          </mesh>
          <mesh position={[0, 1.12, 0]} castShadow receiveShadow>
            <boxGeometry args={[4.4, 1.96, 0.42]} />
            {surfaceMaterial("paneled", "#5d4e44")}
          </mesh>
          <mesh position={[0, 2.24, 0]} castShadow receiveShadow>
            <boxGeometry args={[4.76, 0.18, 0.62]} />
            {surfaceMaterial("stone", "#454b50")}
          </mesh>
          <mesh position={[-1.24, 1.1, 0.07]} castShadow receiveShadow>
            <boxGeometry args={[0.12, 1.86, 0.54]} />
            {surfaceMaterial("paneled", "#6d5b4c")}
          </mesh>
          <mesh position={[1.26, 1.1, -0.04]} castShadow receiveShadow>
            <boxGeometry args={[0.12, 1.86, 0.54]} />
            {surfaceMaterial("paneled", "#655446")}
          </mesh>
        </group>

        <group position={[4.32, 0.72, 13.54]} rotation-y={-0.014}>
          <mesh castShadow receiveShadow position={[0, 0.11, 0]}>
            <boxGeometry args={[3.8, 0.22, 1.22]} />
            {surfaceMaterial("paneled", "#56483c")}
          </mesh>
          <mesh castShadow receiveShadow position={[0, 0.53, 0]}>
            <boxGeometry args={[3.56, 0.82, 1.06]} />
            {surfaceMaterial("paneled", "#6b5546")}
          </mesh>
          <mesh castShadow receiveShadow position={[0, 0.96, -0.28]}>
            <boxGeometry args={[3.24, 0.26, 0.24]} />
            {surfaceMaterial("paneled", "#514238")}
          </mesh>
          <mesh castShadow receiveShadow position={[0, 1.04, 0]}>
            <boxGeometry args={[3.66, 0.12, 1.18]} />
            {surfaceMaterial("marble", "#6a635d")}
          </mesh>
          <mesh castShadow receiveShadow position={[-1.42, 0.38, 0]} >
            <boxGeometry args={[0.14, 0.52, 0.9]} />
            {surfaceMaterial("paneled", "#463a31")}
          </mesh>
          <mesh castShadow receiveShadow position={[1.42, 0.38, 0]}>
            <boxGeometry args={[0.14, 0.52, 0.9]} />
            {surfaceMaterial("paneled", "#4b3e34")}
          </mesh>
          <mesh castShadow receiveShadow position={[-1.18, 1.08, 0.07]}>
            <boxGeometry args={[0.58, 0.18, 0.58]} />
            {surfaceMaterial("service_tile", "#757c81")}
          </mesh>
          <mesh castShadow receiveShadow position={[-0.16, 1.1, 0.04]} rotation-y={0.08}>
            <boxGeometry args={[0.42, 0.05, 0.28]} />
            {surfaceMaterial("plaster", "#d2c4b6")}
          </mesh>
          <mesh castShadow receiveShadow position={[0.58, 1.11, -0.08]} rotation-y={-0.016}>
            <boxGeometry args={[0.2, 0.12, 0.2]} />
            {surfaceMaterial("service_paint", "#3b4750")}
          </mesh>
          <mesh castShadow receiveShadow position={[0.36, 1.13, 0.02]} rotation-y={0.11}>
            <boxGeometry args={[0.34, 0.05, 0.22]} />
            <meshPhysicalMaterial color="#3e5360" roughness={0.42} metalness={0.22} emissive="#79b7d0" emissiveIntensity={deskScreenGlow} clearcoat={0.28} clearcoatRoughness={0.16} />
          </mesh>
          <mesh castShadow receiveShadow position={[1.08, 1.86, -0.36]}>
            <boxGeometry args={[0.9, 1.5, 0.1]} />
            {surfaceMaterial("glass", "#627c8b")}
          </mesh>
          <mesh castShadow receiveShadow position={[1.08, 1.12, -0.34]}>
            <boxGeometry args={[1.02, 0.12, 0.18]} />
            {surfaceMaterial("paneled", "#3d474e")}
          </mesh>
          <pointLight position={[0.34, 1.34, 0.08]} intensity={deskScreenFill} distance={1.6} color="#7fb8cf" />
        </group>

        <group position={[4.54, 0.52, 20.68]} rotation-y={0.01}>
          <mesh castShadow receiveShadow position={[0, 0.05, 0]}>
            <boxGeometry args={[2.96, 0.1, 0.96]} />
            {surfaceMaterial("stone", "#404345")}
          </mesh>
          <mesh castShadow receiveShadow position={[0, 0.3, 0]}>
            <boxGeometry args={[2.8, 0.14, 0.86]} />
            {surfaceMaterial("plaster", "#606462")}
          </mesh>
          <mesh castShadow receiveShadow position={[0, 0.72, -0.26]}>
            <boxGeometry args={[2.76, 0.58, 0.18]} />
            {surfaceMaterial("plaster", "#727371")}
          </mesh>
          {[-1.06, 0, 1.06].map((x, index) => (
            <mesh key={`bench-leg-${index}`} castShadow receiveShadow position={[x, 0.2, 0.12]}>
              <boxGeometry args={[0.14, 0.4, 0.14]} />
              {surfaceMaterial("paneled", index === 1 ? "#4f4237" : "#594b3f")}
            </mesh>
          ))}
        </group>

        <group position={[-13.34, 0.74, 15.22]} rotation-y={-0.372}>
          <mesh castShadow receiveShadow position={[0, 0.12, 0]}>
            <boxGeometry args={[2.38, 0.16, 0.88]} />
            {surfaceMaterial("stone", "#393f45")}
          </mesh>
          <mesh castShadow receiveShadow position={[0, 0.68, 0]}>
            <boxGeometry args={[2.18, 1.18, 0.74]} />
            {surfaceMaterial("service_paint", "#56636c")}
          </mesh>
          <mesh castShadow receiveShadow position={[0, 1.34, 0]}>
            <boxGeometry args={[2.06, 0.1, 0.62]} />
            {surfaceMaterial("stone", "#808a91")}
          </mesh>
          {[-0.92, 0.92].map((x, index) => (
            <mesh key={`queue-foot-${index}`} castShadow receiveShadow position={[x, 0.24, 0.24]}>
              <boxGeometry args={[0.18, 0.26, 0.18]} />
              {surfaceMaterial("paneled", index === 0 ? "#3b434b" : "#465059")}
            </mesh>
          ))}
        </group>

        <group position={[-18.38, 0, 16.28]} rotation-y={-0.374}>
          <mesh castShadow receiveShadow position={[0, 0.18, 0]}>
            <boxGeometry args={[0.58, 0.36, 4.34]} />
            {surfaceMaterial("stone", "#30363a")}
          </mesh>
          <mesh castShadow receiveShadow position={[0, 1.8, 0]}>
            <boxGeometry args={[0.42, 3.26, 4.2]} />
            {surfaceMaterial("paneled", "#51463d")}
          </mesh>
          <mesh castShadow receiveShadow position={[0.1, 1.76, 0]}>
            <boxGeometry args={[0.7, 0.26, 4.52]} />
            {surfaceMaterial("stone", "#34393d")}
          </mesh>
          <mesh castShadow receiveShadow position={[0.08, 3.36, 0]}>
            <boxGeometry args={[0.54, 0.16, 4.4]} />
            {surfaceMaterial("paneled", "#67584c")}
          </mesh>
        </group>

        <group position={[-21.8, 0.98, 11.84]} rotation-y={0.012}>
          <mesh castShadow receiveShadow position={[0, 0.07, 0]}>
            <boxGeometry args={[2.58, 0.14, 1.42]} />
            {surfaceMaterial("stone", "#3a4045")}
          </mesh>
          <mesh castShadow receiveShadow position={[0, 0.62, 0]}>
            <boxGeometry args={[2.38, 0.98, 1.24]} />
            {surfaceMaterial("service_paint", "#4b5760")}
          </mesh>
          <mesh castShadow receiveShadow position={[0, 1.24, 0]}>
            <boxGeometry args={[2.12, 0.08, 0.94]} />
            {surfaceMaterial("service_tile", "#7c858d")}
          </mesh>
          <mesh castShadow receiveShadow position={[-1.02, 0.46, 0]}>
            <boxGeometry args={[0.12, 0.82, 1.12]} />
            {surfaceMaterial("paneled", "#3f4951")}
          </mesh>
          <mesh castShadow receiveShadow position={[1.02, 0.46, 0]}>
            <boxGeometry args={[0.12, 0.82, 1.12]} />
            {surfaceMaterial("paneled", "#445058")}
          </mesh>
        </group>

        <mesh position={[-4.54, 0.02, 4.84]} rotation-x={-Math.PI / 2} receiveShadow>
          <planeGeometry args={[0.4, 18.2]} />
          <meshBasicMaterial color="#090a0c" transparent opacity={0.24} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[8.32, 0.02, 5.98]} rotation-x={-Math.PI / 2} receiveShadow>
          <planeGeometry args={[0.42, 16.2]} />
          <meshBasicMaterial color="#0a0c0d" transparent opacity={0.22} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[2.01, 0.03, 2.05]} rotation-x={-Math.PI / 2} receiveShadow>
          <planeGeometry args={[10.8, 0.7]} />
          <meshBasicMaterial color="#0e0f11" transparent opacity={0.24} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[4.3, 0.01, 13.58]} rotation-x={-Math.PI / 2} receiveShadow>
          <planeGeometry args={[4.3, 1.7]} />
          <meshBasicMaterial color="#090a0c" transparent opacity={0.28} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[4.48, 0.01, 20.8]} rotation-x={-Math.PI / 2} receiveShadow>
          <planeGeometry args={[3.3, 1.2]} />
          <meshBasicMaterial color="#08090b" transparent opacity={0.26} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[-8.7, 0.055, 13.12]} rotation-x={-Math.PI / 2} rotation-z={-0.38} receiveShadow>
          <planeGeometry args={[3.8, 0.12]} />
          <meshBasicMaterial color="#7a6859" transparent opacity={0.34} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[-8.82, 0.018, 12.58]} rotation-x={-Math.PI / 2} rotation-z={-0.374} receiveShadow>
          <planeGeometry args={[4.5, 0.64]} />
          <meshBasicMaterial color="#090a0c" transparent opacity={0.24} side={THREE.DoubleSide} />
        </mesh>
        {[-2.8, 5.1].map((x, index) => (
          <group key={`arrival-column-${index}`} position={[x + (index === 0 ? -0.03 : 0.02), 1.95, 10.2 + (index === 0 ? 0.04 : -0.02)]} rotation-y={index === 0 ? 0.01 : -0.008}>
            <mesh castShadow receiveShadow position={[0, -1.6, 0]}>
              <boxGeometry args={[1.12, 0.34, 1.12]} />
              {surfaceMaterial("stone", index === 0 ? "#2d2f32" : "#333538")}
            </mesh>
            <mesh castShadow receiveShadow>
              <boxGeometry args={[0.74, 3.2, 0.74]} />
              {surfaceMaterial("paneled", index === 0 ? "#54473d" : "#5a4c42")}
            </mesh>
            <mesh castShadow receiveShadow position={[0, 1.66, 0]}>
              <boxGeometry args={[0.98, 0.34, 0.98]} />
              {surfaceMaterial("paneled", index === 0 ? "#715d4c" : "#776251")}
            </mesh>
            <mesh castShadow receiveShadow position={[0, -1.34, 0]}>
              <boxGeometry args={[0.86, 0.18, 0.86]} />
              {surfaceMaterial("stone", index === 0 ? "#43474b" : "#494d51")}
            </mesh>
            <mesh castShadow receiveShadow position={[0, 1.98, 0]}>
              <boxGeometry args={[0.82, 0.14, 0.82]} />
              {surfaceMaterial("paneled", index === 0 ? "#84705d" : "#897562")}
            </mesh>
          </group>
        ))}
      </group>
    </>
  );
}

function MissionVariantDressings() {
  const { layoutVariant, palette, securityTier, seed } = useMissionVariantPresentation();

  if (layoutVariant.landmarkFocus === "service") {
    return (
      <>
        <mesh position={[-30, 2.3, 10]} castShadow receiveShadow>
          <boxGeometry args={[10, 4.6, 0.2]} />
          <meshPhysicalMaterial color={palette.coolAccent} roughness={0.42} metalness={0.18} emissive={palette.coolAccent} emissiveIntensity={0.12} />
        </mesh>
        <mesh position={[-26, 1.1, -11]} castShadow receiveShadow>
          <boxGeometry args={[6.6, 2.2, 3.8]} />
          {surfaceMaterial("service_tile", palette.cloth)}
        </mesh>
        <mesh position={[17, -1.2, -12]} castShadow receiveShadow>
          <boxGeometry args={[11, 2.4, 0.24]} />
          {surfaceMaterial("paneled", shiftHex(palette.publicAccent, 0.01, -0.06))}
        </mesh>
      </>
    );
  }

  if (layoutVariant.landmarkFocus === "marina") {
    return (
      <>
        <mesh position={[44, 2.2, 17]} castShadow receiveShadow>
          <boxGeometry args={[12, 4.4, 0.24]} />
          <meshPhysicalMaterial color={palette.coolAccent} roughness={0.26} metalness={0.38} emissive={palette.coolAccent} emissiveIntensity={0.16} />
        </mesh>
        <mesh position={[57, 1.3, -40]} castShadow receiveShadow>
          <boxGeometry args={[8, 2.6, 3.6]} />
          {surfaceMaterial("service_tile", shiftHex("#59616b", (seed % 5) * 0.006))}
        </mesh>
        <mesh position={[31, 0.6, 12]} castShadow receiveShadow>
          <boxGeometry args={[7.5, 1.2, 7.5]} />
          {surfaceMaterial("stone", shiftHex("#34383c", 0.01))}
        </mesh>
      </>
    );
  }

  if (layoutVariant.landmarkFocus === "annex") {
    return (
      <>
        <mesh position={[63, 2.8, -18]} castShadow receiveShadow>
          <boxGeometry args={[9, 5.4, 0.24]} />
          <meshPhysicalMaterial color={palette.warmAccent} roughness={0.36} metalness={0.24} emissive={palette.warmAccent} emissiveIntensity={0.18} />
        </mesh>
        <mesh position={[59, 0.5, -16]} castShadow receiveShadow>
          <boxGeometry args={[7, 1, 7]} />
          {surfaceMaterial("carpet", shiftHex("#302826", 0, securityTier === "hardened" ? -0.03 : 0.02))}
        </mesh>
        <mesh position={[71, 1.3, -8]} castShadow receiveShadow>
          <boxGeometry args={[3.6, 2.6, 6.8]} />
          {surfaceMaterial("glass", shiftHex("#6d7f8f", 0.02))}
        </mesh>
      </>
    );
  }

  return (
    <>
      <mesh position={[0, 0.08, 7]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[10.8, 5.6]} />
        {surfaceMaterial("carpet", shiftHex("#3a2623", 0.008, 0.01))}
      </mesh>
      <mesh position={[0, 3.12, 1.8]} castShadow receiveShadow>
        <boxGeometry args={[8.4, 1.2, 0.18]} />
        <meshPhysicalMaterial color={palette.warmAccent} roughness={0.34} metalness={0.16} emissive={palette.warmAccent} emissiveIntensity={0.12} />
      </mesh>
      <mesh position={[-9.8, 1.32, 13.7]} castShadow receiveShadow rotation-y={-0.38}>
        <boxGeometry args={[3.8, 2.6, 0.18]} />
        {surfaceMaterial("paneled", palette.publicAccent)}
      </mesh>
    </>
  );
}

function LandmarkSilhouettes() {
  return (
    <>
      <group position={[0, 0, -0.9]}>
        <mesh position={[0, 1.55, 0]} castShadow receiveShadow>
          <boxGeometry args={[12, 3.1, 0.64]} />
          {surfaceMaterial("paneled", "#63493d")}
        </mesh>
        <mesh position={[0, 2.98, 0.12]} castShadow receiveShadow>
          <boxGeometry args={[12.4, 0.28, 0.82]} />
          {surfaceMaterial("paneled", "#765947")}
        </mesh>
        <mesh position={[0, 0.22, 0.1]} castShadow receiveShadow>
          <boxGeometry args={[12.4, 0.32, 0.82]} />
          {surfaceMaterial("stone", "#2e3135")}
        </mesh>
      </group>
      <mesh position={[63, 2.6, -16]} castShadow receiveShadow>
        <boxGeometry args={[11, 5.2, 0.6]} />
        <meshPhysicalMaterial color="#4c535a" roughness={0.34} metalness={0.4} emissive="#6c3122" emissiveIntensity={0.18} />
      </mesh>
      <mesh position={[61, 1.35, -39]} castShadow receiveShadow>
        <boxGeometry args={[4.5, 2.7, 0.28]} />
        {surfaceMaterial("paneled", "#8a6455")}
      </mesh>
      <mesh position={[-20, -0.9, -14]} castShadow receiveShadow>
        <boxGeometry args={[18, 2.2, 1.1]} />
        {surfaceMaterial("paneled", "#5e4d40")}
      </mesh>
      <mesh position={[58, 1.8, -50]} castShadow receiveShadow>
        <boxGeometry args={[13, 3.6, 0.8]} />
        {surfaceMaterial("paneled", "#724733")}
      </mesh>
    </>
  );
}

function GateMeshes() {
  const gateStates = usePhaseOneStore((state) => state.gateStates);

  return (
    <>
      {foundationShell.gates.map((gate) => {
        const gateState = gateStates[gate.id];
        if (gateState?.open) return null;
        const width = gate.bounds.maxX - gate.bounds.minX;
        const depth = gate.bounds.maxZ - gate.bounds.minZ;
        const centerX = (gate.bounds.minX + gate.bounds.maxX) / 2;
        const centerZ = (gate.bounds.minZ + gate.bounds.maxZ) / 2;
        return (
          <group key={gate.id}>
            <mesh position={[centerX, 1.4, centerZ]} castShadow receiveShadow>
              <boxGeometry args={[width, 2.8, depth]} />
              <meshStandardMaterial color="#7a3022" metalness={0.25} roughness={0.62} />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

function InteractableMeshes() {
  const carriedBodyId = usePhaseOneStore((state) => state.carriedBodyId);
  const hiddenBodies = usePhaseOneStore((state) => state.mission.hiddenBodies);
  const selectedOperation = useCampaignStore((state) => state.getSelectedOperation());
  const onboardingStage = useCampaignStore((state) => state.progress.onboardingStage);
  const isIntroOnboarding = onboardingStage === "first_run" && selectedOperation?.variantId === "azure-summit-fall";

  return (
    <>
      {foundationShell.interactables.map((item) => {
        if (item.type === "body" && (carriedBodyId === item.id || hiddenBodies > 0)) {
          return null;
        }
        if (isIntroOnboarding && item.id === "summit-kiosk") {
          return null;
        }
        const color = interactablePalette[item.type];
        const isTall = item.type === "door" || item.type === "body";
        const isFirstAreaItem = item.zoneId === "arrival-esplanade" || item.zoneId === "grand-lobby" || item.zoneId === "west-service-yard";
        const baseOpacity = isIntroOnboarding && isFirstAreaItem ? (item.type === "disguise" ? 0.09 : 0.06) : item.type === "extraction" ? 0.42 : 0.24;
        const ringInner = isIntroOnboarding && isFirstAreaItem ? 0.2 : 0.34;
        const ringOuter = isIntroOnboarding && isFirstAreaItem ? 0.28 : 0.46;
        return (
          <group key={item.id} position={item.position}>
            <mesh castShadow receiveShadow position={[0, isTall ? 0.85 : 0.45, 0]}>
              {item.type === "door" ? (
                <boxGeometry args={[1, 1.8, 0.18]} />
              ) : item.type === "body" ? (
                <capsuleGeometry args={[0.28, 1.15, 6, 10]} />
              ) : item.type === "container" ? (
                <boxGeometry args={[1.1, 0.85, 0.9]} />
              ) : item.type === "sabotage" ? (
                <boxGeometry args={[0.9, 1.1, 0.3]} />
              ) : item.type === "extraction" ? (
                <boxGeometry args={[0.7, 0.24, 0.7]} />
              ) : (
                <boxGeometry args={[0.62, 0.36, 0.48]} />
              )}
              <meshStandardMaterial color={color} roughness={0.72} metalness={item.type === "sabotage" ? 0.35 : 0.12} />
            </mesh>
            {item.type === "door" ? (
              <>
                <mesh castShadow receiveShadow position={[-0.56, 0.9, 0]}>
                  <boxGeometry args={[0.08, 1.96, 0.24]} />
                  {surfaceMaterial("paneled", "#4f4036")}
                </mesh>
                <mesh castShadow receiveShadow position={[0.56, 0.9, 0]}>
                  <boxGeometry args={[0.08, 1.96, 0.24]} />
                  {surfaceMaterial("paneled", "#4f4036")}
                </mesh>
                <mesh castShadow receiveShadow position={[0, 1.82, 0]}>
                  <boxGeometry args={[1.16, 0.08, 0.24]} />
                  {surfaceMaterial("paneled", "#655244")}
                </mesh>
              </>
            ) : (
              <>
                <mesh rotation-x={-Math.PI / 2} position={[0, 0.03, 0]} receiveShadow>
                  <ringGeometry args={[ringInner, ringOuter, 28]} />
                  <meshBasicMaterial color={color} transparent opacity={baseOpacity} side={THREE.DoubleSide} />
                </mesh>
                <mesh position={[0, isTall ? 1.72 : 0.82, 0]}>
                  <boxGeometry args={isIntroOnboarding && isFirstAreaItem ? [0.035, 0.035, 0.035] : [0.08, 0.08, 0.08]} />
                  <meshBasicMaterial color={isIntroOnboarding && isFirstAreaItem ? "#d9d1c7" : "#efe8df"} />
                </mesh>
              </>
            )}
          </group>
        );
      })}
    </>
  );
}

function WatcherVolume({ watcher }: { watcher: WatcherDefinition }) {
  const groupRef = useRef<THREE.Group>(null);
  const aiDebug = usePhaseOneStore((state) => state.aiDebug);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    if (watcher.kind !== "searchlight") {
      groupRef.current.rotation.y = watcher.facing;
      return;
    }
    const sweep = Math.sin(clock.elapsedTime * (watcher.sweepSpeed || 1)) * (watcher.sweepAmplitude || 0);
    groupRef.current.rotation.y = watcher.facing + sweep;
  });

  return (
    <group ref={groupRef} position={watcher.position}>
      <mesh position={[0, -0.2, 0]} castShadow>
        <cylinderGeometry args={[0.28, 0.34, 0.6, 10]} />
        <meshStandardMaterial color={watcher.kind === "checkpoint" ? "#a55141" : watcher.kind === "searchlight" ? "#d8c18f" : "#8b4f44"} metalness={0.4} roughness={0.48} />
      </mesh>
      {aiDebug ? (
        <mesh position={[0, -watcher.position[1] + 0.03, watcher.range * 0.32]} rotation-x={-Math.PI / 2}>
          <circleGeometry args={[watcher.range * 0.95, 40, -watcher.fov * 0.5, watcher.fov]} />
          <meshBasicMaterial
            color={watcher.kind === "searchlight" ? "#f8df9a" : watcher.enforcer ? "#a84432" : "#744e44"}
            transparent
            opacity={watcher.kind === "searchlight" ? 0.12 : 0.08}
            side={THREE.DoubleSide}
          />
        </mesh>
      ) : null}
    </group>
  );
}

function WatcherMeshes() {
  const selectedOperation = useCampaignStore((state) => state.getSelectedOperation());
  const onboardingStage = useCampaignStore((state) => state.progress.onboardingStage);
  const isIntroOnboarding = onboardingStage === "first_run" && selectedOperation?.variantId === "azure-summit-fall";
  const hiddenWatcherZones = isIntroOnboarding ? new Set(["arrival-esplanade", "grand-lobby", "west-service-yard"]) : null;

  return (
    <>
      {foundationShell.watchers
        .filter((watcher) => !(hiddenWatcherZones && watcher.zoneIds.some((zoneId) => hiddenWatcherZones.has(zoneId))))
        .map((watcher) => (
        <WatcherVolume key={watcher.id} watcher={watcher} />
      ))}
    </>
  );
}

function ActorMarker() {
  const { selectedOperation, layoutVariant, palette } = useMissionVariantPresentation();
  const actors = usePhaseOneStore((state) => state.aiActors);
  const aiDebug = usePhaseOneStore((state) => state.aiDebug);
  const alertLevel = usePhaseOneStore((state) => state.globalAlertLevel);

  return (
    <>
      {actors.map((actor) => {
        const bodyHeight = actorHeights[actor.role];
        const alertTint =
          actor.state === "searching" || actor.state === "alerted"
            ? "#d97757"
            : actor.state === "investigating" || actor.state === "suspicious"
              ? "#d4b15a"
              : actor.color;
        const isDown = actor.state === "down";
        const tensionTilt =
          actor.role === "bodyguard" && actor.formation !== "loose"
            ? 0.18
            : actor.state === "alerted"
              ? 0.14
              : actor.state === "investigating" || actor.state === "searching"
                ? 0.1
                : actor.role === "civilian" && actor.state === "fleeing"
                  ? -0.08
                  : 0;
        const roleWidth = actor.role === "bodyguard" ? 0.34 : actor.role === "guard" ? 0.31 : 0.28;
        const pulse = 1 + Math.sin((actor.routeIndex + 1) * 1.9 + actor.routineElapsed * 0.1) * 0.035;
        const headLeanY = actor.state === "investigating" ? bodyHeight + 0.38 : actor.state === "alerted" ? bodyHeight + 0.44 : bodyHeight + 0.48;
        const bodyguardScale = actor.role === "bodyguard" && selectedOperation?.runtimeConfig.securityTier !== "guarded" ? 1.06 : 1;
        const wardrobeTone =
          actor.role === "civilian"
            ? layoutVariant.landmarkFocus === "annex"
              ? palette.cloth
              : layoutVariant.landmarkFocus === "marina"
                ? palette.coolAccent
                : actor.color
            : actor.role === "staff"
              ? palette.publicAccent
              : alertTint;
        return (
          <group key={actor.id} position={actor.position} rotation-y={actor.facing + tensionTilt}>
            <mesh castShadow position={[0, isDown ? 0.22 : bodyHeight * 0.5, 0]} rotation-z={isDown ? Math.PI / 2 : 0} scale={[pulse * bodyguardScale, 1, pulse * bodyguardScale]}>
              <capsuleGeometry args={[roleWidth, isDown ? 0.85 : bodyHeight, 6, 10]} />
              <meshStandardMaterial color={actor.role === "target" ? palette.warmAccent : wardrobeTone} roughness={actor.role === "target" ? 0.62 : 0.78} metalness={actor.role === "bodyguard" ? 0.18 : 0.05} />
            </mesh>
            <mesh castShadow position={[isDown ? 0.42 : actor.state === "investigating" ? 0.12 : 0, isDown ? 0.28 : headLeanY, actor.state === "alerted" ? 0.06 : 0]}>
              <sphereGeometry args={[0.22, 12, 12]} />
              <meshStandardMaterial color="#d7c8bc" roughness={0.9} />
            </mesh>
            {!isDown ? (
              <mesh position={[0, bodyHeight * 0.72, actor.role === "civilian" && actor.state === "fleeing" ? -0.06 : 0.08]} rotation-x={actor.state === "investigating" ? 0.22 : actor.state === "alerted" ? 0.28 : 0.08}>
                <boxGeometry args={[roleWidth * 1.4, bodyHeight * 0.24, 0.14]} />
                <meshStandardMaterial color={actor.role === "guard" || actor.role === "bodyguard" ? "#23262a" : palette.cloth} roughness={0.76} />
              </mesh>
            ) : null}
            {actor.role === "target" || actor.role === "bodyguard" ? (
              <mesh position={[0, bodyHeight + 0.86, 0]}>
                <ringGeometry args={[0.22, 0.3, 20]} />
                <meshBasicMaterial color={actor.role === "target" ? "#dfb28b" : "#c88f62"} transparent opacity={0.45 + alertLevel * 0.06} side={THREE.DoubleSide} />
              </mesh>
            ) : null}
            {aiDebug ? (
              <Text position={[0, isDown ? 1.15 : bodyHeight + 1.08, 0]} fontSize={0.34} color={actor.role === "target" ? "#ffcdc8" : "#f2eee6"} anchorX="center" anchorY="middle">
                {`${actor.label} / ${isDown ? "down" : actor.state}`}
              </Text>
            ) : null}
          </group>
        );
      })}
    </>
  );
}

function RouteDebugLines() {
  const aiDebug = usePhaseOneStore((state) => state.aiDebug);
  const incidents = usePhaseOneStore((state) => state.activeIncidents);
  const dangerZones = usePhaseOneStore((state) => state.dangerZones);
  const searchAssignments = usePhaseOneStore((state) => state.searchAssignments);
  const assignments = usePhaseOneStore((state) => state.guardResponseAssignments);

  const routeLines = useMemo(() => {
    if (!aiDebug) return [];
    const lines: Array<{ id: string; points: Vec3[]; color: string }> = [];
    for (const route of foundationShell.aiRoutes) {
      lines.push({
        id: route.id,
        points: route.points,
        color: route.id.includes("guard") ? "#7f6a4b" : route.id.includes("target") || route.id.includes("bodyguard") ? "#7c5b5b" : "#3c5962",
      });
    }
    for (const route of foundationShell.searchNodes) {
      lines.push({ id: route.id, points: route.points, color: "#8b4e37" });
    }
    return lines;
  }, [aiDebug]);

  if (!aiDebug) return null;

  return (
    <>
      {routeLines.map((line) => (
        <Line key={line.id} points={line.points} color={line.color} lineWidth={1} transparent opacity={0.5} />
      ))}
      {searchAssignments.map((assignment) => (
        <Line key={`${assignment.actorId}-${assignment.routeId}`} points={[assignment.target, [assignment.target[0], assignment.target[1] + 2.4, assignment.target[2]]]} color="#f28f5b" lineWidth={1.6} transparent opacity={0.85} />
      ))}
      {dangerZones.map((zone) => (
        <mesh key={zone.id} rotation-x={-Math.PI / 2} position={[zone.center[0], zone.center[1] + 0.03, zone.center[2]]}>
          <ringGeometry args={[Math.max(0.4, zone.radius - 0.5), zone.radius, 48]} />
          <meshBasicMaterial color="#c55a44" transparent opacity={0.18} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {incidents.map((incident) => (
        <Fragment key={incident.id}>
          <mesh position={[incident.position[0], incident.position[1] + 0.2, incident.position[2]]}>
            <sphereGeometry args={[0.22, 10, 10]} />
            <meshBasicMaterial color={incident.confirmed ? "#ff8a5b" : "#d3ad63"} />
          </mesh>
          <Text position={[incident.position[0], incident.position[1] + 1.2, incident.position[2]]} fontSize={0.28} color="#ffe7d8" anchorX="center" anchorY="middle">
            {`${incident.category} / ${incident.confirmed ? "confirmed" : "tracking"}`}
          </Text>
        </Fragment>
      ))}
      {assignments.map((assignment) => {
        const actor = usePhaseOneStore.getState().aiActors.find((entry) => entry.id === assignment.actorId);
        if (!actor) return null;
        return (
          <Text key={`${assignment.actorId}-${assignment.incidentId}`} position={[actor.position[0], actor.position[1] + 2.1, actor.position[2]]} fontSize={0.23} color="#f6d49a" anchorX="center" anchorY="middle">
            {assignment.role}
          </Text>
        );
      })}
    </>
  );
}

function TeammateMarkers() {
  const localPlayerId = useMultiplayerStore((state) => state.localPlayerId);
  const players = useMultiplayerStore((state) => state.players);
  const missionState = useMultiplayerStore((state) => state.missionState);

  return (
    <>
      {players
        .filter((player) => player.playerId !== localPlayerId)
        .map((player) => (
          <group key={player.playerId} position={player.position} rotation-y={player.facing}>
            <mesh castShadow position={[0, player.posture === "crouch" ? 0.44 : 0.72, 0]}>
              <capsuleGeometry args={[0.24, player.posture === "crouch" ? 0.68 : 1.1, 6, 10]} />
              <meshStandardMaterial color={player.role === "support" ? "#88a2bf" : player.role === "disruptor" ? "#bf8f6f" : player.role === "scout" ? "#9eb58b" : "#d9d5cf"} roughness={0.74} metalness={0.06} />
            </mesh>
            <mesh position={[0, player.posture === "crouch" ? 1.04 : 1.42, 0]} castShadow>
              <sphereGeometry args={[0.2, 12, 12]} />
              <meshStandardMaterial color="#cabeb1" roughness={0.92} />
            </mesh>
            <Text position={[0, player.posture === "crouch" ? 1.55 : 1.98, 0]} fontSize={0.26} color="#d7edf8" anchorX="center" anchorY="middle">
              {`${player.name} / ${player.role}`}
            </Text>
          </group>
        ))}
      {(missionState?.pings || []).map((ping) => (
        <group key={ping.id} position={ping.position}>
          <mesh position={[0, 0.05, 0]} rotation-x={-Math.PI / 2}>
            <ringGeometry args={[0.42, 0.68, 24]} />
            <meshBasicMaterial color="#8fd0ff" transparent opacity={0.75} side={THREE.DoubleSide} />
          </mesh>
          <Text position={[0, 1.2, 0]} fontSize={0.22} color="#d7edf8" anchorX="center" anchorY="middle">
            {ping.label}
          </Text>
        </group>
      ))}
    </>
  );
}

function StoryRemixLayer() {
  return null;
}

function IntroGuidanceLayer() {
  const onboardingStage = useCampaignStore((state) => state.progress.onboardingStage);
  const selectedOperation = useCampaignStore((state) => state.getSelectedOperation());
  const currentZoneId = usePhaseOneStore((state) => state.currentZoneId);
  const suspicion = usePhaseOneStore((state) => state.suspicion);
  const pulse = useRef(0);
  const isIntroOnboarding = onboardingStage === "first_run" && selectedOperation?.variantId === "azure-summit-fall";

  useFrame((_, delta) => {
    pulse.current += delta;
  });

  if (!isIntroOnboarding) return null;

  const pathGlow = 0.2 + Math.sin(pulse.current * 1.6) * 0.05;
  const riskGlow = 0.16 + Math.sin(pulse.current * 2.3 + 0.8) * 0.05 + Math.min(0.14, suspicion / 220);
  const routeVisible = currentZoneId === "arrival-esplanade" || currentZoneId === "grand-lobby";
  const routeBias = routeVisible ? 1.38 : 1.16;
  const coolPocketBias = routeVisible ? 0.52 : 0.7;

  return (
    <>
      <pointLight position={[1.2, 2.95, 14.8]} intensity={(1.2 + pathGlow * 1.08) * routeBias} distance={14.2} color="#f6d29d" />
      <pointLight position={[-12.1, 2.8, 13]} intensity={(1.48 + pathGlow * 1.14) * routeBias} distance={12.8} color="#f0b97a" />
      <pointLight position={[-21.9, 2.28, 11.1]} intensity={(0.36 + pathGlow * 0.34) * coolPocketBias} distance={7.6} color="#4f7083" />
      <pointLight position={[-5.1, 2.62, 7.9]} intensity={0.18 + riskGlow * 0.52} distance={5.8} color="#713d34" />
    </>
  );
}

interface EnvironmentSceneProps {
  selectedOperation: GeneratedMissionDefinition | null;
  missionState: MissionProgressState;
}

export default function EnvironmentScene({ selectedOperation, missionState }: EnvironmentSceneProps) {
  useEffect(() => {
    console.info("[EnvironmentScene] initialized", {
      operationId: selectedOperation?.id ?? null,
      missionId: selectedOperation?.templateId ?? null,
      variantId: selectedOperation?.variantId ?? null,
      targetEliminated: missionState.targetEliminated,
      missionComplete: missionState.missionComplete,
    });

    return () => {
      console.info("[EnvironmentScene] disposed", {
        operationId: selectedOperation?.id ?? null,
      });
    };
  }, [
    missionState.missionComplete,
    missionState.targetEliminated,
    selectedOperation?.id,
    selectedOperation?.templateId,
    selectedOperation?.variantId,
  ]);

  return (
    <group
      key={selectedOperation?.id || "no-operation"}
      userData={{
        operationId: selectedOperation?.id ?? null,
        missionId: selectedOperation?.templateId ?? null,
        variantId: selectedOperation?.variantId ?? null,
        missionComplete: missionState.missionComplete,
      }}
    >
      <WaterfrontShell />
      <FirstPlayableAreaShell />
      <StructureMeshes />
      <ArchitecturalDetail />
      <MissionVariantDressings />
      <LandmarkSilhouettes />
      <DecorativeProps />
      <IntroGuidanceLayer />
      <GateMeshes />
      <InteractableMeshes />
      <WatcherMeshes />
      <ActorMarker />
      <StoryRemixLayer />
      <TeammateMarkers />
      <RouteDebugLines />
    </group>
  );
}
