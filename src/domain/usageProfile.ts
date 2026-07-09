import type {StatsDataset} from './types';

const coreSize = 6;
const openMetagameUsage = 30;
const standardizedMetagameUsage = 70;

const concentrationCache = new WeakMap<StatsDataset, number>();
const floorCache = new WeakMap<StatsDataset, number>();
const eligibleCache = new WeakMap<StatsDataset, Set<string>>();
const usageFloorShare = 0.05;
const minimumEligible = 12;
const noveltyDamping = 0.75;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * How standardized a metagame is, from 0 (open) to 1 (near-fixed teams).
 *
 * Weighted usage sums to roughly 600% across a stats file regardless of how
 * many Pokemon it lists, so the mean usage of the top six is comparable across
 * formats. Gen 1 OU sits near 80%, current Gen 9 OU near 30%.
 */
export function usageConcentration(dataset: StatsDataset): number {
  const cached = concentrationCache.get(dataset);
  if (cached !== undefined) return cached;

  const topUsage = dataset.pokemon
    .map(stats => Math.max(stats.usage, 0))
    .sort((a, b) => b - a)
    .slice(0, coreSize);
  const meanUsage = topUsage.length
    ? topUsage.reduce((sum, usage) => sum + usage, 0) / topUsage.length
    : 0;
  const concentration = clamp(
    (meanUsage - openMetagameUsage) / (standardizedMetagameUsage - openMetagameUsage),
    0,
    1
  );

  concentrationCache.set(dataset, concentration);
  return concentration;
}

/**
 * A standardized format should reproduce its standard core while its flex slots
 * keep rotating, so exploration is damped in proportion to how standardized the
 * format is rather than switched off.
 */
export function effectiveNovelty(novelty: number, dataset: StatsDataset): number {
  return novelty * (1 - noveltyDamping * usageConcentration(dataset));
}

/**
 * Lowest usage a Pokemon needs before the generator will consider it. Keeps
 * exploration inside the Pokemon a format actually plays: a Pokemon at 5% of
 * the most-used Pokemon's share is a niche pick, not a flex slot.
 */
export function usageFloor(dataset: StatsDataset): number {
  const cached = floorCache.get(dataset);
  if (cached !== undefined) return cached;

  const topUsage = dataset.pokemon.reduce((best, stats) => Math.max(best, stats.usage), 0);
  const floor = topUsage * usageFloorShare;

  floorCache.set(dataset, floor);
  return floor;
}

/**
 * Eligibility is decided once against the whole stats file, not against the
 * shrinking pool of unpicked Pokemon. Deciding it per pick would let the floor
 * switch itself off for the last slots, which is where niche picks appear.
 */
export function eligibleIds(dataset: StatsDataset): Set<string> {
  const cached = eligibleCache.get(dataset);
  if (cached) return cached;

  const floor = usageFloor(dataset);
  const above = dataset.pokemon.filter(stats => stats.usage >= floor);
  const eligible = new Set((above.length >= minimumEligible ? above : dataset.pokemon).map(stats => stats.id));

  eligibleCache.set(dataset, eligible);
  return eligible;
}

export function isEligible(dataset: StatsDataset, id: string): boolean {
  return eligibleIds(dataset).has(id);
}

/**
 * In an open format usage is one signal among many. In a standardized one the
 * usage list is close to the team list, so it has to outweigh the role and
 * synergy terms that otherwise reward rarely used Pokemon.
 */
export function usageWeight(dataset: StatsDataset): number {
  return 2 + 6 * usageConcentration(dataset);
}
