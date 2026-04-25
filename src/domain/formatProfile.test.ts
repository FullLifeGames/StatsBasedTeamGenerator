import {describe, expect, it} from 'vitest';
import {inferFormatProfile} from './formatProfile';

describe('inferFormatProfile', () => {
  it('uses singles hazard weights for singles formats', () => {
    const profile = inferFormatProfile('gen9ou');
    expect(profile.battleStyle).toBe('singles');
    expect(profile.teamSize).toBe(6);
    expect(profile.roleWeights.hazardSetter).toBeGreaterThan(profile.roleWeights.speedControl);
  });

  it('uses doubles speed control weights for doubles formats', () => {
    const profile = inferFormatProfile('gen9doublesou');
    expect(profile.battleStyle).toBe('doubles');
    expect(profile.roleWeights.speedControl).toBeGreaterThan(profile.roleWeights.hazardSetter);
    expect(profile.roleWeights.positioning).toBeGreaterThan(1);
  });
});
