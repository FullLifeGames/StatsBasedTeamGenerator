import {describe, expect, it} from 'vitest';
import {makeDataset, makePokemon} from '../test/fixtures';
import {effectiveNovelty, eligibleIds, isEligible, usageConcentration, usageFloor, usageWeight} from './usageProfile';

function datasetWithUsages(usages: number[]) {
  return makeDataset(usages.map((usage, index) => makePokemon({
    id: `mon${index}`,
    name: `Mon ${index}`,
    usage
  })));
}

describe('usageConcentration', () => {
  it('reports a standardized metagame when the top six are near-mandatory', () => {
    const gen1Like = datasetWithUsages([99, 92, 88, 80, 66, 62, 30, 22, 18, 12, 8, 4]);
    expect(usageConcentration(gen1Like)).toBe(1);
  });

  it('reports an open metagame when usage is spread across many Pokemon', () => {
    const gen9Like = datasetWithUsages([35, 33, 30, 28, 25, 22, 20, 18, 17, 16, 15, 15]);
    expect(usageConcentration(gen9Like)).toBe(0);
  });

  it('scales between the two extremes', () => {
    const gen2Like = datasetWithUsages([70, 62, 58, 50, 44, 40, 30, 25]);
    const concentration = usageConcentration(gen2Like);
    expect(concentration).toBeGreaterThan(0);
    expect(concentration).toBeLessThan(1);
  });

  it('does not treat a small stats file as standardized on its own', () => {
    expect(usageConcentration(datasetWithUsages([12, 10, 8]))).toBe(0);
  });
});

describe('effectiveNovelty', () => {
  it('damps but does not remove exploration in standardized formats', () => {
    const standardized = datasetWithUsages([99, 92, 88, 80, 66, 62]);
    expect(effectiveNovelty(0.55, standardized)).toBeCloseTo(0.1375, 4);
  });

  it('leaves exploration intact in open formats', () => {
    const open = datasetWithUsages([35, 33, 30, 28, 25, 22]);
    expect(effectiveNovelty(0.55, open)).toBe(0.55);
  });
});

describe('usageWeight', () => {
  it('weighs usage more heavily the more standardized the format is', () => {
    expect(usageWeight(datasetWithUsages([35, 33, 30, 28, 25, 22]))).toBe(2);
    expect(usageWeight(datasetWithUsages([99, 92, 88, 80, 66, 62]))).toBe(8);
  });
});

// Twelve Pokemon clear the 5% floor, which is the minimum before it applies.
const floorDataset = () => datasetWithUsages([100, 95, 90, 85, 80, 70, 60, 50, 40, 30, 20, 10, 4, 1]);

describe('eligibleIds', () => {
  it('excludes Pokemon far below the most-used Pokemon', () => {
    const dataset = floorDataset();

    expect(usageFloor(dataset)).toBe(5);
    expect(eligibleIds(dataset).has('mon11')).toBe(true);
    expect(eligibleIds(dataset).has('mon12')).toBe(false);
  });

  it('keeps every Pokemon when too few clear the floor', () => {
    const dataset = datasetWithUsages([100, 4, 3, 2]);
    expect(eligibleIds(dataset).size).toBe(4);
  });

  it('decides eligibility against the whole stats file, not a shrinking pool', () => {
    expect(isEligible(floorDataset(), 'mon13')).toBe(false);
    expect(isEligible(floorDataset(), 'mon0')).toBe(true);
  });
});
