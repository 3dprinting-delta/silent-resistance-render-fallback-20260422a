export const TICK_INTERVAL_MS = 60_000;
export const START_DAY = 1;
export const START_HOUR = 6;
export const WORLD_ANCHOR_MS = Date.UTC(2026, 2, 28, 4, 0, 0);

export const REGION_NAMES = ["Kronstadt District", "Harbor Facility", "Vanguard HQ"];

export const REGION_LOCATIONS = {
  "Kronstadt District": {
    workerHome: "tenement_row",
    workerJob: "munitions_factory",
    securityHub: "checkpoint_north",
    officerHub: "district_command",
    leisure: "canteen_square",
  },
  "Harbor Facility": {
    workerHome: "dockside_barracks",
    workerJob: "cargo_pier",
    securityHub: "customs_gate",
    officerHub: "harbor_office",
    leisure: "smuggler_tavern",
  },
  "Vanguard HQ": {
    workerHome: "service_quarters",
    workerJob: "records_annex",
    securityHub: "atrium_checkpoint",
    officerHub: "high_command_wing",
    leisure: "officers_mess",
  },
};

export const INITIAL_REGION_DIFFICULTY = {
  "Kronstadt District": 2,
  "Harbor Facility": 3,
  "Vanguard HQ": 4,
};

export const INITIAL_HIGH_COMMAND = [
  {
    id: "hc-1",
    name: "Marshal Ansel Krell",
    rank: "Supreme Interior Director",
    region: "Vanguard HQ",
    difficultyModifier: 5,
    isAlive: true,
  },
  {
    id: "hc-2",
    name: "Commandant Ilse Voss",
    rank: "Harbor Security Prefect",
    region: "Harbor Facility",
    difficultyModifier: 4,
    isAlive: true,
  },
  {
    id: "hc-3",
    name: "Director Otto Mahr",
    rank: "Industrial Discipline Chief",
    region: "Kronstadt District",
    difficultyModifier: 3,
    isAlive: true,
  },
];
