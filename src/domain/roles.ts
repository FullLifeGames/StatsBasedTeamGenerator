import {emptyRoles} from './formatProfile';
import type {FormatProfile, PokemonStats, RoleScores, WeightedTable} from './types';

const hazardMoves = new Set(['stealthrock', 'spikes', 'toxicspikes', 'stickyweb']);
const removalMoves = new Set(['rapidspin', 'defog', 'courtchange', 'mortalspin', 'tidyup']);
const speedControlMoves = new Set(['tailwind', 'trickroom', 'icywind', 'electroweb', 'thunderwave', 'quash']);
const positioningMoves = new Set(['protect', 'fakeout', 'followme', 'ragepowder', 'helpinghand', 'uturn', 'voltswitch', 'partingshot']);
const spreadMoves = new Set(['earthquake', 'rockslide', 'heatwave', 'dazzlinggleam', 'muddywater', 'makeitrain', 'bleakwindstorm', 'discharge']);
const physicalBreakerMoves = new Set(['closecombat', 'earthquake', 'headlongrush', 'suckerpunch', 'liquidation']);
const specialBreakerMoves = new Set(['moonblast', 'shadowball', 'makeitrain', 'dracometeor', 'bleakwindstorm']);
const priorityMoves = new Set(['suckerpunch', 'extremespeed', 'bulletpunch', 'aquajet', 'iceshard', 'shadowsneak']);
const recoveryMoves = new Set(['recover', 'roost', 'shoreup', 'slackoff', 'softboiled']);
const offensivePivotMoves = new Set(['uturn', 'voltswitch', 'flipturn']);
const setupMoves = new Set(['swordsdance', 'nastyplot', 'dragondance', 'calmmind', 'bulkup', 'irondefense']);
const statusMoves = new Set(['toxic', 'willowisp', 'thunderwave', 'spore', 'stunspore', 'glare']);
const itemDisruptionMoves = new Set(['knockoff', 'trick', 'switcheroo']);
const defensivePivotItems = new Set(['leftovers', 'rockyhelmet']);
const weatherTerrainSetterAbilities = ['drizzle', 'drought', 'sandstream', 'snowwarning', 'electricsurge', 'psychicsurge', 'grassysurge', 'mistysurge'];
const weatherTerrainAbuserAbilities = ['swiftswim', 'chlorophyll', 'sandrush', 'slushrush', 'protosynthesis', 'quarkdrive'];
const weatherTerrainAbuserItems = new Set(['boosterenergy', 'heatrock', 'damprock', 'smoothrock', 'icyrock', 'electricseed', 'psychicseed', 'grassyseed', 'mistyseed']);

export function hasWeightedMove(stats: PokemonStats, moves: Set<string>): number {
  return weightedMoveScore(stats.moves, moves);
}

function weightedMoveScore(moveWeights: WeightedTable, moves: Set<string>): number {
  const total = Object.values(moveWeights).reduce((sum, value) => sum + value, 0);
  if (!total) return 0;
  const score = Object.entries(moveWeights)
    .filter(([move]) => moves.has(move))
    .reduce((sum, [, value]) => sum + value, 0);
  return Math.min(1, score / Math.max(total / 4, 1));
}

function weightedTableShare(weights: WeightedTable, ids: Set<string> | string[]): number {
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
  if (!total) return 0;
  const idSet = ids instanceof Set ? ids : new Set(ids);
  const score = Object.entries(weights)
    .filter(([id]) => idSet.has(id))
    .reduce((sum, [, value]) => sum + value, 0);
  return Math.min(1, score / total);
}

export function abilityHas(stats: PokemonStats, ids: string[]): boolean {
  return ids.some(id => stats.abilities[id] > 0);
}

export function abilityShare(stats: PokemonStats, ids: string[]): number {
  return weightedTableShare(stats.abilities, ids);
}

function selectedMoveWeights(stats: PokemonStats, moveIds: string[]): WeightedTable {
  return Object.fromEntries(
    moveIds
      .filter(moveId => stats.moves[moveId] !== undefined)
      .map(moveId => [moveId, stats.moves[moveId]])
  );
}

export function detectRolesForMoves(stats: PokemonStats, profile: FormatProfile, moveIds: string[]): RoleScores {
  const roles: RoleScores = {...emptyRoles};
  const moves = selectedMoveWeights(stats, moveIds);

  roles.hazardSetter = weightedMoveScore(moves, hazardMoves);
  roles.hazardRemoval = weightedMoveScore(moves, removalMoves);
  roles.speedControl = weightedMoveScore(moves, speedControlMoves);
  roles.positioning = weightedMoveScore(moves, positioningMoves);
  roles.spreadPressure = weightedMoveScore(moves, spreadMoves);
  roles.setup = weightedMoveScore(moves, setupMoves);
  roles.status = weightedMoveScore(moves, statusMoves);
  roles.itemDisruption = weightedMoveScore(moves, itemDisruptionMoves);

  roles.hazardPreservation = abilityShare(stats, ['goodasgold']) * 0.8;
  roles.weatherTerrainSetter = abilityShare(stats, weatherTerrainSetterAbilities) * 0.8;
  roles.weatherTerrainAbuser = Math.max(
    abilityShare(stats, weatherTerrainAbuserAbilities) * 0.8,
    weightedTableShare(stats.items, weatherTerrainAbuserItems) * 0.5
  );
  roles.support = Math.max(roles.positioning, roles.status, roles.hazardRemoval * 0.6, roles.speedControl * 0.6);
  roles.physicalBreaker = weightedMoveScore(moves, physicalBreakerMoves);
  roles.specialBreaker = weightedMoveScore(moves, specialBreakerMoves);
  roles.cleaner = Math.max(roles.speedControl * 0.4, weightedMoveScore(moves, priorityMoves));
  roles.defensivePivot = Math.max(
    weightedMoveScore(moves, recoveryMoves),
    weightedTableShare(stats.items, defensivePivotItems)
  );
  roles.offensivePivot = weightedMoveScore(moves, offensivePivotMoves);
  roles.boardControl = profile.battleStyle === 'doubles'
    ? Math.max(roles.speedControl * 0.7, roles.positioning * 0.6, abilityShare(stats, ['intimidate']) * 0.75)
    : Math.max(roles.hazardSetter * 0.4, roles.hazardRemoval * 0.4);

  return roles;
}

/**
 * Whole-movepool roles are asked for many times per generation, once per sort
 * comparison in the candidate pool, and the answer never changes for a given
 * stats object. Keyed by battle style because boardControl depends on it.
 */
const wholePokemonRoleCache = new WeakMap<PokemonStats, Map<string, RoleScores>>();
const singleMoveRoleCache = new WeakMap<PokemonStats, Map<string, RoleScores>>();

/**
 * Move weighting asks for the roles of one move at a time, for every move of
 * every candidate the beam search builds a set for, so the answers are cached
 * on the stats object.
 */
export function detectRolesForMove(stats: PokemonStats, profile: FormatProfile, moveId: string): RoleScores {
  const key = `${profile.gen}:${profile.battleStyle}:${moveId}`;
  let byProfile = singleMoveRoleCache.get(stats);
  if (!byProfile) {
    byProfile = new Map();
    singleMoveRoleCache.set(stats, byProfile);
  }

  const cached = byProfile.get(key);
  if (cached) return cached;

  const roles = detectRolesForMoves(stats, profile, [moveId]);
  byProfile.set(key, roles);
  return roles;
}

export function detectRoles(stats: PokemonStats, profile: FormatProfile): RoleScores {
  const key = `${profile.gen}:${profile.battleStyle}`;
  let byProfile = wholePokemonRoleCache.get(stats);
  if (!byProfile) {
    byProfile = new Map();
    wholePokemonRoleCache.set(stats, byProfile);
  }

  const cached = byProfile.get(key);
  if (cached) return cached;

  const roles = detectRolesForMoves(stats, profile, Object.keys(stats.moves));
  byProfile.set(key, roles);
  return roles;
}
