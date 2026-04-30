import {toId} from './id';
import type {TeamMember} from './types';

const seedTerrainRequirements: Record<string, {terrain: string; label: string}> = {
  electricseed: {terrain: 'electric', label: 'Electric Terrain'},
  grassyseed: {terrain: 'grassy', label: 'Grassy Terrain'},
  mistyseed: {terrain: 'misty', label: 'Misty Terrain'},
  psychicseed: {terrain: 'psychic', label: 'Psychic Terrain'}
};

const terrainAbilities: Record<string, string> = {
  electricsurge: 'electric',
  hadronengine: 'electric',
  grassysurge: 'grassy',
  mistysurge: 'misty',
  psychicsurge: 'psychic'
};

const terrainMoves: Record<string, string> = {
  electricterrain: 'electric',
  grassyterrain: 'grassy',
  mistyterrain: 'misty',
  psychicterrain: 'psychic'
};

function selectedAbilityIds(member: TeamMember): string[] {
  const selectedAbility = toId(member.set.ability);
  if (selectedAbility) return [selectedAbility];
  return Object.keys(member.stats.abilities).map(toId);
}

export function activeTerrains(members: TeamMember[]): Set<string> {
  const terrains = new Set<string>();

  for (const member of members) {
    for (const abilityId of selectedAbilityIds(member)) {
      const terrain = terrainAbilities[abilityId];
      if (terrain) terrains.add(terrain);
    }

    for (const move of member.set.moves) {
      const terrain = terrainMoves[toId(move)];
      if (terrain) terrains.add(terrain);
    }
  }

  return terrains;
}

export function unsupportedTerrainSeedWarnings(members: TeamMember[]): string[] {
  const terrains = activeTerrains(members);

  return members.flatMap(member => {
    const itemId = toId(member.set.itemId ?? member.set.item);
    const requirement = seedTerrainRequirements[itemId];

    if (!requirement || terrains.has(requirement.terrain)) return [];
    return [`${member.stats.name} has ${member.set.item} without ${requirement.label} support`];
  });
}
