import {describe, expect, it} from 'vitest';
import {isValidSetRequest, isValidStatsRequest, isValidValidationRequest} from './routes';

describe('Smogon stats route validation', () => {
  it('accepts digit-only non-negative integer cutoffs', () => {
    expect(isValidStatsRequest('2026-03', 'gen9ou', '1825')).toBe(true);
    expect(isValidStatsRequest('2026-03', 'gen9ou', '0')).toBe(true);
  });

  it('rejects non-integer cutoff strings', () => {
    expect(isValidStatsRequest('2026-03', 'gen9ou', '1e3')).toBe(false);
    expect(isValidStatsRequest('2026-03', 'gen9ou', '1825.5')).toBe(false);
    expect(isValidStatsRequest('2026-03', 'gen9ou', '-1')).toBe(false);
  });
});

describe('Smogon set route validation', () => {
  it('accepts a valid format and bounded Pokemon list', () => {
    expect(isValidSetRequest('gen9ou', ['Garchomp', 'Baxcalibur'])).toBe(true);
  });

  it('rejects invalid format ids and unbounded inputs', () => {
    expect(isValidSetRequest('gen9/ou', ['Garchomp'])).toBe(false);
    expect(isValidSetRequest('gen9ou', 'Garchomp')).toBe(false);
    expect(isValidSetRequest('gen9ou', Array.from({length: 81}, (_, index) => `Pokemon ${index}`))).toBe(false);
  });
});

describe('Showdown validation route validation', () => {
  it('accepts bounded importable text for valid format ids', () => {
    expect(isValidValidationRequest('gen9ou', 'Great Tusk\n- Earthquake')).toBe(true);
  });

  it('rejects invalid format ids and empty or oversized importables', () => {
    expect(isValidValidationRequest('gen9/ou', 'Great Tusk\n- Earthquake')).toBe(false);
    expect(isValidValidationRequest('gen9ou', '')).toBe(false);
    expect(isValidValidationRequest('gen9ou', 'x'.repeat(30_001))).toBe(false);
  });
});
