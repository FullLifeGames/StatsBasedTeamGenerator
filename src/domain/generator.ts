import {inferFormatProfile, emptyRoles} from './formatProfile';
import {formatTeam} from './importable';
import {scoreTeam, attachInsights} from './scoring';
import {buildSetCandidates} from './sets';
import {toId} from './id';
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

function existingRoleTotals(members: TeamMember[]): RoleScores {
  const totals: RoleScores = {...emptyRoles};

  for (const member of members) {
    for (const role of roleKeys) {
      totals[role] += member.set.roles[role];
    }
  }

  return totals;
}

function sortedPokemon(dataset: StatsDataset, novelty: number): PokemonStats[] {
  const noveltyWeight = Math.max(0, Math.min(1, novelty));

  return [...dataset.pokemon].sort((a, b) => {
    const aScore = a.usage * (1 - noveltyWeight) + a.viability * noveltyWeight;
    const bScore = b.usage * (1 - noveltyWeight) + b.viability * noveltyWeight;
    return bScore - aScore;
  });
}

function memberFromStats(
  stats: PokemonStats,
  members: TeamMember[],
  profile: FormatProfile,
  explanation: string[]
): TeamMember {
  const [set] = buildSetCandidates(stats, profile, {existingRoles: existingRoleTotals(members)});

  return {stats, set, explanation};
}

function normalizeLockedMembers(lockedMembers: TeamMember[] | undefined): TeamMember[] {
  return (lockedMembers ?? []).map(member => ({
    ...member,
    locked: true,
    explanation: member.explanation.length ? member.explanation : ['Locked by user']
  }));
}

function uniqueInitialMembers(dataset: StatsDataset, profile: FormatProfile, options: GenerateOptions): TeamMember[] {
  const selected = new Set<string>();
  const members: TeamMember[] = [];

  for (const locked of normalizeLockedMembers(options.lockedMembers)) {
    const id = toId(locked.stats.id);
    if (selected.has(id)) continue;
    selected.add(id);
    members.push(locked);
  }

  for (const seed of options.seeds) {
    const id = toId(seed);
    if (selected.has(id)) continue;

    const stats = dataset.pokemonById[id];
    if (!stats) continue;

    selected.add(id);
    members.push(memberFromStats(stats, members, profile, ['Seeded by user']));
  }

  return members;
}

function beamSignature(members: TeamMember[]): string {
  return members.map(member => member.stats.id).sort().join('|');
}

function candidatePool(dataset: StatsDataset, selectedIds: Set<string>, novelty: number): PokemonStats[] {
  return sortedPokemon(dataset, novelty)
    .filter(stats => !selectedIds.has(stats.id))
    .slice(0, candidateLimit);
}

function advanceBeams(
  beams: Beam[],
  dataset: StatsDataset,
  profile: FormatProfile,
  targetSize: number,
  novelty: number
): Beam[] {
  const next: Beam[] = [];

  for (const beam of beams) {
    const selectedIds = new Set(beam.members.map(member => member.stats.id));
    for (const stats of candidatePool(dataset, selectedIds, novelty)) {
      const member = memberFromStats(stats, beam.members, profile, [
        `Added from usage rank with ${stats.usage.toFixed(1)}% usage`
      ]);
      const members = [...beam.members, member];
      next.push({
        members,
        score: scoreTeam(members, dataset, profile).total
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
  const targetSize = Math.min(profile.teamSize, dataset.pokemon.length);
  let beams: Beam[] = [{
    members: uniqueInitialMembers(dataset, profile, options).slice(0, targetSize),
    score: 0
  }];

  while (beams[0]?.members.length < targetSize) {
    const advanced = advanceBeams(beams, dataset, profile, targetSize, options.novelty);
    if (!advanced.length) break;
    beams = advanced;
  }

  const members = beams
    .sort((a, b) => b.score - a.score)[0]?.members ?? [];
  const score = scoreTeam(members, dataset, profile);
  const importable = formatTeam({members});

  return attachInsights({
    members,
    score,
    importable,
    source: dataset.source
  }, dataset);
}
