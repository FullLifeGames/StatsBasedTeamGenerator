import {Dex} from '@pkmn/dex';
import {toId} from './id';
import {detectRolesForMoves} from './roles';
import type {AnalysisSetTemplate, FormatProfile, PokemonStats, RoleScores, SetCandidate, WeightedTable} from './types';

interface TeamContext {
  existingRoles?: Partial<RoleScores>;
  itemClause?: boolean;
  usedItems?: Set<string>;
}

interface ContextMember {
  roles: RoleScores;
  [key: string]: unknown;
}

const evLabels = ['HP', 'Atk', 'Def', 'SpA', 'SpD', 'Spe'];
const evKeys = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const;
const noAbilityIds = new Set(['', 'noability', 'none']);
const noItemIds = new Set(['', 'nothing', 'noitem', 'none']);
const choiceItemIds = new Set(['choiceband', 'choicescarf', 'choicespecs']);
const assaultVestId = 'assaultvest';
const choiceUtilityMoves = new Set(['batonpass', 'switcheroo', 'trick']);
const defenseScalingAttacks = new Set(['bodypress']);

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

function isDamagingMove(profile: FormatProfile, moveId: string): boolean {
  const move = Dex.forGen(profile.gen).moves.get(moveId);
  return move.exists ? move.category === 'Physical' || move.category === 'Special' : true;
}

function moveType(profile: FormatProfile, moveId: string): string {
  const move = Dex.forGen(profile.gen).moves.get(moveId);
  return move.exists ? move.type : '';
}

function moveCategory(profile: FormatProfile, moveId: string): string {
  const move = Dex.forGen(profile.gen).moves.get(moveId);
  return move.exists ? move.category : '';
}

function isDefenseSetupMove(profile: FormatProfile, moveId: string): boolean {
  const move = Dex.forGen(profile.gen).moves.get(moveId);
  return move.exists && move.category === 'Status' && Number(move.boosts?.def ?? 0) > 0;
}

function parseSpread(spread?: string): {nature?: string; evs?: string} {
  if (!spread) return {};
  const [nature, evText] = spread.split(':');
  const evs = evText?.split('/');
  if (!nature || evs?.length !== evLabels.length) return {};
  const evLine = evs
    .map((value, index) => ({value: Number(value), label: evLabels[index]}))
    .filter(ev => ev.value > 0)
    .map(ev => `${ev.value} ${ev.label}`)
    .join(' / ');

  return {
    nature,
    evs: evLine || undefined
  };
}

function formatTemplateEvs(evs?: AnalysisSetTemplate['evs']): string | undefined {
  if (!evs) return undefined;
  const evLine = evKeys
    .map((key, index) => ({value: evs[key] ?? 0, label: evLabels[index]}))
    .filter(ev => ev.value > 0)
    .map(ev => `${ev.value} ${ev.label}`)
    .join(' / ');
  return evLine || undefined;
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

function adjustedMoveWeight(
  stats: PokemonStats,
  profile: FormatProfile,
  moveId: string,
  moveTotal: number,
  selectedItemId: string,
  context?: TeamContext
): number {
  const roles = detectRolesForMoves(stats, profile, [moveId]);
  let weight = stats.moves[moveId] ?? 0;
  const itemId = toId(selectedItemId);
  const isChoiceLocked = choiceItemIds.has(itemId);
  const isAssaultVest = itemId === assaultVestId;
  const isDamaging = isDamagingMove(profile, moveId);

  if (isAssaultVest && !isDamaging) {
    weight -= moveTotal;
  }

  if (isChoiceLocked) {
    if (itemId === 'choiceband' && defenseScalingAttacks.has(moveId)) {
      weight -= moveTotal;
    }
    if (itemId === 'choiceband' && moveCategory(profile, moveId) === 'Physical' && !defenseScalingAttacks.has(moveId)) {
      weight += moveTotal * 0.08;
    }
    if (itemId === 'choicespecs' && moveCategory(profile, moveId) === 'Special') {
      weight += moveTotal * 0.08;
    }
  }

  if (isChoiceLocked && !isDamaging && !choiceUtilityMoves.has(moveId)) {
    weight -= moveTotal;
  }

  if (isChoiceLocked && choiceUtilityMoves.has(moveId)) {
    weight += moveTotal * 0.15;
  }

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

function highestAvailableMove(stats: PokemonStats, predicate: (moveId: string) => boolean): string | undefined {
  return Object.keys(stats.moves)
    .filter(predicate)
    .sort((a, b) => (stats.moves[b] ?? 0) - (stats.moves[a] ?? 0))[0];
}

function replacementIndexForBodyPress(selected: string[], profile: FormatProfile): number {
  const sameTypeAttackIndex = selected.findIndex(moveId => (
    moveId !== 'bodypress'
    && isDamagingMove(profile, moveId)
    && moveType(profile, moveId) === moveType(profile, 'bodypress')
  ));

  if (sameTypeAttackIndex >= 0) return sameTypeAttackIndex;
  return selected
    .map((moveId, index) => ({moveId, index}))
    .filter(entry => entry.moveId !== 'bodypress')
    .sort((a, b) => a.index - b.index)
    .at(-1)?.index ?? -1;
}

function repairMoveSynergy(stats: PokemonStats, profile: FormatProfile, selectedItemId: string, selected: string[]): string[] {
  const next = [...selected];
  const itemId = toId(selectedItemId);

  if (next.includes('bodypress') && itemId !== 'choiceband') {
    const defenseSetup = highestAvailableMove(stats, moveId => isDefenseSetupMove(profile, moveId));
    if (defenseSetup && !next.includes(defenseSetup)) {
      const replaceAt = replacementIndexForBodyPress(next, profile);
      if (replaceAt >= 0) next[replaceAt] = defenseSetup;
    }
  }

  return next;
}

function templateAllowedByContext(template: AnalysisSetTemplate, context?: TeamContext): boolean {
  if (!context?.itemClause || !template.item) return true;
  const usedItemIds = new Set([...(context.usedItems ?? new Set<string>())].map(toId));
  return !usedItemIds.has(toId(template.item));
}

function analysisCandidate(stats: PokemonStats, profile: FormatProfile, template: AnalysisSetTemplate): SetCandidate | null {
  const moveIds = template.moves.map(toId).filter(Boolean).slice(0, 4);
  if (!moveIds.length) return null;
  const abilityId = template.ability ? toId(template.ability) : topEntries(stats.abilities)[0]?.[0] ?? '';
  const itemId = template.item ? toId(template.item) : topEntries(stats.items)[0]?.[0] ?? '';
  const teraTypeId = template.teraType ? toId(template.teraType) : topEntries(stats.teraTypes)[0]?.[0] ?? '';

  return {
    pokemonId: stats.id,
    pokemonName: stats.name,
    ability: abilityId ? dexDisplay(profile, 'ability', abilityId) : '',
    item: itemId ? dexDisplay(profile, 'item', itemId) : '',
    itemId: itemId || undefined,
    teraType: legalTeraTypeId(profile, teraTypeId) ? titleCase(teraTypeId) : undefined,
    nature: template.nature,
    evs: formatTemplateEvs(template.evs),
    moves: moveIds.map(moveId => dexDisplay(profile, 'move', moveId)),
    roles: detectRolesForMoves(stats, profile, moveIds),
    confidence: 1,
    source: 'analysis',
    setName: template.name,
    sourceWeights: {
      ability: template.ability ? 1 : 0,
      item: template.item ? 1 : 0,
      teraType: template.teraType ? 1 : 0,
      moves: moveIds.length,
      spread: template.evs ? 1 : 0
    }
  };
}

function selectedMoveIds(stats: PokemonStats, profile: FormatProfile, selectedItemId: string, context?: TeamContext): string[] {
  const moveTotal = tableTotal(stats.moves);
  const selected: string[] = [];
  let hasHiddenPower = false;

  for (const moveId of Object.keys(stats.moves)
    .sort((a, b) => adjustedMoveWeight(stats, profile, b, moveTotal, selectedItemId, context) - adjustedMoveWeight(stats, profile, a, moveTotal, selectedItemId, context))) {
    if (moveId.startsWith('hiddenpower')) {
      if (hasHiddenPower) continue;
      hasHiddenPower = true;
    }

    selected.push(moveId);
    if (selected.length === 4) break;
  }

  return repairMoveSynergy(stats, profile, selectedItemId, selected);
}

function average(values: number[]): number {
  const scored = values.filter(value => value > 0);
  if (!scored.length) return 0;
  return scored.reduce((sum, value) => sum + value, 0) / scored.length;
}

export function buildSetCandidates(stats: PokemonStats, profile: FormatProfile, context?: TeamContext): SetCandidate[] {
  const analysisCandidates = (stats.analysisSets ?? [])
    .filter(template => templateAllowedByContext(template, context))
    .map(template => analysisCandidate(stats, profile, template))
    .filter((candidate): candidate is SetCandidate => Boolean(candidate));

  if (analysisCandidates.length) return analysisCandidates;

  const [[abilityId, abilityWeight] = ['', 0]] = topEntries(stats.abilities);
  const itemEntries = topEntries(stats.items, Math.max(1, Object.keys(stats.items).length));
  const usedItemIds = new Set([...(context?.usedItems ?? new Set<string>())].map(toId));
  const [selectedItemId, itemWeight] = itemEntries.find(([candidateItemId]) => {
    const legalItem = legalItemId(profile, candidateItemId);
    if (!legalItem) return true;
    const display = dexDisplay(profile, 'item', legalItem);
    return !context?.itemClause || (!usedItemIds.has(toId(legalItem)) && !usedItemIds.has(toId(display)));
  }) ?? ['', 0];
  const [[spreadId, spreadWeight] = ['', 0]] = topEntries(stats.spreads);
  const [[teraTypeId, teraTypeWeight] = ['', 0]] = topEntries(stats.teraTypes);
  const ability = legalAbilityId(profile, abilityId);
  const item = legalItemId(profile, selectedItemId);
  const teraType = legalTeraTypeId(profile, teraTypeId);
  const moveIds = selectedMoveIds(stats, profile, item, context);
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
    itemId: item || undefined,
    teraType: teraType ? titleCase(teraType) : undefined,
    nature: spread.nature,
    evs: spread.evs,
    moves: moveIds.map(moveId => dexDisplay(profile, 'move', moveId)),
    roles: detectRolesForMoves(stats, profile, moveIds),
    confidence,
    source: 'stats',
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
