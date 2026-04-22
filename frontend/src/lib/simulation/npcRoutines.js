import { REGION_LOCATIONS } from "@/lib/simulation/constants";

function fillSchedule(baseLocation, baseAction) {
  return Array.from({ length: 24 }, (_, time) => ({
    time,
    location: baseLocation,
    action: baseAction,
  }));
}

function setBlocks(schedule, blocks) {
  blocks.forEach(({ from, to, location, action }) => {
    for (let hour = from; hour <= to; hour += 1) {
      schedule[hour] = { time: hour, location, action };
    }
  });

  return schedule;
}

function buildOfficerRoutine(regionName) {
  const region = REGION_LOCATIONS[regionName];
  return setBlocks(fillSchedule(region.officerHub, "rest"), [
    { from: 0, to: 5, location: "officer_quarters", action: "sleep" },
    { from: 6, to: 7, location: "officers_mess", action: "briefing" },
    { from: 8, to: 11, location: region.securityHub, action: "patrol_route_A" },
    { from: 12, to: 13, location: "officers_mess", action: "meal" },
    { from: 14, to: 17, location: "inspection_corridor", action: "inspection" },
    { from: 18, to: 20, location: region.officerHub, action: "debrief" },
    { from: 21, to: 23, location: "officer_quarters", action: "private_review" },
  ]);
}

function buildWorkerRoutine(regionName) {
  const region = REGION_LOCATIONS[regionName];
  return setBlocks(fillSchedule(region.workerHome, "sleep"), [
    { from: 0, to: 6, location: region.workerHome, action: "sleep" },
    { from: 7, to: 7, location: "tram_queue", action: "commute" },
    { from: 8, to: 11, location: region.workerJob, action: "shift_work" },
    { from: 12, to: 12, location: "canteen", action: "meal" },
    { from: 13, to: 16, location: region.workerJob, action: "shift_work" },
    { from: 17, to: 18, location: region.workerHome, action: "return_home" },
    { from: 19, to: 20, location: region.leisure, action: "socialize" },
    { from: 21, to: 23, location: region.workerHome, action: "rest" },
  ]);
}

function buildTechnicianRoutine() {
  return setBlocks(fillSchedule("service_tunnel", "maintenance"), [
    { from: 0, to: 5, location: "service_quarters", action: "sleep" },
    { from: 6, to: 7, location: "maintenance_lockers", action: "prep_shift" },
    { from: 8, to: 11, location: "generator_bay", action: "systems_check" },
    { from: 12, to: 12, location: "canteen", action: "meal" },
    { from: 13, to: 16, location: "comms_corridor", action: "repair_cycle" },
    { from: 17, to: 18, location: "tool_crib", action: "inventory" },
    { from: 19, to: 23, location: "service_quarters", action: "rest" },
  ]);
}

function buildEnforcerRoutine(regionName) {
  const region = REGION_LOCATIONS[regionName];
  return setBlocks(fillSchedule(region.securityHub, "stand_watch"), [
    { from: 0, to: 4, location: "barracks", action: "sleep" },
    { from: 5, to: 6, location: "armory", action: "gear_check" },
    { from: 7, to: 11, location: region.securityHub, action: "checkpoint_sweep" },
    { from: 12, to: 12, location: "garrison_mess", action: "meal" },
    { from: 13, to: 17, location: "patrol_route_B", action: "security_patrol" },
    { from: 18, to: 19, location: region.officerHub, action: "escort_detail" },
    { from: 20, to: 23, location: "barracks", action: "standby" },
  ]);
}

export function generateRealisticRoutine(npcType, regionName) {
  switch (npcType) {
    case "vanguard_officer":
      return buildOfficerRoutine(regionName);
    case "civilian_worker":
      return buildWorkerRoutine(regionName);
    case "vanguard_technician":
      return buildTechnicianRoutine(regionName);
    case "enforcer":
      return buildEnforcerRoutine(regionName);
    default:
      return buildWorkerRoutine(regionName);
  }
}
