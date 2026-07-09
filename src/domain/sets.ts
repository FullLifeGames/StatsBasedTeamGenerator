import {Dex} from '@pkmn/dex';
import {abilityBias, itemBias, roleAffinity, spreadBias} from './archetype';
import {toId} from './id';
import {detectRolesForMove, detectRolesForMoves} from './roles';
import {abilityConditionBias, dependsOnMissingWeather} from './weather';
import type {FieldCondition} from './weather';
import type {Archetype, AnalysisSetTemplate, FormatProfile, PokemonStats, RoleScores, SetCandidate, WeightedTable} from './types';

/** Roles a single move can plug for a team that lacks them. */
const gapRoles: Array<keyof RoleScores> = [
  'hazardSetter',
  'hazardRemoval',
  'speedControl',
  'offensivePivot',
  'status',
  'itemDisruption'
];

interface TeamContext {
  existingRoles?: Partial<RoleScores>;
  itemClause?: boolean;
  usedItems?: Set<string>;
  archetype?: Archetype;
  teamConditions?: Set<FieldCondition>;
}

/**
 * How far a bias may move a choice away from what the format actually plays.
 * Usage share stays the base term so an archetype nudges the pick rather than
 * inventing a set nobody runs.
 */
const biasWeight = 0.45;
const minimumShare = 0.04;

/**
 * Lowest share of a Pokemon's recorded abilities that counts as evidence the
 * format plays it. Basculegion's Swift Swim sits near 4% in metas where rain is
 * rare and is a real choice; Whimsicott's Chlorophyll sits near 0% because
 * Prankster is better even in sun.
 */
const minimumRefitAbilityShare = 0.02;
const minimumAttackingMoves = 1;
const maximumHazardMoves = 2;
const hazardMoveIds = new Set(['stealthrock', 'spikes', 'toxicspikes', 'stickyweb']);

interface ContextMember {
  roles: RoleScores;
  [key: string]: unknown;
}

const evLabels = ['HP', 'Atk', 'Def', 'SpA', 'SpD', 'Spe'];
const evKeys = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const;
const noAbilityIds = new Set(['', 'noability', 'none']);
const noItemIds = new Set(['', 'nothing', 'noitem', 'none']);
const noTeraTypeIds = new Set(['', 'nothing', 'none']);
const choiceItemIds = new Set(['choiceband', 'choicescarf', 'choicespecs']);
const assaultVestId = 'assaultvest';
const choiceUtilityMoves = new Set(['batonpass', 'switcheroo', 'trick']);
const defenseScalingAttacks = new Set(['bodypress']);

function topEntries(table: WeightedTable, limit = 1): Array<[string, number]> {
  return Object.entries(table)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit);
}

/**
 * Picks the entry with the best usage share once the archetype's bias is added.
 * Entries the format barely runs are ignored unless nothing else qualifies, so
 * a bias can reorder real options but cannot conjure an unplayed one.
 */
function pickBiased(
  table: WeightedTable,
  bias: (id: string) => number,
  allow: (id: string) => boolean = () => true
): [string, number] {
  const total = tableTotal(table);
  const entries = Object.entries(table).filter(([id]) => allow(id));
  if (!entries.length || total <= 0) return ['', 0];

  const playable = entries.filter(([, weight]) => weight / total >= minimumShare);
  const pool = playable.length ? playable : entries;

  return pool.reduce((best, entry) => {
    const score = ([id, weight]: [string, number]) => weight / total + bias(id) * biasWeight;
    return score(entry) > score(best) ? entry : best;
  }, pool[0]);
}

function parseSpreadEvs(spreadId: string): number[] {
  const [, evText] = spreadId.split(':');
  const evs = evText?.split('/').map(Number) ?? [];
  return evs.length === 6 && evs.every(Number.isFinite) ? evs : [];
}

function pickSpread(table: WeightedTable, archetype: Archetype | undefined): [string, number] {
  return pickBiased(table, id => archetype ? spreadBias(parseSpreadEvs(id), archetype) : 0);
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

function isRealAbility(id: string): boolean {
  return !noAbilityIds.has(toId(id));
}

function realAbilities(stats: PokemonStats): WeightedTable {
  return Object.fromEntries(Object.entries(stats.abilities).filter(([id]) => isRealAbility(id)));
}

/**
 * Showdown records `noability` for the pre-Mega slot of a Mega forme, and it can
 * outweigh the forme's real ability in the usage table. The dex knows what the
 * species actually has, so it is the fallback when the stats offer nothing.
 */
function dexPrimaryAbility(profile: FormatProfile, stats: PokemonStats): string {
  if (profile.gen < 3) return '';

  const species = Dex.forGen(profile.gen).species.get(stats.name);
  if (!species.exists) return '';

  const [ability] = Object.values(species.abilities).filter(Boolean);
  return ability ? toId(ability) : '';
}

/** The most-used ability the Pokemon actually has, falling back to the dex. */
function resolveAbilityId(profile: FormatProfile, stats: PokemonStats, selected: string): string {
  const legal = legalAbilityId(profile, selected);
  return legal || dexPrimaryAbility(profile, stats);
}

function legalItemId(profile: FormatProfile, id: string): string {
  return profile.gen >= 2 && !noItemIds.has(id) ? id : '';
}

function legalTeraTypeId(profile: FormatProfile, id: string): string {
  return profile.gen >= 9 && !noTeraTypeIds.has(id) ? id : '';
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
  const roles = detectRolesForMove(stats, profile, moveId);
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

  if (context?.archetype) {
    weight += moveTotal * roleAffinity(roles, context.archetype) * 0.2;
  }

  weight += moveTotal * teamGapBonus(roles, profile, context) * 0.12;

  return weight;
}

/**
 * Favours moves that cover a role the rest of the team does not have yet, so a
 * set is built for the team it joins rather than in isolation.
 */
function teamGapBonus(roles: RoleScores, profile: FormatProfile, context?: TeamContext): number {
  if (!context?.existingRoles) return 0;

  return gapRoles.reduce((sum, role) => {
    if (roles[role] <= 0 || existingRoleScore(context, role) > 0) return sum;
    return sum + roles[role] * profile.roleWeights[role];
  }, 0);
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
  let next = [...selected];
  const itemId = toId(selectedItemId);

  if (next.includes('bodypress') && itemId !== 'choiceband') {
    const defenseSetup = highestAvailableMove(stats, moveId => isDefenseSetupMove(profile, moveId));
    if (defenseSetup && !next.includes(defenseSetup)) {
      const replaceAt = replacementIndexForBodyPress(next, profile);
      if (replaceAt >= 0) next[replaceAt] = defenseSetup;
    }
  }

  next = cappedHazardMoves(stats, profile, next);
  return ensureAttackingMoves(stats, profile, next);
}

function swapWeakest(
  stats: PokemonStats,
  selected: string[],
  removable: (moveId: string) => boolean,
  replacement: string | undefined
): string[] {
  if (!replacement || selected.includes(replacement)) return selected;

  const candidates = selected
    .map((moveId, index) => ({moveId, index}))
    .filter(entry => removable(entry.moveId))
    .sort((a, b) => (stats.moves[a.moveId] ?? 0) - (stats.moves[b.moveId] ?? 0));
  if (!candidates.length) return selected;

  const next = [...selected];
  next[candidates[0].index] = replacement;
  return next;
}

/**
 * A set with no way to deal damage is never right, however well its utility
 * moves score. Boosting hazard and setup roles for an archetype can otherwise
 * fill all four slots with status moves.
 */
function ensureAttackingMoves(stats: PokemonStats, profile: FormatProfile, selected: string[]): string[] {
  let next = [...selected];

  while (next.filter(moveId => isDamagingMove(profile, moveId)).length < minimumAttackingMoves) {
    const attack = highestAvailableMove(stats, moveId => isDamagingMove(profile, moveId) && !next.includes(moveId));
    const repaired = swapWeakest(stats, next, moveId => !isDamagingMove(profile, moveId), attack);
    if (repaired === next) break;
    next = repaired;
  }

  return next;
}

/** Three entry hazards on one Pokemon is a stats artefact, not a set. */
function cappedHazardMoves(stats: PokemonStats, profile: FormatProfile, selected: string[]): string[] {
  let next = [...selected];

  while (next.filter(moveId => hazardMoveIds.has(moveId)).length > maximumHazardMoves) {
    const attack = highestAvailableMove(stats, moveId => isDamagingMove(profile, moveId) && !next.includes(moveId));
    const repaired = swapWeakest(stats, next, moveId => hazardMoveIds.has(moveId), attack);
    if (repaired === next) break;
    next = repaired;
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
  const usedAbilityId = topEntries(realAbilities(stats))[0]?.[0] ?? '';
  const abilityId = resolveAbilityId(profile, stats, template.ability ? toId(template.ability) : usedAbilityId);
  // The same legality filter as the stats path: without it, a template with no
  // item falls back to the raw items table, whose top entry in Gens 1 and 2 is
  // literally `nothing`, and the import reads "Tauros @ Nothing".
  const itemId = legalItemId(profile, template.item ? toId(template.item) : topEntries(stats.items)[0]?.[0] ?? '');
  const teraTypeId = template.teraType ? toId(template.teraType) : topEntries(stats.teraTypes)[0]?.[0] ?? '';
  // A curated set is trustworthy, but a fixed confidence of 1 made the Sets
  // score carry no information wherever analyses exist. The floor keeps the
  // curation credit; the rest grades how close the set is to what is played.
  const moveWeight = moveIds.reduce((sum, moveId) => sum + (stats.moves[moveId] ?? 0), 0);
  const alignment = average([
    tableShare(stats.abilities, stats.abilities[abilityId] ?? 0),
    tableShare(stats.items, stats.items[itemId] ?? 0),
    tableShare(stats.moves, moveWeight)
  ]);

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
    confidence: 0.5 + 0.5 * alignment,
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
  // Weighed once per move, not once per sort comparison: the adjustment runs
  // role detection, and this function is called for every candidate the beam
  // search evaluates.
  const weights = new Map(Object.keys(stats.moves).map(moveId => [
    moveId,
    adjustedMoveWeight(stats, profile, moveId, moveTotal, selectedItemId, context)
  ]));
  const selected: string[] = [];
  let hasHiddenPower = false;

  for (const moveId of Object.keys(stats.moves)
    .sort((a, b) => (weights.get(b) ?? 0) - (weights.get(a) ?? 0))) {
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

/**
 * The ability this Pokemon should run given the weather its team ends up with,
 * or '' if none of its abilities care. Sets are built as members are added, so
 * a Pokemon chosen before the weather setter never saw the weather coming.
 */
export function bestConditionAbility(stats: PokemonStats, profile: FormatProfile, conditions: Set<FieldCondition>): string {
  if (!conditions.size) return '';

  // The team already brings the weather, so a weather ability beats a more
  // popular one that ignores it — but only when the format genuinely plays
  // that pairing. Whimsicott can have Chlorophyll, yet runs Prankster in
  // essentially 100% of its sets because Prankster is simply better even in
  // sun; a share floor keeps the refit from inventing sets nobody uses.
  const abilities = realAbilities(stats);
  const total = tableTotal(abilities);
  if (total <= 0) return '';

  const [abilityId] = Object.entries(abilities)
    .filter(([id, weight]) => weight / total >= minimumRefitAbilityShare && abilityConditionBias(id, conditions) > 0)
    .sort(([, a], [, b]) => b - a)[0] ?? [''];

  const legal = legalAbilityId(profile, abilityId);
  return legal ? dexDisplay(profile, 'ability', legal) : '';
}

/**
 * Recomputes a set's confidence from what it actually runs now. Post-selection
 * passes (weather refit, forced Trick Room) swap an ability or a move, and the
 * confidence chosen at build time would otherwise describe the old set. The EV
 * spread is not recoverable from a finished set, so the measurable parts are
 * graded and analysis sets keep their curation floor.
 */
export function refreshedConfidence(stats: PokemonStats, set: SetCandidate): number {
  const moveWeight = set.moves.reduce((sum, move) => sum + (stats.moves[toId(move)] ?? 0), 0);
  const alignment = average([
    tableShare(stats.abilities, stats.abilities[toId(set.ability)] ?? 0),
    tableShare(stats.items, stats.items[toId(set.itemId ?? set.item)] ?? 0),
    tableShare(stats.teraTypes, stats.teraTypes[toId(set.teraType ?? '')] ?? 0),
    tableShare(stats.moves, moveWeight)
  ]);

  return set.source === 'analysis' ? 0.5 + 0.5 * alignment : alignment;
}

/**
 * The most-used ability that does not depend on weather the team never brings.
 * Sand Rush with no sandstorm is a dead slot; Mold Breaker is not.
 */
export function bestWeatherFreeAbility(stats: PokemonStats, profile: FormatProfile, conditions: Set<FieldCondition>): string {
  const [abilityId] = Object.entries(realAbilities(stats))
    .filter(([id, weight]) => weight > 0 && !dependsOnMissingWeather(id, conditions))
    .sort(([, a], [, b]) => b - a)[0] ?? [''];

  const legal = legalAbilityId(profile, abilityId);
  return legal ? dexDisplay(profile, 'ability', legal) : '';
}

export function buildSetCandidates(stats: PokemonStats, profile: FormatProfile, context?: TeamContext): SetCandidate[] {
  const analysisCandidates = (stats.analysisSets ?? [])
    .filter(template => templateAllowedByContext(template, context))
    .map(template => analysisCandidate(stats, profile, template))
    .filter((candidate): candidate is SetCandidate => Boolean(candidate));

  if (analysisCandidates.length) return analysisCandidates;

  const archetype = context?.archetype;
  const teamConditions = context?.teamConditions ?? new Set<FieldCondition>();
  // The weather ability is decided by the same rule (and the same share floor)
  // as the end-of-generation refit, so whether a Pokemon joined before or after
  // the weather setter cannot change which ability it ends up with.
  const conditionAbilityId = toId(bestConditionAbility(stats, profile, teamConditions));
  const [abilityId, abilityWeight] = conditionAbilityId
    ? ([conditionAbilityId, stats.abilities[conditionAbilityId] ?? 0] as [string, number])
    : pickBiased(
      stats.abilities,
      id => (archetype ? abilityBias(id, archetype) : 0) + abilityConditionBias(id, teamConditions),
      isRealAbility
    );
  const usedItemIds = new Set([...(context?.usedItems ?? new Set<string>())].map(toId));
  const [selectedItemId, itemWeight] = pickBiased(stats.items, id => archetype ? itemBias(id, archetype) : 0, candidateItemId => {
    const legalItem = legalItemId(profile, candidateItemId);
    if (!legalItem) return true;
    const display = dexDisplay(profile, 'item', legalItem);
    return !context?.itemClause || (!usedItemIds.has(toId(legalItem)) && !usedItemIds.has(toId(display)));
  });
  const [spreadId, spreadWeight] = pickSpread(stats.spreads, archetype);
  const [[teraTypeId, teraTypeWeight] = ['', 0]] = topEntries(stats.teraTypes);
  const ability = resolveAbilityId(profile, stats, abilityId);
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
