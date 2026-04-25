import {describe, expect, it} from 'vitest';
import {makePokemon} from '../test/fixtures';
import {inferFormatProfile} from './formatProfile';
import {detectRoles} from './roles';

describe('detectRoles', () => {
  it('detects singles hazard and removal roles', () => {
    const roles = detectRoles(makePokemon({
      id: 'greattusk',
      name: 'Great Tusk',
      moves: {stealthrock: 60, rapidspin: 90, headlongrush: 90, closecombat: 40}
    }), inferFormatProfile('gen9ou'));

    expect(roles.hazardSetter).toBeGreaterThan(0.4);
    expect(roles.hazardRemoval).toBeGreaterThan(0.6);
  });

  it('detects doubles speed control and positioning roles', () => {
    const roles = detectRoles(makePokemon({
      id: 'tornadus',
      name: 'Tornadus',
      moves: {tailwind: 95, protect: 55, taunt: 40, bleakwindstorm: 80}
    }), inferFormatProfile('gen9doublesou'));

    expect(roles.speedControl).toBeGreaterThan(0.8);
    expect(roles.positioning).toBeGreaterThan(0.3);
    expect(roles.spreadPressure).toBeGreaterThan(0.4);
  });
});
