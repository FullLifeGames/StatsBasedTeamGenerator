import {toId} from './id';
import type {FormatProfile, StatsDataset, TeamMember} from './types';

const leadRowPattern = /^\s*\|\s*\d+\s*\|\s*([^|]+?)\s*\|\s*([\d.]+)%/;
const topLeadCache = new WeakMap<StatsDataset, number>();

export type LeadUsage = Record<string, number>;

/**
 * Smogon publishes leads as a fixed-width text table rather than JSON:
 *
 *   | 1    | Jynx               | 22.62514% | 6393   | 17.078% |
 */
export function parseLeads(text: string): LeadUsage {
  const leads: LeadUsage = {};

  for (const line of text.split('\n')) {
    const match = leadRowPattern.exec(line);
    if (!match) continue;

    const usage = Number(match[2]);
    if (!Number.isFinite(usage)) continue;
    leads[toId(match[1])] = usage;
  }

  return leads;
}

export function attachLeads(dataset: StatsDataset, leads: LeadUsage): StatsDataset {
  const pokemon = dataset.pokemon.map(stats => ({
    ...stats,
    leadUsage: leads[stats.id] ?? 0
  }));

  return {
    ...dataset,
    pokemon,
    pokemonById: Object.fromEntries(pokemon.map(stats => [stats.id, stats]))
  };
}

export function topLeadUsage(dataset: StatsDataset): number {
  const cached = topLeadCache.get(dataset);
  if (cached !== undefined) return cached;

  const top = dataset.pokemon.reduce((best, stats) => Math.max(best, stats.leadUsage ?? 0), 0);
  topLeadCache.set(dataset, top);
  return top;
}

export function bestLeadMember(members: TeamMember[]): TeamMember | null {
  return members.reduce<TeamMember | null>((best, member) => {
    const usage = member.stats.leadUsage ?? 0;
    if (usage <= 0) return best;
    return !best || usage > (best.stats.leadUsage ?? 0) ? member : best;
  }, null);
}

/**
 * Before team preview, the lead is chosen blind and decides the opening turns,
 * so a team without a credible lead is a real weakness in Gens 1 to 4.
 */
export function leadScore(members: TeamMember[], dataset: StatsDataset, profile: FormatProfile): number {
  if (!profile.usesLeads) return 0;

  const top = topLeadUsage(dataset);
  if (top <= 0) return 0;

  const best = bestLeadMember(members)?.stats.leadUsage ?? 0;
  return Math.min(1, best / top) * 1.5;
}

/**
 * Before team preview, the first Pokemon of the team is the one that is sent
 * out, so the chosen lead has to occupy the first slot of the Showdown import
 * rather than merely being labelled somewhere in the team.
 */
export function applyLead(members: TeamMember[], dataset: StatsDataset, profile: FormatProfile): TeamMember[] {
  // A locked member can carry a stale lead flag in from an earlier generation.
  const cleared = members.map(member => member.lead ? {...member, lead: undefined} : member);
  if (!profile.usesLeads || topLeadUsage(dataset) <= 0) return cleared;

  const lead = bestLeadMember(cleared);
  if (!lead) return cleared;

  const marked: TeamMember = {
    ...lead,
    lead: true,
    explanation: [...lead.explanation, `Leads: used as lead in ${(lead.stats.leadUsage ?? 0).toFixed(1)}% of games`]
  };

  return [marked, ...cleared.filter(member => member !== lead)];
}
