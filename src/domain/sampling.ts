export type Rng = () => number;

const temperatureScale = 3;

export function createRng(seed: number): Rng {
  let state = (seed || 1) >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Temperature for softmax sampling, scaled to how far apart the candidate
 * scores actually are. A fixed offset would be swamped in formats that spread
 * their scores widely and would dominate in formats that bunch them together.
 *
 * The multiplier is what lets a Pokemon that is genuinely best in every partial
 * team still be passed over sometimes: at one standard deviation a staple wins
 * effectively always, which is what made single Pokemon appear in every team.
 */
export function samplingTemperature(scores: number[], novelty: number): number {
  if (novelty <= 0) return 0;
  return standardDeviation(scores) * novelty * temperatureScale;
}

/**
 * Draws `count` distinct items without replacement, weighted by softmax of
 * their scores. Falls back to the deterministic top-`count` when there is no
 * temperature, which keeps novelty: 0 reproducible.
 */
export function sampleByScore<T>(
  items: T[],
  count: number,
  scoreOf: (item: T) => number,
  temperature: number,
  rng: Rng | null
): T[] {
  const ranked = [...items].sort((a, b) => scoreOf(b) - scoreOf(a));
  if (!rng || !Number.isFinite(temperature) || temperature <= 0) return ranked.slice(0, count);

  const pool = ranked;
  const chosen: T[] = [];

  while (chosen.length < count && pool.length) {
    const best = scoreOf(pool[0]);
    const weights = pool.map(item => Math.exp((scoreOf(item) - best) / temperature));
    const total = weights.reduce((sum, weight) => sum + weight, 0);

    let threshold = rng() * total;
    let index = pool.length - 1;
    for (let candidate = 0; candidate < pool.length; candidate += 1) {
      threshold -= weights[candidate];
      if (threshold <= 0) {
        index = candidate;
        break;
      }
    }

    chosen.push(pool[index]);
    pool.splice(index, 1);
  }

  return chosen;
}
