import {scoreSetForTeamContext} from './sets';
import type {
  FormatProfile,
  GeneratedTeam,
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

function teammateScore(a: TeamMember, b: TeamMember): number {
  const weight = a.stats.teammates[b.stats.id] ?? 0;
  if (weight <= 0) return 0;

  const usageBaseline = Math.sqrt(Math.max(a.stats.usage, 1) * Math.max(b.stats.usage, 1));
  return Math.log1p(weight) / usageBaseline;
}

function pairSynergy(a: TeamMember, b: TeamMember): number {
  const score = average([
    teammateScore(a, b),
    teammateScore(b, a)
  ].filter(value => value > 0));

  return clamp(score * 10, 0, 3);
}

export function synergyInsights(members: TeamMember[]): SynergyInsight[] {
  const insights: SynergyInsight[] = [];

  for (let i = 0; i < members.length; i += 1) {
    for (let j = i + 1; j < members.length; j += 1) {
      const score = pairSynergy(members[i], members[j]);
      if (score > 0) {
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

export function threatCoverage(members: TeamMember[], dataset: StatsDataset, limit = 12): ThreatCoverage[] {
  const teamIds = new Set(members.map(member => member.stats.id));
  const threats = dataset.pokemon
    .filter(stats => !teamIds.has(stats.id))
    .sort((a, b) => b.usage - a.usage)
    .slice(0, limit);

  return threats.map(threat => {
    const answers = members
      .flatMap(member => member.stats.checks
        .filter(edge => edge.target === threat.id)
        .map(edge => ({
          pokemonId: member.stats.id,
          pokemonName: member.stats.name,
          confidence: roundScore(confidenceForThreat(edge))
        })))
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
  const maxUsage = Math.max(...dataset.pokemon.map(stats => stats.usage), 1);
  return clamp(average(members.map(member => member.stats.usage / maxUsage)) * 2, 0, 2);
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

function roleScore(members: TeamMember[], profile: FormatProfile): number {
  const totals = roleTotals(members);
  const cap = profile.battleStyle === 'doubles' ? 2 : 1.5;
  const score = roleKeys.reduce((sum, role) => {
    const weight = profile.roleWeights[role];
    return sum + Math.min(totals[role], cap) * weight;
  }, 0);

  return clamp(score, 0, 10);
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

function setToTeamFitScore(members: TeamMember[], profile: FormatProfile): number {
  let score = 0;

  for (let index = 0; index < members.length; index += 1) {
    const previousSetRoles = members.slice(0, index).map(member => ({roles: member.set.roles}));
    score += scoreSetForTeamContext(members[index].set, previousSetRoles, profile);
  }

  return clamp(score, -5, 5);
}

function synergyScore(members: TeamMember[]): number {
  return clamp(average(synergyInsights(members).map(insight => insight.score)), 0, 3);
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

function warningList(members: TeamMember[], profile: FormatProfile): string[] {
  const warnings = [...profile.warnings];
  const ids = new Set<string>();

  for (const member of members) {
    if (ids.has(member.stats.id)) {
      warnings.push(`Duplicate Pokemon: ${member.stats.name}`);
    }
    ids.add(member.stats.id);
  }

  return warnings;
}

export function scoreTeam(members: TeamMember[], dataset: StatsDataset, profile: FormatProfile): ScoreBreakdown {
  const scores = {
    usage: usageScore(members, dataset),
    setConfidence: setConfidenceScore(members),
    synergy: synergyScore(members),
    roles: roleScore(members, profile),
    threats: threatScore(members, dataset),
    typeBalance: 0,
    setToTeamFit: setToTeamFitScore(members, profile),
    duplicateRoles: duplicateRoleScore(members, profile),
    archetype: 0
  };

  const total = Object.values(scores).reduce((sum, value) => sum + value, 0);

  return {
    total: roundScore(total),
    usage: roundScore(scores.usage),
    setConfidence: roundScore(scores.setConfidence),
    synergy: roundScore(scores.synergy),
    roles: roundScore(scores.roles),
    threats: roundScore(scores.threats),
    typeBalance: scores.typeBalance,
    setToTeamFit: roundScore(scores.setToTeamFit),
    duplicateRoles: roundScore(scores.duplicateRoles),
    archetype: scores.archetype,
    warnings: warningList(members, profile)
  };
}

export function attachInsights(team: Omit<GeneratedTeam, 'threats' | 'synergy'>, dataset: StatsDataset): GeneratedTeam {
  return {
    ...team,
    threats: threatCoverage(team.members, dataset),
    synergy: synergyInsights(team.members)
  };
}
