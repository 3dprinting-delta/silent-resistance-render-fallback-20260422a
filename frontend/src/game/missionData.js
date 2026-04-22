export const missionBrief = {
  id: "kronstadt-district-blackout",
  title: "Kronstadt Blackout Window",
  targetId: "hc-3",
  extractionZoneId: "tram_extraction",
  districtName: "Kronstadt District",
  summary:
    "A dense occupied district under curfew pressure, with worker circulation, cargo security, and a command annex that creates overlapping layers of public access and restricted authority space.",
  routeNotes: [
    "Worker square is the safest civilian traffic layer but becomes exposed if patrols reroute from the checkpoint boulevard.",
    "Service alleys are safer for technician cover and lead to the annex side entrance and generator yard.",
    "The command court is visually controlled space; officer cover is safest there, but enforcers scrutinize body language heavily.",
    "Extraction remains open at the tram trench once the district is destabilized, but only if the operative breaks contact first.",
  ],
};

export const missionZones = [
  {
    id: "tram_extraction",
    label: "Tram Trench",
    clearance: ["civilian", "vanguard_grunt", "vanguard_technician", "vanguard_officer"],
    witnessWeight: 0.6,
    bounds: { minX: -8, maxX: 8, minZ: 38, maxZ: 52 },
  },
  {
    id: "worker_square",
    label: "Worker Square",
    clearance: ["civilian", "vanguard_grunt", "vanguard_technician", "vanguard_officer"],
    witnessWeight: 0.8,
    bounds: { minX: -20, maxX: 20, minZ: 14, maxZ: 36 },
  },
  {
    id: "checkpoint_boulevard",
    label: "Checkpoint Boulevard",
    clearance: ["vanguard_grunt", "vanguard_technician", "vanguard_officer"],
    witnessWeight: 1.2,
    bounds: { minX: -12, maxX: 12, minZ: -4, maxZ: 14 },
  },
  {
    id: "service_alley",
    label: "Service Alley",
    clearance: ["vanguard_technician", "vanguard_officer"],
    witnessWeight: 0.7,
    bounds: { minX: -28, maxX: -12, minZ: 8, maxZ: 34 },
  },
  {
    id: "cargo_yard",
    label: "Cargo Yard",
    clearance: ["vanguard_grunt", "vanguard_technician", "vanguard_officer"],
    witnessWeight: 0.95,
    bounds: { minX: 12, maxX: 30, minZ: 10, maxZ: 36 },
  },
  {
    id: "command_court",
    label: "Command Court",
    clearance: ["vanguard_officer"],
    witnessWeight: 1.45,
    bounds: { minX: -11, maxX: 11, minZ: -22, maxZ: -4 },
  },
  {
    id: "annex_interior",
    label: "Annex Interior",
    clearance: ["vanguard_officer"],
    witnessWeight: 1.7,
    bounds: { minX: -7, maxX: 7, minZ: -40, maxZ: -22 },
  },
];

export const patrolRoutes = {
  civilian_square_loop: [
    [-10, 24],
    [-4, 18],
    [5, 18],
    [10, 25],
    [4, 31],
    [-7, 30],
  ],
  boulevard_patrol: [
    [-8, 6],
    [-2, 2],
    [4, 1],
    [8, 7],
    [2, 11],
    [-5, 10],
  ],
  service_tech_loop: [
    [-24, 14],
    [-18, 11],
    [-15, 18],
    [-16, 27],
    [-22, 31],
    [-25, 22],
  ],
  cargo_patrol: [
    [16, 28],
    [24, 27],
    [26, 18],
    [18, 12],
    [14, 20],
  ],
  target_route: [
    [0, -33],
    [0, -26],
    [4, -18],
    [1, -10],
    [-3, -18],
    [-1, -28],
  ],
  escort_inner: [
    [-2, -29],
    [2, -29],
    [3, -18],
    [-3, -18],
  ],
  escort_outer: [
    [-7, -24],
    [7, -24],
    [6, -12],
    [-6, -12],
  ],
};

export const missionActors = [
  { id: "civ-1", kind: "civilian", routeId: "civilian_square_loop", speed: 1.1, color: "#7a7a7a", pauseMs: 700 },
  { id: "civ-2", kind: "civilian", routeId: "civilian_square_loop", speed: 1.05, color: "#767676", pauseMs: 900, startIndex: 2 },
  { id: "tech-1", kind: "technician", routeId: "service_tech_loop", speed: 1.15, color: "#58626b", pauseMs: 800 },
  { id: "tech-2", kind: "technician", routeId: "service_tech_loop", speed: 1.05, color: "#4f5962", pauseMs: 1000, startIndex: 3 },
  { id: "guard-1", kind: "enforcer", routeId: "boulevard_patrol", speed: 1.45, color: "#7d2020", pauseMs: 450 },
  { id: "guard-2", kind: "enforcer", routeId: "boulevard_patrol", speed: 1.35, color: "#8d2323", pauseMs: 600, startIndex: 3 },
  { id: "guard-3", kind: "enforcer", routeId: "cargo_patrol", speed: 1.4, color: "#6f1c1c", pauseMs: 600 },
  { id: "officer-1", kind: "officer", routeId: "escort_outer", speed: 1.2, color: "#778089", pauseMs: 1000 },
  { id: "escort-1", kind: "enforcer", routeId: "escort_inner", speed: 1.3, color: "#912626", pauseMs: 500 },
  { id: "escort-2", kind: "enforcer", routeId: "escort_inner", speed: 1.25, color: "#861f1f", pauseMs: 700, startIndex: 2 },
];

export const missionTarget = {
  id: "hc-3",
  label: "Director Otto Mahr",
  routeId: "target_route",
  speed: 0.95,
  pauseMs: 1800,
  interactionRadius: 2.4,
  vulnerabilityWindow: {
    routeIndices: [1, 2],
    note: "Mahr lingers between balcony review and inspection descent, briefly ahead of the outer escort ring.",
  },
};

export function getZoneByPosition(position) {
  const [x, , z] = position;
  return (
    missionZones.find(
      (zone) =>
        x >= zone.bounds.minX &&
        x <= zone.bounds.maxX &&
        z >= zone.bounds.minZ &&
        z <= zone.bounds.maxZ,
    ) || null
  );
}

export function getRouteById(routeId) {
  return patrolRoutes[routeId] || [];
}
