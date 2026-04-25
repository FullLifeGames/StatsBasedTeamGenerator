import {emptyRoles} from './formatProfile';
import type {FormatProfile, PokemonStats, RoleScores} from './types';

const hazardMoves = new Set(['stealthrock', 'spikes', 'toxicspikes', 'stickyweb']);
const removalMoves = new Set(['rapidspin', 'defog', 'courtchange', 'mortalspin', 'tidyup']);
const speedControlMoves = new Set(['tailwind', 'trickroom', 'icywind', 'electroweb', 'thunderwave', 'quash']);
const positioningMoves = new Set(['protect', 'fakeout', 'followme', 'ragepowder', 'helpinghand', 'uturn', 'voltswitch', 'partingshot']);
const spreadMoves = new Set(['earthquake', 'rockslide', 'heatwave', 'dazzlinggleam', 'muddywater', 'makeitrain', 'bleakwindstorm', 'discharge']);
const setupMoves = new Set(['swordsdance', 'nastyplot', 'dragondance', 'calmmind', 'bulkup', 'irondefense']);
const statusMoves = new Set(['toxic', 'willowisp', 'thunderwave', 'spore', 'stunspore', 'glare']);
const itemDisruptionMoves = new Set(['knockoff', 'trick', 'switcheroo']);

function hasWeightedMove(stats: PokemonStats, moves: Set<string>): number {
  const total = Object.values(stats.moves).reduce((sum, value) => sum + value, 0);
  if (!total) return 0;
  const score = Object.entries(stats.moves)
    .filter(([move]) => moves.has(move))
    .reduce((sum, [, value]) => sum + value, 0);
  return Math.min(1, score / Math.max(total / 4, 1));
}

function abilityHas(stats: PokemonStats, ids: string[]): boolean {
  return ids.some(id => stats.abilities[id] > 0);
}

export function detectRoles(stats: PokemonStats, profile: FormatProfile): RoleScores {
  const roles: RoleScores = {...emptyRoles};
  const moves = stats.moves;

  roles.hazardSetter = hasWeightedMove(stats, hazardMoves);
  roles.hazardRemoval = hasWeightedMove(stats, removalMoves);
  roles.speedControl = hasWeightedMove(stats, speedControlMoves);
  roles.positioning = hasWeightedMove(stats, positioningMoves);
  roles.spreadPressure = hasWeightedMove(stats, spreadMoves);
  roles.setup = hasWeightedMove(stats, setupMoves);
  roles.status = hasWeightedMove(stats, statusMoves);
  roles.itemDisruption = hasWeightedMove(stats, itemDisruptionMoves);

  roles.hazardPreservation = stats.id.includes('gholdengo') || abilityHas(stats, ['goodasgold']) ? 0.8 : 0;
  roles.weatherTerrainSetter = abilityHas(stats, ['drizzle', 'drought', 'sandstream', 'snowwarning', 'electric surge', 'psychicsurge', 'grassy surge', 'mistysurge'].map(id => id.replace(/\s/g, ''))) ? 0.8 : 0;
  roles.support = Math.max(roles.positioning, roles.status, roles.hazardRemoval * 0.6, roles.speedControl * 0.6);
  roles.physicalBreaker = Math.min(1, ((moves.closecombat ?? 0) + (moves.earthquake ?? 0) + (moves.headlongrush ?? 0) + (moves.suckerpunch ?? 0)) / 150);
  roles.specialBreaker = Math.min(1, ((moves.moonblast ?? 0) + (moves.shadowball ?? 0) + (moves.makeitrain ?? 0) + (moves.dracometeor ?? 0)) / 150);
  roles.cleaner = Math.max(roles.speedControl * 0.4, moves.suckerpunch ? 0.6 : 0, moves.extremespeed ? 0.6 : 0);
  roles.defensivePivot = Math.min(1, ((stats.items.leftovers ?? 0) + (stats.items.rockyhelmet ?? 0) + (stats.moves.recover ?? 0) + (stats.moves.roost ?? 0)) / 150);
  roles.offensivePivot = Math.min(1, ((moves.uturn ?? 0) + (moves.voltswitch ?? 0) + (moves.flipturn ?? 0)) / 100);
  roles.boardControl = profile.battleStyle === 'doubles'
    ? Math.max(roles.speedControl * 0.7, roles.positioning * 0.6, abilityHas(stats, ['intimidate']) ? 0.75 : 0)
    : Math.max(roles.hazardSetter * 0.4, roles.hazardRemoval * 0.4);

  return roles;
}
