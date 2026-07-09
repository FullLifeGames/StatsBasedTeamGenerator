import {Dex} from '@pkmn/dex';
import {archetypeProfile, statTargetScore} from './archetype';
import {scoreSetForTeamContext} from './sets';
import {toId} from './id';
import {unsupportedTerrainSeedWarnings} from './fieldSupport';
import {leadScore} from './leads';
import {megaStonePenalty, multipleMegaStoneWarnings} from './itemConstraints';
import {topUsage, usageWeight} from './usageProfile';
import {
  abuserCount,
  committedCondition,
  fieldConflictPenalty,
  fieldConflictWarnings,
  memberAbusedConditions,
  memberSetConditions,
  setterCount,
  unpairedWeatherPenalty,
  unpairedWeatherWarnings
} from './weather';
import type {
  Archetype,
  FormatProfile,
  GeneratedTeam,
  PokemonStats,
  RoleScores,
  ScoreBreakdown,
  StatsDataset,
  SynergyInsight,
  TeamMember,
  ThreatCoverage
} from './types';

const roleKeys = [
  'physicalBreaker',
  'specialBreaker',
  'cleaner',
  'defensivePivot',
  'offensivePivot',
  'support',
  'status',
  'setup',
  'weatherTerrainSetter',
  'weatherTerrainAbuser',
  'hazardSetter',
  'hazardRemoval',
  'hazardPreservation',
  'itemDisruption',
  'speedControl',
  'positioning',
  'spreadPressure',
  'boardControl'
] as const;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function roundScore(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * Chaos teammate weights are excess co-occurrence counts, so they scale with
 * how often the holder was used. Dividing by the holder's own sample size
 * turns that into a rate, which keeps raw counts from dominating without
 * making rarity itself look like synergy. Negative weights are kept: two
 * Pokemon seen together less often than chance are an anti-pair, and that is
 * as much signal as a positive one.
 */
function teammateRate(a: TeamMember, b: TeamMember): number {
  const weight = a.stats.teammates[b.stats.id] ?? 0;
  if (weight === 0) return 0;

  return clamp(weight / Math.max(a.stats.rawCount, 1), -1, 1);
}

function pairSynergy(a: TeamMember, b: TeamMember): number {
  const rates = [teammateRate(a, b), teammateRate(b, a)].filter(value => value !== 0);
  if (!rates.length) return 0;

  return clamp(average(rates) * 20, -3, 3);
}

export function synergyInsights(members: TeamMember[]): SynergyInsight[] {
  const insights: SynergyInsight[] = [];

  for (let i = 0; i < members.length; i += 1) {
    for (let j = i + 1; j < members.length; j += 1) {
      const score = pairSynergy(members[i], members[j]);
      if (score !== 0) {
        insights.push({
          a: members[i].stats.id,
          b: members[j].stats.id,
          score: roundScore(score)
        });
      }
    }
  }

  return insights.sort((a, b) => b.score - a.score);
}

function confidenceForThreat(edge: {samples: number; probability: number; deviation: number}): number {
  return edge.probability * Math.min(1, edge.samples / 40) * (1 - Math.min(0.5, edge.deviation));
}

/**
 * A Pokemon with no checks-and-counters data cannot answer anything, which is
 * not the same as failing to. Coverage is only meaningful when at least one
 * member of this team has data, rather than merely someone in the stats file.
 */
export function membersWithCounterData(members: TeamMember[]): number {
  return members.filter(member => member.stats.checks.length > 0).length;
}

/**
 * The beam search scores hundreds of candidate teams per generation and each
 * scoring asks for the top threats, so the usage sort is done once per dataset
 * rather than once per call.
 */
const usageSortedCache = new WeakMap<StatsDataset, PokemonStats[]>();

function usageSortedPokemon(dataset: StatsDataset): PokemonStats[] {
  const cached = usageSortedCache.get(dataset);
  if (cached) return cached;

  const sorted = [...dataset.pokemon].sort((a, b) => b.usage - a.usage);
  usageSortedCache.set(dataset, sorted);
  return sorted;
}

/** Checks edges indexed by target, so a threat lookup is not a linear scan. */
const checksByTargetCache = new WeakMap<PokemonStats, Map<string, PokemonStats['checks'][number]>>();

function checkEdgeAgainst(stats: PokemonStats, target: string): PokemonStats['checks'][number] | undefined {
  let byTarget = checksByTargetCache.get(stats);
  if (!byTarget) {
    byTarget = new Map(stats.checks.map(edge => [edge.target, edge]));
    checksByTargetCache.set(stats, byTarget);
  }

  return byTarget.get(target);
}

export function threatCoverage(members: TeamMember[], dataset: StatsDataset, limit = 24): ThreatCoverage[] {
  if (!membersWithCounterData(members)) return [];

  const teamIds = new Set(members.map(member => member.stats.id));
  const threats: PokemonStats[] = [];
  for (const stats of usageSortedPokemon(dataset)) {
    if (teamIds.has(stats.id)) continue;
    threats.push(stats);
    if (threats.length === limit) break;
  }

  return threats.map(threat => {
    const answers = members
      .flatMap(member => {
        const edge = checkEdgeAgainst(member.stats, threat.id);
        return edge
          ? [{
            pokemonId: member.stats.id,
            pokemonName: member.stats.name,
            confidence: roundScore(confidenceForThreat(edge))
          }]
          : [];
      })
      .filter(answer => answer.confidence > 0)
      .sort((a, b) => b.confidence - a.confidence);

    return {
      threatId: threat.id,
      threatName: threat.name,
      usage: threat.usage,
      answers,
      covered: answers.some(answer => answer.confidence >= 0.35)
    };
  });
}

function usageScore(members: TeamMember[], dataset: StatsDataset): number {
  const maxUsage = Math.max(topUsage(dataset), 1);
  const weight = usageWeight(dataset);
  return clamp(average(members.map(member => member.stats.usage / maxUsage)) * weight, 0, weight);
}

function setConfidenceScore(members: TeamMember[]): number {
  return clamp(average(members.map(member => member.set.confidence)) * 2, 0, 2);
}

function roleTotals(members: TeamMember[]): RoleScores {
  const totals = Object.fromEntries(roleKeys.map(role => [role, 0])) as unknown as RoleScores;

  for (const member of members) {
    for (const role of roleKeys) {
      totals[role] += member.set.roles[role];
    }
  }

  return totals;
}

/**
 * Normalized against the best score these weights could award, rather than
 * clamped at a fixed ceiling. A hard clamp saturated for every team, so the
 * largest term in the breakdown carried no information at all.
 */
function roleScore(members: TeamMember[], profile: FormatProfile): number {
  const totals = roleTotals(members);
  const cap = profile.battleStyle === 'doubles' ? 2 : 1.5;
  let score = 0;
  let best = 0;

  for (const role of roleKeys) {
    const weight = profile.roleWeights[role];
    score += Math.min(totals[role], cap) * weight;
    best += cap * weight;
  }

  return best > 0 ? clamp((score / best) * 10, 0, 10) : 0;
}

function duplicateRoleScore(members: TeamMember[], profile: FormatProfile): number {
  const totals = roleTotals(members);
  let penalty = 0;

  if (profile.battleStyle === 'singles') {
    penalty -= Math.max(0, totals.hazardSetter - 1) * profile.roleWeights.duplicateHazardPenalty;
    penalty -= Math.max(0, totals.hazardRemoval - 1) * profile.roleWeights.duplicateRemovalPenalty;
  } else {
    penalty -= Math.max(0, totals.speedControl - 2) * profile.roleWeights.duplicateSpeedControlPenalty;
    penalty -= Math.max(0, totals.hazardSetter - 1) * profile.roleWeights.duplicateHazardPenalty;
    penalty -= Math.max(0, totals.hazardRemoval - 1) * profile.roleWeights.duplicateRemovalPenalty;
  }

  return clamp(penalty, -5, 0);
}

function memberHasTrickRoom(member: TeamMember): boolean {
  return member.set.moves.some(move => toId(move) === 'trickroom');
}

function memberBaseSpeed(member: TeamMember, profile: FormatProfile): number {
  const species = Dex.forGen(profile.gen).species.get(member.stats.name);
  return species.exists ? species.baseStats.spe : 100;
}

function trickRoomSlowComplement(member: TeamMember, profile: FormatProfile): number {
  const speed = memberBaseSpeed(member, profile);
  const attackPressure = Math.max(
    member.set.roles.physicalBreaker,
    member.set.roles.specialBreaker,
    member.set.roles.spreadPressure,
    member.set.roles.setup * 0.6
  );

  if (speed <= 45) return Math.max(0.8, attackPressure);
  if (speed <= 60) return Math.max(0.5, attackPressure * 0.75);
  if (speed <= 75) return attackPressure * 0.35;
  return 0;
}

function trickRoomSupportPenalty(members: TeamMember[], profile: FormatProfile): number {
  if (!members.some(memberHasTrickRoom)) return 0;

  const complementScore = members
    .filter(member => !memberHasTrickRoom(member))
    .reduce((sum, member) => sum + trickRoomSlowComplement(member, profile), 0);
  const requiredComplement = members.length >= 4 ? 1.5 : 0.75;

  return Math.max(0, requiredComplement - complementScore) * 2.5;
}

/**
 * The set-fit reward is capped before the penalties are taken off. Subtracting
 * them first let a team whose reward already exceeded the ceiling absorb any
 * penalty for free, so unpaired weather and stacked Mega Stones were scored but
 * never actually cost anything.
 */
function setToTeamFitScore(members: TeamMember[], profile: FormatProfile): number {
  let reward = 0;

  for (let index = 0; index < members.length; index += 1) {
    const previousSetRoles = members.slice(0, index).map(member => ({roles: member.set.roles}));
    reward += scoreSetForTeamContext(members[index].set, previousSetRoles, profile);
  }

  const penalty = unsupportedTerrainSeedWarnings(members).length * 1.5
    + megaStonePenalty(members, profile)
    + trickRoomSupportPenalty(members, profile)
    + fieldConflictPenalty(members)
    + unpairedWeatherPenalty(members);

  return clamp(clamp(reward, -6, 5) - penalty, -12, 5);
}

/**
 * Averaged over every pair on the team, not only the pairs that have synergy.
 * Averaging the non-zero pairs let one strong pair carry five strangers to the
 * same score as a team where everything supports everything.
 */
function synergyScore(members: TeamMember[]): number {
  const pairCount = (members.length * (members.length - 1)) / 2;
  if (pairCount <= 0) return 0;

  const total = synergyInsights(members).reduce((sum, insight) => sum + insight.score, 0);
  return clamp(total / pairCount, -3, 3);
}

/**
 * Stacking one type concentrates shared weaknesses. Two of a type is a normal
 * core; each member beyond that costs a little. The penalty is deliberately
 * mild so rain teams may still run their third Water type when it earns it.
 */
function typeBalanceScore(members: TeamMember[], profile: FormatProfile): number {
  const counts = new Map<string, number>();

  for (const member of members) {
    const species = Dex.forGen(profile.gen).species.get(member.stats.name);
    if (!species.exists) continue;
    for (const type of species.types) {
      counts.set(type, (counts.get(type) ?? 0) + 1);
    }
  }

  let penalty = 0;
  for (const count of counts.values()) {
    penalty += Math.max(0, count - 2) * 0.5;
  }

  return penalty > 0 ? clamp(-penalty, -2, 0) : 0;
}

function threatScore(members: TeamMember[], dataset: StatsDataset): number {
  const coverage = threatCoverage(members, dataset);
  const totalUsage = coverage.reduce((sum, item) => sum + item.usage, 0);
  if (!totalUsage) return 0;

  const coveredUsage = coverage
    .filter(item => item.covered)
    .reduce((sum, item) => sum + item.usage, 0);

  return clamp((coveredUsage / totalUsage) * 3, 0, 3);
}

/**
 * Rewards one committed weather or terrain with dedicated abusers, and marks
 * down teams that spread themselves across several conditions.
 */
function weatherArchetypeFit(members: TeamMember[]): number {
  const condition = committedCondition(members);
  if (!condition) return 0;

  const offConditionAbusers = members.filter(member => {
    if (memberSetConditions(member).has(condition)) return false;
    const abused = memberAbusedConditions(member);
    return abused.size > 0 && !abused.has(condition);
  }).length;

  return 3
    + abuserCount(members, condition) * 1.8
    - Math.max(0, setterCount(members, condition) - 1) * 1.5
    - offConditionAbusers * 1.2;
}

/**
 * Signed and large enough to matter: a team built against its archetype has to
 * be able to score worse than a team built for it, or the choice is cosmetic.
 */
function archetypeScore(members: TeamMember[], profile: FormatProfile, archetype: Archetype): number {
  if (archetype === 'balanced') return 0;

  const totals = roleTotals(members);
  const teamSize = Math.max(members.length, 1);

  if (archetype === 'weather') {
    return clamp((weatherArchetypeFit(members) / teamSize) * 2, 0, 3);
  }

  if (archetype === 'trick-room') {
    const slowComplement = members.reduce((sum, member) => sum + trickRoomSlowComplement(member, profile), 0);
    const score = totals.speedControl * 1.3
      + totals.positioning
      + totals.spreadPressure * (profile.battleStyle === 'doubles' ? 1 : 0.5)
      + slowComplement * 1.8
      - trickRoomSupportPenalty(members, profile);
    return clamp((score / teamSize) * 2, 0, 3);
  }

  return clamp(statTargetScore(members, profile, archetype), -5, 2.5);
}

function warningList(members: TeamMember[], profile: FormatProfile, archetype: Archetype): string[] {
  const warnings = [...profile.warnings];
  const ids = new Set<string>();

  for (const member of members) {
    if (ids.has(member.stats.id)) {
      warnings.push(`Duplicate Pokemon: ${member.stats.name}`);
    }
    ids.add(member.stats.id);
  }

  warnings.push(...unsupportedTerrainSeedWarnings(members));
  warnings.push(...multipleMegaStoneWarnings(members, profile));
  warnings.push(...fieldConflictWarnings(members));
  warnings.push(...unpairedWeatherWarnings(members));

  if (trickRoomSupportPenalty(members, profile) > 0) {
    warnings.push('Trick Room needs slow attackers or bulky partners to capitalize on the speed reversal');
  }

  if (archetype === 'trick-room' && members.length && !members.some(memberHasTrickRoom)) {
    warnings.push('No Pokemon on this team can set Trick Room');
  }

  return warnings;
}

export function scoreTeam(
  members: TeamMember[],
  dataset: StatsDataset,
  baseProfile: FormatProfile,
  archetype: Archetype = 'balanced'
): ScoreBreakdown {
  // The archetype reshapes what a good team is, so it has to reach the role
  // weights themselves rather than only adding a bonus on top of them.
  const profile = archetypeProfile(baseProfile, archetype);
  const scores = {
    usage: usageScore(members, dataset),
    setConfidence: setConfidenceScore(members),
    synergy: synergyScore(members),
    roles: roleScore(members, profile),
    threats: threatScore(members, dataset),
    typeBalance: typeBalanceScore(members, profile),
    setToTeamFit: setToTeamFitScore(members, profile),
    duplicateRoles: duplicateRoleScore(members, profile),
    archetype: archetypeScore(members, profile, archetype),
    leads: leadScore(members, dataset, profile)
  };

  const total = Object.values(scores).reduce((sum, value) => sum + value, 0);

  return {
    total: roundScore(total),
    usage: roundScore(scores.usage),
    setConfidence: roundScore(scores.setConfidence),
    synergy: roundScore(scores.synergy),
    roles: roundScore(scores.roles),
    threats: roundScore(scores.threats),
    typeBalance: roundScore(scores.typeBalance),
    setToTeamFit: roundScore(scores.setToTeamFit),
    duplicateRoles: roundScore(scores.duplicateRoles),
    archetype: roundScore(scores.archetype),
    leads: roundScore(scores.leads),
    warnings: warningList(members, profile, archetype)
  };
}

export function attachInsights(team: Omit<GeneratedTeam, 'threats' | 'synergy'>, dataset: StatsDataset): GeneratedTeam {
  return {
    ...team,
    threats: threatCoverage(team.members, dataset),
    synergy: synergyInsights(team.members)
  };
}
