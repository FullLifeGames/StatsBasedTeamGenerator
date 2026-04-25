import {describe, expect, it} from 'vitest';
import {isValidStatsRequest} from './routes';

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
