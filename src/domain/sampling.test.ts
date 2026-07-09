import {describe, expect, it} from 'vitest';
import {createRng, sampleByScore, samplingTemperature, standardDeviation} from './sampling';

const items = [
  {id: 'a', score: 10},
  {id: 'b', score: 9},
  {id: 'c', score: 8},
  {id: 'd', score: 1}
];

const scoreOf = (item: {score: number}) => item.score;

describe('createRng', () => {
  it('is deterministic for a seed and differs between seeds', () => {
    const first = Array.from({length: 4}, createRng(42));
    expect(Array.from({length: 4}, createRng(42))).toEqual(first);
    expect(Array.from({length: 4}, createRng(43))).not.toEqual(first);
  });

  it('stays inside the unit interval', () => {
    const rng = createRng(7);
    for (let draw = 0; draw < 200; draw += 1) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe('samplingTemperature', () => {
  it('is zero without novelty, which keeps selection deterministic', () => {
    expect(samplingTemperature([1, 5, 9], 0)).toBe(0);
  });

  it('scales with how far apart the scores are', () => {
    const tight = samplingTemperature([5, 5.1, 5.2], 0.5);
    const wide = samplingTemperature([1, 5, 9], 0.5);
    expect(wide).toBeGreaterThan(tight);
    expect(tight).toBeGreaterThan(0);
  });
});

describe('standardDeviation', () => {
  it('is zero for fewer than two values', () => {
    expect(standardDeviation([])).toBe(0);
    expect(standardDeviation([4])).toBe(0);
  });
});

describe('sampleByScore', () => {
  it('takes the deterministic top-k without an rng', () => {
    expect(sampleByScore(items, 2, scoreOf, 5, null).map(item => item.id)).toEqual(['a', 'b']);
  });

  it('takes the deterministic top-k at zero temperature', () => {
    expect(sampleByScore(items, 2, scoreOf, 0, createRng(1)).map(item => item.id)).toEqual(['a', 'b']);
  });

  it('falls back to deterministic selection for a non-finite temperature', () => {
    expect(sampleByScore(items, 2, scoreOf, Number.NaN, createRng(1)).map(item => item.id)).toEqual(['a', 'b']);
  });

  it('draws distinct items without replacement', () => {
    const drawn = sampleByScore(items, 3, scoreOf, 2, createRng(5));
    expect(new Set(drawn.map(item => item.id)).size).toBe(3);
  });

  it('never returns more items than exist', () => {
    expect(sampleByScore(items, 99, scoreOf, 2, createRng(5))).toHaveLength(items.length);
  });

  it('prefers higher scores but still reaches lower ones', () => {
    const winners = Array.from({length: 200}, (_, seed) => sampleByScore(items, 1, scoreOf, 2, createRng(seed + 1))[0].id);
    const counts = new Map<string, number>();
    for (const id of winners) counts.set(id, (counts.get(id) ?? 0) + 1);

    expect(counts.get('a')).toBeGreaterThan(counts.get('c') ?? 0);
    expect(counts.get('b') ?? 0).toBeGreaterThan(0);
    // The clearly worst option should stay rare.
    expect(counts.get('d') ?? 0).toBeLessThan(counts.get('a') ?? 0);
  });
});
