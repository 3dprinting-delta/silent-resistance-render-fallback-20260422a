import type { ActorDefinition, InteractableDefinition, OpportunityDefinition, RouteDefinition, ZoneDefinition } from "@/game/core/types";

export const missionMeta = {
  id: "kronstadt-blackout",
  title: "Kronstadt Blackout Window",
  targetId: "hc-3",
  targetName: "Director Otto Mahr",
  extractionZoneId: "tram-exit",
  summary:
    "An occupied industrial district built around a command annex, checkpoint boulevard, worker circulation, rail cargo pressure, and hidden service access.",
  routeNotes: [
    "Worker square is the safest public layer but exposes you to civilians and long-range patrol sightlines.",
    "Service routes favor technician cover and lead to poison and sabotage opportunities.",
    "The command annex and balcony route are officer-dominant zones where behavior matters as much as clothing.",
    "The rail trench and rooftop overpass create the safest extraction chain once the district destabilizes.",
  ],
};

export const zones: ZoneDefinition[] = [
  { id: "checkpoint", label: "Checkpoint Boulevard", clearance: ["security_grunt", "technician", "officer"], witnessWeight: 1.15, stealthModifier: 0.6, bounds: { minX: -10, maxX: 10, minZ: -6, maxZ: 16 } },
  { id: "worker-square", label: "Worker Square", clearance: ["civilian", "worker", "technician", "security_grunt", "officer"], witnessWeight: 0.85, stealthModifier: 1, bounds: { minX: -22, maxX: 22, minZ: 14, maxZ: 40 } },
  { id: "service-lane", label: "Service Alleys", clearance: ["technician", "officer"], witnessWeight: 0.7, stealthModifier: 1.15, bounds: { minX: -30, maxX: -12, minZ: 4, maxZ: 34 } },
  { id: "cargo-yard", label: "Cargo Yard", clearance: ["security_grunt", "technician", "officer"], witnessWeight: 1, stealthModifier: 0.75, bounds: { minX: 12, maxX: 34, minZ: 8, maxZ: 36 } },
  { id: "annex-court", label: "Command Court", clearance: ["officer"], witnessWeight: 1.4, stealthModifier: 0.55, bounds: { minX: -11, maxX: 11, minZ: -22, maxZ: -6 } },
  { id: "annex-interior", label: "Command Annex", clearance: ["officer"], witnessWeight: 1.65, stealthModifier: 0.4, bounds: { minX: -8, maxX: 8, minZ: -40, maxZ: -22 } },
  { id: "roof-overpass", label: "Roof Overpass", clearance: ["technician", "officer"], witnessWeight: 0.55, stealthModifier: 1.25, bounds: { minX: 10, maxX: 26, minZ: -10, maxZ: 6 } },
  { id: "tram-exit", label: "Rail Trench Exit", clearance: ["civilian", "worker", "technician", "security_grunt", "officer"], witnessWeight: 0.6, stealthModifier: 1.2, bounds: { minX: -9, maxX: 9, minZ: 40, maxZ: 54 } },
];

export const routes: RouteDefinition[] = [
  { id: "civilians-loop", points: [[-14, 1, 22], [-4, 1, 18], [9, 1, 19], [13, 1, 28], [2, 1, 34], [-10, 1, 31]] },
  { id: "checkpoint-patrol", points: [[-8, 1, 8], [-2, 1, 2], [6, 1, 2], [9, 1, 10], [2, 1, 14], [-6, 1, 13]] },
  { id: "service-tech", points: [[-26, 1, 10], [-22, 1, 18], [-18, 1, 26], [-15, 1, 16], [-20, 1, 8]] },
  { id: "cargo-guards", points: [[16, 1, 13], [24, 1, 14], [28, 1, 22], [24, 1, 32], [16, 1, 28], [14, 1, 20]] },
  { id: "overpass", points: [[12, 5, 0], [18, 5, -4], [24, 5, 0], [20, 5, 6], [13, 5, 4]] },
  { id: "target-routine", points: [[0, 1, -34], [0, 1, -26], [4, 1, -18], [1, 1, -10], [-3, 1, -18], [-1, 1, -30]] },
  { id: "escort-inner", points: [[-3, 1, -29], [3, 1, -29], [4, 1, -18], [-4, 1, -18]] },
  { id: "escort-outer", points: [[-8, 1, -24], [8, 1, -24], [7, 1, -12], [-7, 1, -12]] },
];

export const actors: ActorDefinition[] = [
  { id: "civilian-a", label: "Factory Worker", role: "civilian", routeId: "civilians-loop", speed: 1.1, visionRange: 7, recognition: 0.3, pauseMs: 800 },
  { id: "civilian-b", label: "Ration Clerk", role: "civilian", routeId: "civilians-loop", speed: 1.05, visionRange: 7, recognition: 0.3, startIndex: 3, pauseMs: 950 },
  { id: "technician-a", label: "Maintenance Tech", role: "technician", routeId: "service-tech", speed: 1.25, visionRange: 8, recognition: 0.5, pauseMs: 700 },
  { id: "technician-b", label: "Signal Engineer", role: "technician", routeId: "overpass", speed: 1.2, visionRange: 8, recognition: 0.6, pauseMs: 900 },
  { id: "guard-a", label: "Checkpoint Enforcer", role: "enforcer", routeId: "checkpoint-patrol", speed: 1.45, visionRange: 12, recognition: 0.9, disguiseEnforcer: true, patrolBias: 1.2, pauseMs: 350 },
  { id: "guard-b", label: "Checkpoint Enforcer", role: "enforcer", routeId: "checkpoint-patrol", speed: 1.38, visionRange: 12, recognition: 0.9, disguiseEnforcer: true, patrolBias: 1.15, startIndex: 3, pauseMs: 500 },
  { id: "guard-c", label: "Cargo Enforcer", role: "enforcer", routeId: "cargo-guards", speed: 1.4, visionRange: 12, recognition: 0.9, disguiseEnforcer: true, patrolBias: 1.1, pauseMs: 550 },
  { id: "officer-a", label: "District Officer", role: "officer", routeId: "escort-outer", speed: 1.15, visionRange: 10, recognition: 0.75, pauseMs: 900 },
  { id: "escort-a", label: "Inner Escort", role: "enforcer", routeId: "escort-inner", speed: 1.3, visionRange: 11, recognition: 1, disguiseEnforcer: true, pauseMs: 450 },
  { id: "escort-b", label: "Inner Escort", role: "enforcer", routeId: "escort-inner", speed: 1.28, visionRange: 11, recognition: 1, disguiseEnforcer: true, startIndex: 2, pauseMs: 650 },
  { id: "target", label: "Director Otto Mahr", role: "target", routeId: "target-routine", speed: 0.92, visionRange: 8, recognition: 0.75, pauseMs: 1600 },
];

export const opportunities: OpportunityDefinition[] = [
  { id: "social-window", label: "Officer Corridor Window", solution: "social", zoneId: "annex-court", prompt: "Approach the target during inspection descent while maintaining officer composure." },
  { id: "poison-cup", label: "Poison Office Tea", solution: "poison", zoneId: "annex-interior", prompt: "Poison the target's tea service inside the annex before his review cycle." },
  { id: "transformer-sabotage", label: "Sabotage Balcony Transformer", solution: "environmental", zoneId: "service-lane", prompt: "Sabotage the transformer that feeds the balcony lighting before the target's balcony review." },
];

export const challenges = [
  { id: "silent-hand", label: "Silent Hand", description: "Complete the social stealth elimination without entering lockdown." },
  { id: "tainted-routine", label: "Tainted Routine", description: "Eliminate the target through poison without being witnessed." },
  { id: "falling-order", label: "Falling Order", description: "Use the environmental kill and extract without a body being found first." },
  { id: "ghost-route", label: "Ghost Route", description: "Finish with no non-target casualties and no disguise breaks." },
];

export const interactables: InteractableDefinition[] = [
  { id: "worker-uniform", label: "Laundry line uniform", type: "disguise", disguise: "worker", position: [-17, 1, 26], zoneId: "worker-square", prompt: "Blend into worker traffic with a labor disguise." },
  { id: "tech-locker", label: "Maintenance locker", type: "disguise", disguise: "technician", position: [-23, 1, 12], zoneId: "service-lane", prompt: "A technician disguise opens safer service access and poison routes." },
  { id: "guard-crate", label: "Guard equipment crate", type: "disguise", disguise: "security_grunt", position: [16, 1, 14], zoneId: "cargo-yard", prompt: "Grunt cover steadies movement through checkpoints, but enforcers still probe it." },
  { id: "officer-wardrobe", label: "Officer wardrobe", type: "disguise", disguise: "officer", position: [2, 1, -24], zoneId: "annex-court", prompt: "Officer cover grants the cleanest command access, but behavior scrutiny increases." },
  { id: "tea-service", label: "Tea service", type: "poison", position: [0, 1, -34], zoneId: "annex-interior", prompt: "Contaminate the annex tea service before the target returns." },
  { id: "transformer-bank", label: "Transformer bank", type: "sabotage", position: [-22, 1, 12], zoneId: "service-lane", prompt: "Overload the balcony transformer and stage an environmental kill." },
  { id: "coal-crate", label: "Coal crate", type: "container", position: [22, 1, 26], zoneId: "cargo-yard", prompt: "Hide evidence or break line of sight in the cargo clutter." },
  { id: "tram-ladder", label: "Tram extraction ladder", type: "extraction", position: [0, 1, 47], zoneId: "tram-exit", prompt: "Use the trench ladder to exfiltrate once the objective is complete." },
];
