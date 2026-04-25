import {describe, expect, it} from 'vitest';
import {makePokemon} from '../test/fixtures';
import {inferFormatProfile} from './formatProfile';
import {detectRoles, detectRolesForMoves} from './roles';

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

  it('scales breaker, pivot, and cleaner roles by relative move and item weights', () => {
    const fringeRoles = detectRoles(makePokemon({
      id: 'fringemon',
      name: 'Fringe Mon',
      moves: {
        suckerpunch: 1,
        closecombat: 1,
        moonblast: 1,
        uturn: 1,
        recover: 1,
        filler: 995
      },
      items: {leftovers: 1, heavydutyboots: 999}
    }), inferFormatProfile('gen9ou'));

    expect(fringeRoles.physicalBreaker).toBeLessThan(0.1);
    expect(fringeRoles.specialBreaker).toBeLessThan(0.1);
    expect(fringeRoles.cleaner).toBeLessThan(0.1);
    expect(fringeRoles.defensivePivot).toBeLessThan(0.1);
    expect(fringeRoles.offensivePivot).toBeLessThan(0.1);

    const primaryRoles = detectRoles(makePokemon({
      id: 'primarymon',
      name: 'Primary Mon',
      moves: {
        suckerpunch: 80,
        closecombat: 80,
        moonblast: 90,
        uturn: 75,
        recover: 70,
        filler: 20
      },
      items: {leftovers: 90, heavydutyboots: 10}
    }), inferFormatProfile('gen9ou'));

    expect(primaryRoles.physicalBreaker).toBeGreaterThan(0.8);
    expect(primaryRoles.specialBreaker).toBeGreaterThan(0.8);
    expect(primaryRoles.cleaner).toBeGreaterThan(0.7);
    expect(primaryRoles.defensivePivot).toBeGreaterThan(0.7);
    expect(primaryRoles.offensivePivot).toBeGreaterThan(0.7);
  });

  it('detects roles from selected moves instead of the whole move table', () => {
    const stats = makePokemon({
      id: 'greattusk',
      name: 'Great Tusk',
      moves: {stealthrock: 80, rapidspin: 95, headlongrush: 90, closecombat: 65, knockoff: 55}
    });

    const roles = detectRolesForMoves(stats, inferFormatProfile('gen9ou'), [
      'rapidspin',
      'headlongrush',
      'closecombat',
      'knockoff'
    ]);

    expect(roles.hazardSetter).toBe(0);
    expect(roles.hazardRemoval).toBeGreaterThan(0.7);
    expect(roles.itemDisruption).toBeGreaterThan(0.4);
  });

  it('weights ability-derived roles by ability share', () => {
    const profile = inferFormatProfile('gen9doublesou');
    const fringeRoles = detectRoles(makePokemon({
      id: 'fringeintimidate',
      name: 'Fringe Intimidate',
      moves: {tackle: 100},
      abilities: {intimidate: 1, pressure: 99}
    }), profile);
    const dominantRoles = detectRoles(makePokemon({
      id: 'dominantintimidate',
      name: 'Dominant Intimidate',
      moves: {tackle: 100},
      abilities: {intimidate: 90, pressure: 10}
    }), profile);

    expect(fringeRoles.boardControl).toBeLessThan(0.4);
    expect(dominantRoles.boardControl).toBeGreaterThan(0.6);
  });

  it('detects conservative weather and terrain abuser roles', () => {
    const roles = detectRoles(makePokemon({
      id: 'barraskewda',
      name: 'Barraskewda',
      moves: {liquidation: 80, closecombat: 40, flipturn: 70},
      abilities: {swiftswim: 85, propellertail: 15}
    }), inferFormatProfile('gen9ou'));

    expect(roles.weatherTerrainAbuser).toBeGreaterThan(0.6);
  });
});
