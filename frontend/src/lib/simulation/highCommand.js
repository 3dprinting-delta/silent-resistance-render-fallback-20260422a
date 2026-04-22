export function eliminateTarget(worldState, targetId) {
  const nextState = structuredClone(worldState);
  const target = nextState.highCommand.find((entry) => entry.id === targetId);

  if (!target) {
    return null;
  }

  target.isAlive = false;
  return nextState;
}

function promoteReplacement(nextState, target) {
  const region = nextState.regions.find((entry) => entry.name === target.region);
  const pool = region?.npcs.filter(
    (npc) =>
      !npc.isHighCommand &&
      (npc.npcType === "vanguard_officer" || npc.npcType === "enforcer"),
  );

  if (!pool?.length) {
    return false;
  }

  const replacement = pool[0];
  replacement.isHighCommand = true;
  replacement.rank = `Acting ${target.rank}`;
  region.difficultyModifier += 1;

  nextState.highCommand.push({
    id: `hc-${replacement.id}`,
    name: replacement.name,
    rank: replacement.rank,
    region: target.region,
    difficultyModifier: region.difficultyModifier,
    isAlive: true,
  });

  target.replaced = true;
  return true;
}

export function updateHighCommand(worldState) {
  const nextState = structuredClone(worldState);
  const vacantTargets = nextState.highCommand.filter((target) => !target.isAlive && !target.replaced);

  vacantTargets.forEach((target) => {
    promoteReplacement(nextState, target);
  });

  return nextState;
}
