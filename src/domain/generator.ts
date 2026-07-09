import {Dex} from '@pkmn/dex';
import {inferFormatProfile, emptyRoles} from './formatProfile';
import {formatTeam} from './importable';
import {scoreTeam, attachInsights} from './scoring';
import {buildSetCandidates} from './sets';
import {toId} from './id';
import {detectRoles} from './roles';
import {isMegaStone} from './itemConstraints';
import {applyLead} from './leads';
import {createRng, sampleByScore, samplingTemperature} from './sampling';
import type {Rng} from './sampling';
import {effectiveNovelty, isEligible} from './usageProfile';
import {
  abusedConditions,
  bestConditionShare,
  committedCondition,
  conditionLabel,
  conditionShare,
  fieldConditions,
  settableConditions
} from './weather';
import type {FieldCondition} from './weather';
import type {
  FormatProfile,
  GenerateOptions,
  GeneratedTeam,
  PokemonStats,
  RoleScores,
  StatsDataset,
  TeamMember
} from './types';

interface Beam {
  members: TeamMember[];
  score: number;
}

const beamWidth = 5;
const candidateLimit = 24;
const roleKeys = Object.keys(emptyRoles) as Array<keyof RoleScores>;
const speciesFallbackPrefixes = ['ogerpon', 'urshifu'];

function existingRoleTotals(members: TeamMember[]): RoleScores {
  const totals: RoleScores = {...emptyRoles};

  for (const member of members) {
    for (const role of roleKeys) {
      totals[role] += member.set.roles[role];
    }
  }

  return totals;
}

function seededNoise(key: string, seed = 0): number {
  let hash = Math.imul(seed || 1, 2654435761);
  for (let index = 0; index < key.length; index += 1) {
    hash = Math.imul(hash ^ key.charCodeAt(index), 2246822519);
  }
  return ((hash >>> 0) % 10000) / 10000;
}

function speciesKey(stats: PokemonStats, profile: FormatProfile): string {
  const species = Dex.forGen(profile.gen).species.get(stats.name);
  if (species.exists && species.baseSpecies) return toId(species.baseSpecies);

  const id = toId(stats.id || stats.name);
  return speciesFallbackPrefixes.find(prefix => id.startsWith(prefix)) ?? id;
}

function selectedSpeciesKeys(members: TeamMember[], profile: FormatProfile, bannedIds?: Set<string>, dataset?: StatsDataset): Set<string> {
  const keys = new Set(members.map(member => speciesKey(member.stats, profile)));

  if (bannedIds && dataset) {
    for (const id of bannedIds) {
      const stats = dataset.pokemonById[id];
      if (stats) keys.add(speciesKey(stats, profile));
    }
  }

  return keys;
}

function existingUsedItems(members: TeamMember[]): Set<string> {
  return new Set(members.map(member => member.set.itemId ?? member.set.item).filter(Boolean));
}

function memberHasMegaStone(member: TeamMember, profile: FormatProfile): boolean {
  const itemId = member.set.itemId ?? member.set.item;
  return Boolean(itemId && isMegaStone(profile, toId(itemId)));
}

function canAddMember(members: TeamMember[], candidate: TeamMember, profile: FormatProfile): boolean {
  return !memberHasMegaStone(candidate, profile) || !members.some(member => memberHasMegaStone(member, profile));
}

function sortedPokemon(dataset: StatsDataset, novelty: number, randomSeed?: number): PokemonStats[] {
  const noveltyWeight = Math.max(0, Math.min(1, novelty));

  return [...dataset.pokemon].sort((a, b) => {
    const aScore = a.usage * (1 - noveltyWeight) + a.viability * noveltyWeight + seededNoise(a.id, randomSeed) * noveltyWeight;
    const bScore = b.usage * (1 - noveltyWeight) + b.viability * noveltyWeight + seededNoise(b.id, randomSeed) * noveltyWeight;
    return bScore - aScore;
  });
}

function memberFromStats(
  stats: PokemonStats,
  members: TeamMember[],
  profile: FormatProfile,
  explanation: string[]
): TeamMember {
  const [set] = buildSetCandidates(stats, profile, {
    existingRoles: existingRoleTotals(members),
    itemClause: profile.itemClause,
    usedItems: existingUsedItems(members)
  });

  return {stats, set, explanation};
}

function normalizeLockedMembers(lockedMembers: TeamMember[] | undefined): TeamMember[] {
  return (lockedMembers ?? []).map(member => ({
    ...member,
    locked: true,
    explanation: member.explanation.length ? member.explanation : ['Locked by user']
  }));
}

function uniqueInitialMembers(
  dataset: StatsDataset,
  profile: FormatProfile,
  options: GenerateOptions,
  bannedIds: Set<string>
): TeamMember[] {
  const selected = new Set<string>(bannedIds);
  const selectedSpecies = new Set<string>();
  const members: TeamMember[] = [];

  for (const locked of normalizeLockedMembers(options.lockedMembers)) {
    const id = toId(locked.stats.id);
    const baseSpecies = speciesKey(locked.stats, profile);
    if (selected.has(id) || selectedSpecies.has(baseSpecies)) continue;
    if (!canAddMember(members, locked, profile)) continue;
    selected.add(id);
    selectedSpecies.add(baseSpecies);
    members.push(locked);
  }

  for (const seed of options.seeds) {
    const id = toId(seed);
    if (selected.has(id)) continue;

    const stats = dataset.pokemonById[id];
    if (!stats) continue;
    const baseSpecies = speciesKey(stats, profile);
    if (selectedSpecies.has(baseSpecies)) continue;

    const member = memberFromStats(stats, members, profile, ['Seeded by user']);
    if (!canAddMember(members, member, profile)) continue;

    selected.add(id);
    selectedSpecies.add(baseSpecies);
    members.push(member);
  }

  return members;
}

function beamSignature(members: TeamMember[]): string {
  return members.map(member => member.stats.id).sort().join('|');
}

function baseSpeed(stats: PokemonStats, profile: FormatProfile): number {
  const species = Dex.forGen(profile.gen).species.get(stats.name);
  return species.exists ? species.baseStats.spe : 100;
}

function trickRoomComplementScore(stats: PokemonStats, profile: FormatProfile): number {
  const speed = baseSpeed(stats, profile);
  const roles = detectRoles(stats, profile);
  const pressure = Math.max(roles.physicalBreaker, roles.specialBreaker, roles.spreadPressure, roles.setup * 0.6);
  const speedFit = speed <= 45 ? 3 : speed <= 60 ? 2 : speed <= 75 ? 0.75 : 0;

  return speedFit + pressure * 2;
}

function teamHasTrickRoom(members: TeamMember[]): boolean {
  return members.some(member => member.set.moves.some(move => toId(move) === 'trickroom'));
}

function weatherArchetypeScore(stats: PokemonStats, members: TeamMember[]): number {
  const setters = settableConditions(stats);
  const abusers = abusedConditions(stats);
  const condition = committedCondition(members);

  if (!condition) return bestConditionShare(setters) * 4 + bestConditionShare(abusers) * 2;

  return conditionShare(abusers, condition) * 5
    + conditionShare(setters, condition) * 1.5
    - bestConditionShare(setters, condition) * 6;
}

function roleScoreForArchetype(
  stats: PokemonStats,
  profile: FormatProfile,
  archetype: GenerateOptions['archetype'],
  members: TeamMember[]
): number {
  const roles = detectRoles(stats, profile);
  if (archetype === 'weather') {
    return weatherArchetypeScore(stats, members);
  }
  if (archetype === 'trick-room') {
    return (stats.moves.trickroom ? 4 : 0) + trickRoomComplementScore(stats, profile) + roles.speedControl * 2 + roles.positioning + roles.spreadPressure;
  }
  return 0;
}

/**
 * Keeps the generator inside the Pokemon a format actually plays. Anchors may
 * need a Pokemon below the floor (a rare weather setter), so they fall back to
 * the unfiltered list rather than returning nothing.
 */
function withUsageFloor(dataset: StatsDataset, candidates: PokemonStats[], allowFallback = false): PokemonStats[] {
  const above = candidates.filter(stats => isEligible(dataset, stats.id));
  return above.length || !allowFallback ? above : candidates;
}

function candidatePool(
  dataset: StatsDataset,
  profile: FormatProfile,
  selectedIds: Set<string>,
  selectedSpecies: Set<string>,
  novelty: number,
  randomSeed: number | undefined,
  archetype: GenerateOptions['archetype'],
  members: TeamMember[]
): PokemonStats[] {
  return withUsageFloor(dataset, sortedPokemon(dataset, novelty, randomSeed)
    .filter(stats => !selectedIds.has(toId(stats.id)) && !selectedSpecies.has(speciesKey(stats, profile))))
    .sort((a, b) => {
      const trickRoomDelta = teamHasTrickRoom(members)
        ? trickRoomComplementScore(b, profile) - trickRoomComplementScore(a, profile)
        : 0;
      const roleDelta = roleScoreForArchetype(b, profile, archetype, members) - roleScoreForArchetype(a, profile, archetype, members);
      return trickRoomDelta || roleDelta || 0;
    })
    .slice(0, candidateLimit);
}

function availableStats(
  dataset: StatsDataset,
  profile: FormatProfile,
  members: TeamMember[],
  bannedIds: Set<string>
): PokemonStats[] {
  const selectedIds = new Set([...bannedIds, ...members.map(member => toId(member.stats.id))]);
  const speciesKeys = selectedSpeciesKeys(members, profile, bannedIds, dataset);

  return dataset.pokemon
    .filter(candidate => !selectedIds.has(toId(candidate.id)) && !speciesKeys.has(speciesKey(candidate, profile)));
}

function bestArchetypeCandidate(
  dataset: StatsDataset,
  profile: FormatProfile,
  members: TeamMember[],
  bannedIds: Set<string>,
  predicate: (stats: PokemonStats) => boolean,
  explanation: string,
  novelty = 0,
  rng: Rng | null = null
): TeamMember | null {
  const eligible = withUsageFloor(dataset, availableStats(dataset, profile, members, bannedIds).filter(predicate), true);
  // Anchors are forced into every team of their archetype, so a deterministic
  // pick would make the same Pokemon mandatory on every reroll.
  const stats = sampleByScore(
    eligible,
    eligible.length,
    candidate => candidate.usage,
    samplingTemperature(eligible.map(candidate => candidate.usage), novelty),
    rng
  );

  for (const candidate of stats) {
    const member = memberFromStats(candidate, members, profile, [explanation]);
    if (canAddMember(members, member, profile)) return member;
  }

  return null;
}

interface WeatherPlan {
  condition: FieldCondition;
  setter: PokemonStats | null;
  abuser: PokemonStats | null;
}

function conditionFit(stats: PokemonStats, share: number): number {
  return share <= 0 ? 0 : share * Math.max(stats.usage, 0.5);
}

function bestByCondition(
  candidates: PokemonStats[],
  condition: FieldCondition,
  shares: (stats: PokemonStats) => Map<FieldCondition, number>
): {stats: PokemonStats; fit: number} | null {
  let best: {stats: PokemonStats; fit: number} | null = null;

  for (const stats of candidates) {
    const fit = conditionFit(stats, conditionShare(shares(stats), condition));
    if (fit > 0 && (!best || fit > best.fit)) best = {stats, fit};
  }

  return best;
}

function sampledAbuser(
  candidates: PokemonStats[],
  plan: WeatherPlan,
  novelty: number,
  rng: Rng | null
): PokemonStats | null {
  const abusers = candidates
    .filter(stats => stats !== plan.setter)
    .map(stats => ({stats, fit: conditionFit(stats, conditionShare(abusedConditions(stats), plan.condition))}))
    .filter(entry => entry.fit > 0);
  if (!abusers.length) return plan.abuser;

  const temperature = samplingTemperature(abusers.map(entry => entry.fit), novelty);
  return sampleByScore(abusers, 1, entry => entry.fit, temperature, rng)[0]?.stats ?? plan.abuser;
}

/**
 * Commits the team to a single weather or terrain and pairs its strongest
 * setter with an abuser of that same condition (Drizzle with Swift Swim, not
 * Drizzle with Chlorophyll).
 */
function planWeather(
  dataset: StatsDataset,
  profile: FormatProfile,
  members: TeamMember[],
  bannedIds: Set<string>,
  novelty: number,
  rng: Rng | null
): WeatherPlan | null {
  const candidates = withUsageFloor(dataset, availableStats(dataset, profile, members, bannedIds), true);
  const existing = committedCondition(members);
  const conditions = existing ? [existing] : fieldConditions;
  let best: (WeatherPlan & {fit: number}) | null = null;

  for (const condition of conditions) {
    const setter = existing ? null : bestByCondition(candidates, condition, settableConditions);
    if (!existing && !setter) continue;

    const abuserPool = setter ? candidates.filter(stats => stats !== setter.stats) : candidates;
    const abuser = bestByCondition(abuserPool, condition, abusedConditions);
    if (!abuser) continue;

    const fit = (setter?.fit ?? 0) + abuser.fit;
    if (!best || fit > best.fit) {
      best = {condition, setter: setter?.stats ?? null, abuser: abuser.stats, fit};
    }
  }

  // The condition is committed on its strongest pairing, but which abuser fills
  // the anchor slot is sampled so rerolls do not always open the same two.
  if (best) return {...best, abuser: sampledAbuser(candidates, best, novelty, rng)};
  if (existing) return null;

  const fallback = fieldConditions
    .map(condition => ({condition, setter: bestByCondition(candidates, condition, settableConditions)}))
    .filter((entry): entry is {condition: FieldCondition; setter: {stats: PokemonStats; fit: number}} => Boolean(entry.setter))
    .sort((a, b) => b.setter.fit - a.setter.fit)[0];

  return fallback ? {condition: fallback.condition, setter: fallback.setter.stats, abuser: null} : null;
}

function withArchetypeAnchors(
  dataset: StatsDataset,
  profile: FormatProfile,
  members: TeamMember[],
  bannedIds: Set<string>,
  targetSize: number,
  archetype: GenerateOptions['archetype'],
  novelty: number,
  rng: Rng | null
): TeamMember[] {
  let next = [...members];
  const add = (candidate: TeamMember | null): void => {
    if (!candidate || next.length >= targetSize) return;
    if (!canAddMember(next, candidate, profile)) return;
    if (selectedSpeciesKeys(next, profile).has(speciesKey(candidate.stats, profile))) return;
    next = [...next, candidate];
  };

  if (archetype === 'weather') {
    const plan = planWeather(dataset, profile, next, bannedIds, novelty, rng);

    if (plan) {
      const label = conditionLabel(plan.condition);

      if (plan.setter) {
        add(memberFromStats(plan.setter, next, profile, [`Added as ${label} setter`]));
      }
      if (plan.abuser) {
        add(memberFromStats(plan.abuser, next, profile, [`Added to abuse ${label}`]));
      }

      add(bestArchetypeCandidate(
        dataset,
        profile,
        next,
        bannedIds,
        stats => conditionShare(abusedConditions(stats), plan.condition) > 0
          && bestConditionShare(settableConditions(stats), plan.condition) === 0,
        `Added to abuse ${label}`,
        novelty,
        rng
      ));
    }
  }

  if (archetype === 'trick-room') {
    add(bestArchetypeCandidate(dataset, profile, next, bannedIds, stats => Boolean(stats.moves.trickroom), 'Added as Trick Room setter', novelty, rng));
    add(bestArchetypeCandidate(
      dataset,
      profile,
      next,
      bannedIds,
      stats => !stats.moves.trickroom && trickRoomComplementScore(stats, profile) >= 2,
      'Added as slow Trick Room partner',
      novelty,
      rng
    ));
  }

  return next;
}

function advanceBeams(
  beams: Beam[],
  dataset: StatsDataset,
  profile: FormatProfile,
  targetSize: number,
  archetype: GenerateOptions['archetype'],
  novelty: number,
  randomSeed: number | undefined,
  bannedIds: Set<string>,
  rng: Rng | null
): Beam[] {
  const next: Array<Beam & {marginal: number}> = [];

  for (const beam of beams) {
    const selectedIds = new Set([...bannedIds, ...beam.members.map(member => toId(member.stats.id))]);
    const speciesKeys = selectedSpeciesKeys(beam.members, profile, bannedIds, dataset);

    for (const stats of candidatePool(dataset, profile, selectedIds, speciesKeys, novelty, randomSeed, archetype, beam.members)) {
      const member = memberFromStats(stats, beam.members, profile, [
        `Added from usage rank with ${stats.usage.toFixed(1)}% usage`
      ]);
      if (!canAddMember(beam.members, member, profile)) continue;

      const members = [...beam.members, member];
      const score = scoreTeam(members, dataset, profile, archetype).total;
      next.push({members, score, marginal: score - beam.score});
    }
  }

  const seen = new Set<string>();
  const distinct = next
    .sort((a, b) => b.score - a.score)
    .filter(beam => {
      const signature = beamSignature(beam.members);
      if (seen.has(signature)) return false;
      seen.add(signature);
      return true;
    })
    .filter(beam => beam.members.length <= targetSize);

  // Sampled on the marginal value of the added Pokemon, not on the absolute
  // team total: totals carry each beam's prefix, so comparing them across beams
  // collapses every beam onto the single strongest lineage.
  const temperature = samplingTemperature(distinct.map(beam => beam.marginal), novelty);
  return sampleByScore(distinct, beamWidth, beam => beam.marginal, temperature, rng)
    .map(({members, score}) => ({members, score}));
}

/**
 * Beams are drawn by softmax rather than taken as the strict top-k. A fixed
 * noise offset could never unseat a Pokemon whose role score dominates every
 * partial team, which is what pinned single Pokemon into every generated team.
 */
function sampleBeams(beams: Beam[], count: number, novelty: number, rng: Rng | null): Beam[] {
  const temperature = samplingTemperature(beams.map(beam => beam.score), novelty);
  return sampleByScore(beams, count, beam => beam.score, temperature, rng);
}

export function generateTeam(dataset: StatsDataset, formatId: string, options: GenerateOptions): GeneratedTeam {
  const profile = inferFormatProfile(formatId);
  const novelty = effectiveNovelty(options.novelty, dataset);
  const bannedIds = new Set((options.bannedMembers ?? []).map(toId));
  const availablePokemonCount = new Set(dataset.pokemon
    .filter(stats => !bannedIds.has(toId(stats.id)))
    .map(stats => speciesKey(stats, profile))).size;
  const targetSize = Math.min(profile.teamSize, availablePokemonCount);
  const rng = options.randomSeed === undefined ? null : createRng(options.randomSeed);
  const initialMembers = withArchetypeAnchors(
    dataset,
    profile,
    uniqueInitialMembers(dataset, profile, options, bannedIds).slice(0, targetSize),
    bannedIds,
    targetSize,
    options.archetype,
    novelty,
    rng
  );
  let beams: Beam[] = [{
    members: initialMembers,
    score: 0
  }];

  while (beams[0]?.members.length < targetSize) {
    const advanced = advanceBeams(beams, dataset, profile, targetSize, options.archetype, novelty, options.randomSeed, bannedIds, rng);
    if (!advanced.length) break;
    beams = advanced;
  }

  const members = applyLead(sampleBeams(beams, 1, novelty, rng)[0]?.members ?? [], dataset, profile);
  const score = scoreTeam(members, dataset, profile, options.archetype);
  const importable = formatTeam({members});

  return attachInsights({
    members,
    score,
    importable,
    source: dataset.source
  }, dataset);
}
