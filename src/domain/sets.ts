import {Dex} from '@pkmn/dex';
import {detectRolesForMoves} from './roles';
import type {FormatProfile, PokemonStats, RoleScores, SetCandidate, WeightedTable} from './types';

interface TeamContext {
  existingRoles?: Partial<RoleScores>;
}

interface ContextMember {
  roles: RoleScores;
  [key: string]: unknown;
}

const evLabels = ['HP', 'Atk', 'Def', 'SpA', 'SpD', 'Spe'];
const noAbilityIds = new Set(['', 'noability', 'none']);
const noItemIds = new Set(['', 'nothing', 'noitem', 'none']);

function topEntries(table: WeightedTable, limit = 1): Array<[string, number]> {
  return Object.entries(table)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit);
}

function titleCase(id: string): string {
  return id
    .replace(/([a-z])([0-9])/g, '$1 $2')
    .replace(/(^|\s)\w/g, letter => letter.toUpperCase());
}

function dexDisplay(profile: FormatProfile, kind: 'ability' | 'item' | 'move', id: string): string {
  const dex = Dex.forGen(profile.gen);
  const entry = kind === 'ability'
    ? dex.abilities.get(id)
    : kind === 'item'
      ? dex.items.get(id)
      : dex.moves.get(id);
  return entry.exists ? entry.name : titleCase(id);
}

function parseSpread(spread?: string): {nature?: string; evs?: string} {
  if (!spread) return {};
  const [nature, evText] = spread.split(':');
  const evs = evText?.split('/');
  if (!nature || evs?.length !== evLabels.length) return {};

  return {
    nature,
    evs: evs.map((value, index) => `${value} ${evLabels[index]}`).join(' / ')
  };
}

function legalAbilityId(profile: FormatProfile, id: string): string {
  return profile.gen >= 3 && !noAbilityIds.has(id) ? id : '';
}

function legalItemId(profile: FormatProfile, id: string): string {
  return profile.gen >= 2 && !noItemIds.has(id) ? id : '';
}

function legalTeraTypeId(profile: FormatProfile, id: string): string {
  return profile.gen >= 9 ? id : '';
}

function existingRoleScore(context: TeamContext | undefined, role: keyof RoleScores): number {
  return context?.existingRoles?.[role] ?? 0;
}

function tableTotal(table: WeightedTable): number {
  return Object.values(table).reduce((sum, value) => sum + value, 0);
}

function tableShare(table: WeightedTable, weight: number): number {
  const total = tableTotal(table);
  return total > 0 ? Math.min(1, weight / total) : 0;
}

function adjustedMoveWeight(stats: PokemonStats, profile: FormatProfile, moveId: string, moveTotal: number, context?: TeamContext): number {
  const roles = detectRolesForMoves(stats, profile, [moveId]);
  let weight = stats.moves[moveId] ?? 0;

  if (profile.battleStyle === 'singles') {
    if (existingRoleScore(context, 'hazardSetter') > 0 && roles.hazardSetter > 0) {
      weight -= moveTotal * roles.hazardSetter * profile.roleWeights.duplicateHazardPenalty;
    }
    if (existingRoleScore(context, 'hazardRemoval') > 0 && roles.hazardRemoval > 0) {
      weight -= moveTotal * roles.hazardRemoval * profile.roleWeights.duplicateRemovalPenalty;
    }
  }

  if (profile.battleStyle === 'doubles' && existingRoleScore(context, 'speedControl') > 0 && roles.speedControl > 0) {
    weight -= moveTotal * roles.speedControl * profile.roleWeights.duplicateSpeedControlPenalty * 0.25;
  }

  return weight;
}

function selectedMoveIds(stats: PokemonStats, profile: FormatProfile, context?: TeamContext): string[] {
  const moveTotal = tableTotal(stats.moves);
  return Object.keys(stats.moves)
    .sort((a, b) => adjustedMoveWeight(stats, profile, b, moveTotal, context) - adjustedMoveWeight(stats, profile, a, moveTotal, context))
    .slice(0, 4);
}

function average(values: number[]): number {
  const scored = values.filter(value => value > 0);
  if (!scored.length) return 0;
  return scored.reduce((sum, value) => sum + value, 0) / scored.length;
}

export function buildSetCandidates(stats: PokemonStats, profile: FormatProfile, context?: TeamContext): SetCandidate[] {
  const [[abilityId, abilityWeight] = ['', 0]] = topEntries(stats.abilities);
  const [[itemId, itemWeight] = ['', 0]] = topEntries(stats.items);
  const [[spreadId, spreadWeight] = ['', 0]] = topEntries(stats.spreads);
  const [[teraTypeId, teraTypeWeight] = ['', 0]] = topEntries(stats.teraTypes);
  const ability = legalAbilityId(profile, abilityId);
  const item = legalItemId(profile, itemId);
  const teraType = legalTeraTypeId(profile, teraTypeId);
  const moveIds = selectedMoveIds(stats, profile, context);
  const moveWeight = moveIds.reduce((sum, moveId) => sum + (stats.moves[moveId] ?? 0), 0);
  const spread = profile.gen >= 3 ? parseSpread(spreadId) : {};
  const confidence = average([
    tableShare(stats.abilities, abilityWeight),
    tableShare(stats.items, itemWeight),
    tableShare(stats.spreads, spreadWeight),
    tableShare(stats.teraTypes, teraTypeWeight),
    tableShare(stats.moves, moveWeight)
  ]);

  return [{
    pokemonId: stats.id,
    pokemonName: stats.name,
    ability: ability ? dexDisplay(profile, 'ability', ability) : '',
    item: item ? dexDisplay(profile, 'item', item) : '',
    teraType: teraType ? titleCase(teraType) : undefined,
    nature: spread.nature,
    evs: spread.evs,
    moves: moveIds.map(moveId => dexDisplay(profile, 'move', moveId)),
    roles: detectRolesForMoves(stats, profile, moveIds),
    confidence,
    sourceWeights: {
      ability: abilityWeight,
      item: itemWeight,
      teraType: teraTypeWeight,
      moves: moveWeight,
      spread: spreadWeight
    }
  }];
}

function teamRoleTotal(partialTeam: ContextMember[], role: keyof RoleScores): number {
  return partialTeam.reduce((sum, member) => sum + member.roles[role], 0);
}

export function scoreSetForTeamContext(candidate: SetCandidate, partialTeam: ContextMember[], profile: FormatProfile): number {
  let score = 0;

  if (profile.battleStyle === 'singles') {
    const hazardSetterTotal = teamRoleTotal(partialTeam, 'hazardSetter');
    const hazardRemovalTotal = teamRoleTotal(partialTeam, 'hazardRemoval');

    score += hazardSetterTotal > 0
      ? -candidate.roles.hazardSetter * profile.roleWeights.duplicateHazardPenalty
      : candidate.roles.hazardSetter * profile.roleWeights.hazardSetter;
    score += hazardRemovalTotal > 0
      ? -candidate.roles.hazardRemoval * profile.roleWeights.duplicateRemovalPenalty
      : candidate.roles.hazardRemoval * profile.roleWeights.hazardRemoval;
  }

  if (profile.battleStyle === 'doubles') {
    const speedControlTotal = teamRoleTotal(partialTeam, 'speedControl');
    score += speedControlTotal > 0
      ? candidate.roles.speedControl * (profile.roleWeights.speedControl - profile.roleWeights.duplicateSpeedControlPenalty)
      : candidate.roles.speedControl * profile.roleWeights.speedControl;
    score += candidate.roles.positioning * profile.roleWeights.positioning;
    score += candidate.roles.spreadPressure * profile.roleWeights.spreadPressure;
  }

  return score;
}
