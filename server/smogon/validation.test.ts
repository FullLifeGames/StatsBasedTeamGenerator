import {describe, expect, it} from 'vitest';
import {validateShowdownImport} from './validation';

const validOuTeam = `Great Tusk @ Leftovers
Ability: Protosynthesis
Tera Type: Ground
EVs: 252 Atk / 4 SpD / 252 Spe
Jolly Nature
- Earthquake
- Rapid Spin
- Knock Off
- Stealth Rock

Gholdengo @ Choice Scarf
Ability: Good as Gold
Tera Type: Steel
EVs: 252 SpA / 4 SpD / 252 Spe
Timid Nature
- Make It Rain
- Shadow Ball
- Trick
- Focus Blast

Kingambit @ Black Glasses
Ability: Supreme Overlord
Tera Type: Dark
EVs: 252 Atk / 4 SpD / 252 Spe
Adamant Nature
- Kowtow Cleave
- Sucker Punch
- Iron Head
- Swords Dance

Dragapult @ Heavy-Duty Boots
Ability: Infiltrator
Tera Type: Dragon
EVs: 252 SpA / 4 SpD / 252 Spe
Timid Nature
- Draco Meteor
- Shadow Ball
- U-turn
- Thunder Wave

Ting-Lu @ Leftovers
Ability: Vessel of Ruin
Tera Type: Poison
EVs: 252 HP / 4 Atk / 252 SpD
Careful Nature
- Spikes
- Earthquake
- Ruination
- Whirlwind

Iron Valiant @ Booster Energy
Ability: Quark Drive
Tera Type: Fairy
EVs: 252 SpA / 4 SpD / 252 Spe
Timid Nature
- Moonblast
- Close Combat
- Knock Off
- Encore`;

describe('validateShowdownImport', () => {
  it('validates legal-looking teams with @pkmn/sim TeamValidator', () => {
    const validation = validateShowdownImport('gen9ou', validOuTeam);

    expect(validation.status).toBe('valid');
    expect(validation.problems).toEqual([]);
  });

  it('returns validator problems for illegal format clauses', () => {
    const validation = validateShowdownImport('gen9ou', validOuTeam.replace('Gholdengo @ Choice Scarf', 'Great Tusk @ Choice Scarf'));

    expect(validation.status).toBe('invalid');
    expect(validation.problems.join('\n')).toMatch(/limited to one of each/i);
  });

  it('reports unsupported bundled formats as unavailable', () => {
    const validation = validateShowdownImport('gen9madeupformat', validOuTeam);

    expect(validation.status).toBe('unavailable');
    expect(validation.problems[0]).toMatch(/not bundled/i);
  });
});
