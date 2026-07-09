import {Dex} from '@pkmn/dex';
import type {Archetype, FormatProfile, PokemonStats, RoleScores, RoleWeights, SetCandidate, TeamMember} from './types';

export interface ArchetypeListing {
  value: Archetype;
  label: string;
  description: string;
}

/** Base-stat axes, each normalized to roughly 0..1. */
interface StatAxes {
  offense: number;
  speed: number;
  bulk: number;
}

/**
 * Minimum an archetype demands on the axes it cares about. Stated as a floor
 * rather than a target because the requirement is directional: hyper offense
 * needs a Pokemon to be fast enough, and does not mind it being faster.
 */
type StatRequirement = Partial<StatAxes>;

interface ArchetypeDefinition {
  label: string;
  description: string;
  /** Multiplies the format's role weights, so the archetype reshapes what a good team is. */
  roleMultipliers: Partial<Record<keyof RoleScores, number>>;
  requirement: StatRequirement;
}

const definitions: Record<Archetype, ArchetypeDefinition> = {
  'hyper-offense': {
    label: 'Hyper offense',
    description: 'Hazards up immediately, then setup sweepers that never switch out.',
    roleMultipliers: {
      setup: 2.6,
      cleaner: 2.2,
      physicalBreaker: 1.9,
      specialBreaker: 1.9,
      hazardSetter: 2.0,
      offensivePivot: 1.1,
      hazardPreservation: 1.3,
      speedControl: 1.2,
      defensivePivot: 0.1,
      hazardRemoval: 0.2,
      support: 0.25,
      status: 0.3
    },
    requirement: {offense: 0.78, speed: 0.8}
  },
  offense: {
    label: 'Offense',
    description: 'Fast attackers that trade hits and keep momentum.',
    roleMultipliers: {
      setup: 1.7,
      cleaner: 1.7,
      physicalBreaker: 1.7,
      specialBreaker: 1.7,
      offensivePivot: 1.4,
      hazardSetter: 1.2,
      defensivePivot: 0.35,
      hazardRemoval: 0.7,
      support: 0.5,
      status: 0.5
    },
    requirement: {offense: 0.72, speed: 0.66}
  },
  'bulky-offense': {
    label: 'Bulky offense',
    description: 'Attackers with enough bulk to switch in and stay in.',
    roleMultipliers: {
      physicalBreaker: 1.3,
      specialBreaker: 1.3,
      offensivePivot: 1.4,
      defensivePivot: 1.4,
      hazardRemoval: 1.2,
      hazardSetter: 1.1,
      setup: 0.9,
      cleaner: 0.9,
      support: 1
    },
    requirement: {offense: 0.62, bulk: 0.62}
  },
  balanced: {
    label: 'Balanced',
    description: 'No shape imposed; the format\'s own role weights decide.',
    roleMultipliers: {},
    requirement: {}
  },
  stall: {
    label: 'Stall',
    description: 'Walls, recovery, and chip damage; wins by outlasting.',
    roleMultipliers: {
      defensivePivot: 2.4,
      support: 1.9,
      status: 1.9,
      hazardRemoval: 1.7,
      hazardPreservation: 1.7,
      hazardSetter: 1.5,
      itemDisruption: 1.3,
      setup: 0.15,
      cleaner: 0.3,
      physicalBreaker: 0.4,
      specialBreaker: 0.4,
      offensivePivot: 0.6
    },
    requirement: {bulk: 0.72}
  },
  weather: {
    label: 'Weather',
    description: 'One committed weather with abusers built around it.',
    roleMultipliers: {weatherTerrainSetter: 1.6, weatherTerrainAbuser: 1.6},
    requirement: {}
  },
  'trick-room': {
    label: 'Trick room',
    description: 'Reverses speed, then attacks with slow, bulky breakers.',
    roleMultipliers: {speedControl: 1.5, positioning: 1.2, spreadPressure: 1.2, cleaner: 0.5},
    requirement: {}
  }
};

export const archetypeListings: ArchetypeListing[] = (Object.keys(definitions) as Archetype[]).map(value => ({
  value,
  label: definitions[value].label,
  description: definitions[value].description
}));

export function archetypeLabel(archetype: Archetype): string {
  return definitions[archetype].label;
}

const roleKeys = Object.keys({
  physicalBreaker: 0,
  specialBreaker: 0,
  cleaner: 0,
  defensivePivot: 0,
  offensivePivot: 0,
  support: 0,
  status: 0,
  setup: 0,
  weatherTerrainSetter: 0,
  weatherTerrainAbuser: 0,
  hazardSetter: 0,
  hazardRemoval: 0,
  hazardPreservation: 0,
  itemDisruption: 0,
  speedControl: 0,
  positioning: 0,
  spreadPressure: 0,
  boardControl: 0
} satisfies RoleScores) as Array<keyof RoleScores>;

const statCache = new Map<string, StatAxes>();
const axisNames: Array<keyof StatAxes> = ['offense', 'speed', 'bulk'];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Base stats are the only signal that separates a wall from a sweeper when both
 * share a move pool, so archetypes are matched against them and not just roles.
 */
export function statAxes(stats: PokemonStats, profile: FormatProfile): StatAxes {
  const key = `${profile.gen}:${stats.id}`;
  const cached = statCache.get(key);
  if (cached) return cached;

  const species = Dex.forGen(profile.gen).species.get(stats.name);
  const base = species.exists
    ? species.baseStats
    : {hp: 80, atk: 80, def: 80, spa: 80, spd: 80, spe: 80};
  const axes: StatAxes = {
    offense: clamp(Math.max(base.atk, base.spa) / 150, 0, 1),
    speed: clamp(base.spe / 135, 0, 1),
    bulk: clamp((base.hp + base.def + base.spd) / 400, 0, 1)
  };

  statCache.set(key, axes);
  return axes;
}

/**
 * How far one Pokemon falls short of what the archetype demands. Exceeding a
 * requirement costs nothing, so a wall is not punished for being fast and a
 * sweeper is not punished for being sturdy.
 */
export function statShortfall(stats: PokemonStats, profile: FormatProfile, archetype: Archetype): number {
  const {requirement} = definitions[archetype];
  const axes = statAxes(stats, profile);

  return axisNames.reduce((total, axis) => {
    const minimum = requirement[axis];
    return minimum === undefined ? total : total + Math.max(0, minimum - axes[axis]);
  }, 0);
}

export function hasStatRequirement(archetype: Archetype): boolean {
  return Object.keys(definitions[archetype].requirement).length > 0;
}

/**
 * Applies the archetype's shape to the format's role weights. Duplicate-role
 * penalties stay untouched: stacking two hazard setters is a mistake in every
 * archetype, so it is a property of the format rather than of the game plan.
 */
export function archetypeRoleWeights(profile: FormatProfile, archetype: Archetype): RoleWeights {
  const multipliers = definitions[archetype].roleMultipliers;
  const weights = {...profile.roleWeights};

  for (const role of roleKeys) {
    const multiplier = multipliers[role];
    if (multiplier !== undefined) weights[role] = weights[role] * multiplier;
  }

  return weights;
}

export function archetypeProfile(profile: FormatProfile, archetype: Archetype): FormatProfile {
  return {...profile, roleWeights: archetypeRoleWeights(profile, archetype)};
}

/**
 * Signed: a team built against its archetype scores below zero. Averaging the
 * per-member shortfall rather than the raw stats keeps one slow Pokemon on a
 * hyper offense team visible instead of averaging it away.
 */
export function statTargetScore(members: TeamMember[], profile: FormatProfile, archetype: Archetype): number {
  if (!hasStatRequirement(archetype) || !members.length) return 0;

  const shortfall = members.reduce((sum, member) => sum + statShortfall(member.stats, profile, archetype), 0);
  return 2.5 - (shortfall / members.length) * 10;
}

/** How well one Pokemon suits the archetype, used to order the candidate pool. */
export function memberArchetypeFit(
  stats: PokemonStats,
  profile: FormatProfile,
  archetype: Archetype,
  roles: RoleScores
): number {
  const {roleMultipliers} = definitions[archetype];

  let roleFit = 0;
  for (const role of roleKeys) {
    const multiplier = roleMultipliers[role];
    if (multiplier !== undefined) roleFit += roles[role] * (multiplier - 1);
  }

  return roleFit - statShortfall(stats, profile, archetype) * 4;
}

/** How much a set's roles serve the archetype, ignoring its item and ability. */
export function roleAffinity(roles: RoleScores, archetype: Archetype): number {
  const {roleMultipliers} = definitions[archetype];
  let score = 0;

  for (const role of roleKeys) {
    const multiplier = roleMultipliers[role];
    if (multiplier !== undefined) score += roles[role] * (multiplier - 1);
  }

  return score;
}

/** Ranks a Pokemon's candidate sets so stall takes the wall set, not the sweeper set. */
export function setArchetypeScore(candidate: SetCandidate, archetype: Archetype): number {
  return roleAffinity(candidate.roles, archetype)
    + itemBias(candidate.itemId ?? candidate.item, archetype)
    + abilityBias(candidate.ability, archetype);
}

/**
 * Where an archetype sits on the offence/defence axis. Items, abilities, and EV
 * spreads are graded against this, so stall stops being handed a Life Orb and
 * hyper offense stops being handed Leftovers.
 */
const offensiveness: Record<Archetype, number> = {
  'hyper-offense': 1,
  offense: 0.75,
  'bulky-offense': 0.15,
  balanced: 0,
  stall: -0.85,
  weather: 0,
  'trick-room': -0.2
};

const offensiveItems = new Set([
  'lifeorb', 'choiceband', 'choicespecs', 'choicescarf', 'focussash', 'expertbelt',
  'loadeddice', 'punchingglove', 'weaknesspolicy', 'boosterenergy', 'widelens',
  'powerherb', 'kingsrock', 'scopelens', 'metronome'
]);

const defensiveItems = new Set([
  'leftovers', 'heavydutyboots', 'rockyhelmet', 'assaultvest', 'eviolite', 'blacksludge',
  'covertcloak', 'shedshell', 'airballoon', 'safetygoggles', 'chestoberry'
]);

const offensiveAbilities = new Set([
  'sheerforce', 'adaptability', 'technician', 'tintedlens', 'moxie', 'hugepower', 'purepower',
  'speedboost', 'moldbreaker', 'sharpness', 'supremeoverlord', 'beastboost', 'guts',
  'protosynthesis', 'quarkdrive', 'hustle', 'reckless', 'ironfist'
]);

const defensiveAbilities = new Set([
  'regenerator', 'unaware', 'intimidate', 'naturalcure', 'magicbounce', 'waterabsorb',
  'flashfire', 'levitate', 'thickfat', 'goodasgold', 'poisonheal', 'sturdy', 'filter',
  'multiscale', 'prankster', 'stamina', 'wellbakedbody'
]);

function normalizeId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function biasFor(value: string, offensive: Set<string>, defensive: Set<string>, archetype: Archetype): number {
  const id = normalizeId(value);
  if (!id) return 0;
  if (offensive.has(id)) return offensiveness[archetype];
  if (defensive.has(id)) return -offensiveness[archetype];
  return 0;
}

export function itemBias(item: string, archetype: Archetype): number {
  return biasFor(item, offensiveItems, defensiveItems, archetype);
}

export function abilityBias(ability: string, archetype: Archetype): number {
  return biasFor(ability, offensiveAbilities, defensiveAbilities, archetype);
}

/** Grades an EV spread by whether it invests where the archetype wants it. */
export function spreadBias(evs: number[], archetype: Archetype): number {
  const total = evs.reduce((sum, value) => sum + value, 0);
  if (total <= 0 || evs.length !== 6) return 0;

  const [hp, atk, def, spa, spd, spe] = evs;
  const offensive = (atk + spa + spe) / total;
  const defensive = (hp + def + spd) / total;

  return offensiveness[archetype] * (offensive - defensive);
}

export function archetypeOffensiveness(archetype: Archetype): number {
  return offensiveness[archetype];
}
