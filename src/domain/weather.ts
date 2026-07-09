import {toId} from './id';
import type {PokemonStats, TeamMember, WeightedTable} from './types';

export type FieldCondition = 'rain' | 'sun' | 'sand' | 'snow' | 'electric' | 'grassy' | 'misty' | 'psychic';

export const fieldConditions: FieldCondition[] = ['rain', 'sun', 'sand', 'snow', 'electric', 'grassy', 'misty', 'psychic'];

const weatherConditions = new Set<FieldCondition>(['rain', 'sun', 'sand', 'snow']);

const conditionLabels: Record<FieldCondition, string> = {
  rain: 'Rain',
  sun: 'Sun',
  sand: 'Sandstorm',
  snow: 'Snow',
  electric: 'Electric Terrain',
  grassy: 'Grassy Terrain',
  misty: 'Misty Terrain',
  psychic: 'Psychic Terrain'
};

const setterAbilities: Record<string, FieldCondition> = {
  drizzle: 'rain',
  primordialsea: 'rain',
  drought: 'sun',
  desolateland: 'sun',
  orichalcumpulse: 'sun',
  sandstream: 'sand',
  sandspit: 'sand',
  snowwarning: 'snow',
  electricsurge: 'electric',
  hadronengine: 'electric',
  grassysurge: 'grassy',
  mistysurge: 'misty',
  psychicsurge: 'psychic'
};

const setterMoves: Record<string, FieldCondition> = {
  raindance: 'rain',
  sunnyday: 'sun',
  sandstorm: 'sand',
  hail: 'snow',
  snowscape: 'snow',
  chillyreception: 'snow',
  electricterrain: 'electric',
  grassyterrain: 'grassy',
  mistyterrain: 'misty',
  psychicterrain: 'psychic'
};

const abuserAbilities: Record<string, FieldCondition> = {
  swiftswim: 'rain',
  raindish: 'rain',
  hydration: 'rain',
  dryskin: 'rain',
  chlorophyll: 'sun',
  solarpower: 'sun',
  flowergift: 'sun',
  leafguard: 'sun',
  protosynthesis: 'sun',
  sandrush: 'sand',
  sandforce: 'sand',
  sandveil: 'sand',
  slushrush: 'snow',
  snowcloak: 'snow',
  icebody: 'snow',
  iceface: 'snow',
  quarkdrive: 'electric',
  surgesurfer: 'electric',
  grasspelt: 'grassy'
};

const abuserItems: Record<string, FieldCondition> = {
  damprock: 'rain',
  heatrock: 'sun',
  smoothrock: 'sand',
  icyrock: 'snow',
  electricseed: 'electric',
  grassyseed: 'grassy',
  mistyseed: 'misty',
  psychicseed: 'psychic'
};

const abuserMoves: Record<string, FieldCondition> = {
  thunder: 'rain',
  hurricane: 'rain',
  solarbeam: 'sun',
  solarblade: 'sun',
  growth: 'sun',
  auroraveil: 'snow',
  blizzard: 'snow'
};

const moveDivisor = 4;

function mergeMax(...maps: Array<Map<FieldCondition, number>>): Map<FieldCondition, number> {
  const merged = new Map<FieldCondition, number>();

  for (const map of maps) {
    for (const [condition, share] of map) {
      merged.set(condition, Math.max(merged.get(condition) ?? 0, share));
    }
  }

  return merged;
}

function conditionShares(table: WeightedTable, mapping: Record<string, FieldCondition>, divisor = 1): Map<FieldCondition, number> {
  const shares = new Map<FieldCondition, number>();
  const total = Object.values(table).reduce((sum, weight) => sum + weight, 0);
  if (total <= 0) return shares;

  const scale = Math.max(total / divisor, 1);
  for (const [id, weight] of Object.entries(table)) {
    const condition = mapping[id];
    if (!condition || weight <= 0) continue;
    shares.set(condition, Math.min(1, (shares.get(condition) ?? 0) + weight / scale));
  }

  return shares;
}

export function settableConditions(stats: PokemonStats): Map<FieldCondition, number> {
  return mergeMax(
    conditionShares(stats.abilities, setterAbilities),
    conditionShares(stats.moves, setterMoves, moveDivisor)
  );
}

export function abusedConditions(stats: PokemonStats): Map<FieldCondition, number> {
  return mergeMax(
    conditionShares(stats.abilities, abuserAbilities),
    conditionShares(stats.items, abuserItems),
    conditionShares(stats.moves, abuserMoves, moveDivisor)
  );
}

/**
 * Aggregate stats tables list every move a Pokemon ever ran, so a stray Solar
 * Beam would otherwise read as sun support. Only a meaningful share counts.
 */
export const minConditionShare = 0.2;

export function conditionShare(shares: Map<FieldCondition, number>, condition: FieldCondition): number {
  const share = shares.get(condition) ?? 0;
  return share >= minConditionShare ? share : 0;
}

export function bestConditionShare(shares: Map<FieldCondition, number>, except?: FieldCondition): number {
  let best = 0;

  for (const [condition, share] of shares) {
    if (condition === except || share < minConditionShare) continue;
    best = Math.max(best, share);
  }

  return best;
}

function selectedIds(member: TeamMember): {ability: string; item: string; moves: string[]} {
  return {
    ability: toId(member.set.ability),
    item: toId(member.set.itemId ?? member.set.item),
    moves: member.set.moves.map(toId)
  };
}

export function memberSetConditions(member: TeamMember): Set<FieldCondition> {
  const {ability, moves} = selectedIds(member);
  const conditions = new Set<FieldCondition>();

  const fromAbility = setterAbilities[ability];
  if (fromAbility) conditions.add(fromAbility);

  for (const move of moves) {
    const fromMove = setterMoves[move];
    if (fromMove) conditions.add(fromMove);
  }

  return conditions;
}

export function memberAbusedConditions(member: TeamMember): Set<FieldCondition> {
  const {ability, item, moves} = selectedIds(member);
  const conditions = new Set<FieldCondition>();

  const fromAbility = abuserAbilities[ability];
  if (fromAbility) conditions.add(fromAbility);

  const fromItem = abuserItems[item];
  if (fromItem) conditions.add(fromItem);

  for (const move of moves) {
    const fromMove = abuserMoves[move];
    if (fromMove) conditions.add(fromMove);
  }

  return conditions;
}

export function isWeatherCondition(condition: FieldCondition): boolean {
  return weatherConditions.has(condition);
}

export function conditionLabel(condition: FieldCondition): string {
  return conditionLabels[condition];
}

export function teamSetConditions(members: TeamMember[]): Set<FieldCondition> {
  const conditions = new Set<FieldCondition>();

  for (const member of members) {
    for (const condition of memberSetConditions(member)) {
      conditions.add(condition);
    }
  }

  return conditions;
}

export function setterCount(members: TeamMember[], condition: FieldCondition): number {
  return members.filter(member => memberSetConditions(member).has(condition)).length;
}

export function abuserCount(members: TeamMember[], condition: FieldCondition): number {
  return members.filter(member => memberAbusedConditions(member).has(condition) && !memberSetConditions(member).has(condition)).length;
}

function memberUsage(members: TeamMember[], condition: FieldCondition): number {
  return members
    .filter(member => memberSetConditions(member).has(condition))
    .reduce((best, member) => Math.max(best, member.stats.usage), 0);
}

export function committedCondition(members: TeamMember[]): FieldCondition | null {
  const conditions = [...teamSetConditions(members)];
  if (!conditions.length) return null;

  return conditions.sort((a, b) => (
    abuserCount(members, b) - abuserCount(members, a)
    || memberUsage(members, b) - memberUsage(members, a)
    || fieldConditions.indexOf(a) - fieldConditions.indexOf(b)
  ))[0];
}

function conflictingConditions(members: TeamMember[]): {weather: FieldCondition[]; terrain: FieldCondition[]} {
  const conditions = [...teamSetConditions(members)];

  return {
    weather: conditions.filter(isWeatherCondition),
    terrain: conditions.filter(condition => !isWeatherCondition(condition))
  };
}

export function fieldConflictPenalty(members: TeamMember[]): number {
  const {weather, terrain} = conflictingConditions(members);
  return Math.max(0, weather.length - 1) * 2.5 + Math.max(0, terrain.length - 1) * 2;
}

export function fieldConflictWarnings(members: TeamMember[]): string[] {
  const {weather, terrain} = conflictingConditions(members);
  const warnings: string[] = [];

  if (weather.length > 1) {
    warnings.push(`Conflicting weather setters: ${weather.map(conditionLabel).join(', ')}`);
  }

  if (terrain.length > 1) {
    warnings.push(`Conflicting terrain setters: ${terrain.map(conditionLabel).join(', ')}`);
  }

  return warnings;
}
