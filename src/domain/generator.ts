import {Dex} from '@pkmn/dex';
import {inferFormatProfile, emptyRoles} from './formatProfile';
import {formatTeam} from './importable';
import {scoreTeam, attachInsights} from './scoring';
import {buildSetCandidates} from './sets';
import {toId} from './id';
import {detectRoles} from './roles';
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

function rankingScore(members: TeamMember[], trueScore: number, novelty: number, randomSeed?: number): number {
  if (randomSeed === undefined || novelty <= 0) return trueScore;
  const noveltyWeight = Math.max(0, Math.min(1, novelty));
  return trueScore + seededNoise(beamSignature(members), randomSeed) * noveltyWeight * 4;
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

    selected.add(id);
    selectedSpecies.add(baseSpecies);
    members.push(memberFromStats(stats, members, profile, ['Seeded by user']));
  }

  return members;
}

function beamSignature(members: TeamMember[]): string {
  return members.map(member => member.stats.id).sort().join('|');
}

function roleScoreForArchetype(stats: PokemonStats, profile: FormatProfile, archetype: GenerateOptions['archetype']): number {
  const roles = detectRoles(stats, profile);
  if (archetype === 'weather') {
    return roles.weatherTerrainSetter * 4 + roles.weatherTerrainAbuser * 3;
  }
  if (archetype === 'trick-room') {
    return (stats.moves.trickroom ? 4 : 0) + roles.speedControl * 2 + roles.positioning + roles.spreadPressure;
  }
  return 0;
}

function candidatePool(
  dataset: StatsDataset,
  profile: FormatProfile,
  selectedIds: Set<string>,
  selectedSpecies: Set<string>,
  novelty: number,
  randomSeed: number | undefined,
  archetype: GenerateOptions['archetype']
): PokemonStats[] {
  return sortedPokemon(dataset, novelty, randomSeed)
    .filter(stats => !selectedIds.has(toId(stats.id)) && !selectedSpecies.has(speciesKey(stats, profile)))
    .sort((a, b) => {
      const roleDelta = roleScoreForArchetype(b, profile, archetype) - roleScoreForArchetype(a, profile, archetype);
      return roleDelta || 0;
    })
    .slice(0, candidateLimit);
}

function bestArchetypeCandidate(
  dataset: StatsDataset,
  profile: FormatProfile,
  members: TeamMember[],
  bannedIds: Set<string>,
  predicate: (stats: PokemonStats) => boolean,
  explanation: string
): TeamMember | null {
  const selectedIds = new Set([...bannedIds, ...members.map(member => toId(member.stats.id))]);
  const speciesKeys = selectedSpeciesKeys(members, profile, bannedIds, dataset);
  const stats = [...dataset.pokemon]
    .filter(candidate => !selectedIds.has(toId(candidate.id)) && !speciesKeys.has(speciesKey(candidate, profile)) && predicate(candidate))
    .sort((a, b) => b.usage - a.usage)[0];

  return stats ? memberFromStats(stats, members, profile, [explanation]) : null;
}

function withArchetypeAnchors(
  dataset: StatsDataset,
  profile: FormatProfile,
  members: TeamMember[],
  bannedIds: Set<string>,
  targetSize: number,
  archetype: GenerateOptions['archetype']
): TeamMember[] {
  let next = [...members];
  const add = (candidate: TeamMember | null): void => {
    if (!candidate || next.length >= targetSize) return;
    next = [...next, candidate];
  };

  if (archetype === 'weather') {
    add(bestArchetypeCandidate(dataset, profile, next, bannedIds, stats => detectRoles(stats, profile).weatherTerrainSetter > 0, 'Added as weather or terrain setter'));
    add(bestArchetypeCandidate(dataset, profile, next, bannedIds, stats => detectRoles(stats, profile).weatherTerrainAbuser > 0, 'Added as weather or terrain abuser'));
  }

  if (archetype === 'trick-room') {
    add(bestArchetypeCandidate(dataset, profile, next, bannedIds, stats => Boolean(stats.moves.trickroom), 'Added as Trick Room setter'));
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
  bannedIds: Set<string>
): Beam[] {
  const next: Beam[] = [];

  for (const beam of beams) {
    const selectedIds = new Set([...bannedIds, ...beam.members.map(member => toId(member.stats.id))]);
    const speciesKeys = selectedSpeciesKeys(beam.members, profile, bannedIds, dataset);
    for (const stats of candidatePool(dataset, profile, selectedIds, speciesKeys, novelty, randomSeed, archetype)) {
      const member = memberFromStats(stats, beam.members, profile, [
        `Added from usage rank with ${stats.usage.toFixed(1)}% usage`
      ]);
      const members = [...beam.members, member];
      const trueScore = scoreTeam(members, dataset, profile, archetype).total;
      next.push({
        members,
        score: rankingScore(members, trueScore, novelty, randomSeed)
      });
    }
  }

  const seen = new Set<string>();
  return next
    .sort((a, b) => b.score - a.score)
    .filter(beam => {
      const signature = beamSignature(beam.members);
      if (seen.has(signature)) return false;
      seen.add(signature);
      return true;
    })
    .slice(0, beamWidth)
    .filter(beam => beam.members.length <= targetSize);
}

export function generateTeam(dataset: StatsDataset, formatId: string, options: GenerateOptions): GeneratedTeam {
  const profile = inferFormatProfile(formatId);
  const bannedIds = new Set((options.bannedMembers ?? []).map(toId));
  const availablePokemonCount = new Set(dataset.pokemon
    .filter(stats => !bannedIds.has(toId(stats.id)))
    .map(stats => speciesKey(stats, profile))).size;
  const targetSize = Math.min(profile.teamSize, availablePokemonCount);
  const initialMembers = withArchetypeAnchors(
    dataset,
    profile,
    uniqueInitialMembers(dataset, profile, options, bannedIds).slice(0, targetSize),
    bannedIds,
    targetSize,
    options.archetype
  );
  let beams: Beam[] = [{
    members: initialMembers,
    score: 0
  }];

  while (beams[0]?.members.length < targetSize) {
    const advanced = advanceBeams(beams, dataset, profile, targetSize, options.archetype, options.novelty, options.randomSeed, bannedIds);
    if (!advanced.length) break;
    beams = advanced;
  }

  const members = beams
    .sort((a, b) => b.score - a.score)[0]?.members ?? [];
  const score = scoreTeam(members, dataset, profile, options.archetype);
  const importable = formatTeam({members});

  return attachInsights({
    members,
    score,
    importable,
    source: dataset.source
  }, dataset);
}
