import {detectRolesForMoves} from './roles';
import type {FormatProfile, PokemonStats, RoleScores, SetCandidate, WeightedTable} from './types';

interface TeamContext {
  existingRoles?: Partial<RoleScores>;
}

interface ContextMember {
  roles: RoleScores;
  [key: string]: unknown;
}

const displayNames: Record<string, string> = {
  boosterenergy: 'Booster Energy',
  rockyhelmet: 'Rocky Helmet',
  heavydutyboots: 'Heavy-Duty Boots',
  leftovers: 'Leftovers',
  protosynthesis: 'Protosynthesis',
  rapidspin: 'Rapid Spin',
  headlongrush: 'Headlong Rush',
  stealthrock: 'Stealth Rock',
  knockoff: 'Knock Off',
  icespinner: 'Ice Spinner',
  closecombat: 'Close Combat',
  spikes: 'Spikes',
  toxicspikes: 'Toxic Spikes',
  stickyweb: 'Sticky Web',
  defog: 'Defog',
  mortalspin: 'Mortal Spin',
  tailwind: 'Tailwind',
  trickroom: 'Trick Room',
  icywind: 'Icy Wind',
  electroweb: 'Electroweb',
  thunderwave: 'Thunder Wave',
  protect: 'Protect',
  fakeout: 'Fake Out',
  followme: 'Follow Me',
  ragepowder: 'Rage Powder',
  helpinghand: 'Helping Hand',
  uturn: 'U-turn',
  voltswitch: 'Volt Switch',
  partingshot: 'Parting Shot',
  earthquake: 'Earthquake',
  rockslide: 'Rock Slide',
  heatwave: 'Heat Wave',
  dazzlinggleam: 'Dazzling Gleam',
  muddywater: 'Muddy Water',
  makeitrain: 'Make It Rain',
  bleakwindstorm: 'Bleakwind Storm',
  discharge: 'Discharge',
  steel: 'Steel'
};

const evLabels = ['HP', 'Atk', 'Def', 'SpA', 'SpD', 'Spe'];

function topEntries(table: WeightedTable, limit = 1): Array<[string, number]> {
  return Object.entries(table)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit);
}

function display(id: string): string {
  return displayNames[id] ?? id
    .replace(/([a-z])([0-9])/g, '$1 $2')
    .replace(/(^|\s)\w/g, letter => letter.toUpperCase());
}

function parseSpread(spread?: string): {nature?: string; evs?: string} {
  if (!spread) return {};
  const [nature, evText] = spread.split(':');
  const evs = evText?.split('/');
  if (!nature || evs?.length !== evLabels.length) return {};

  return {
    nature,
    evs: evs.map((value, index) => `${value} ${evLabels[index]}`).join(' / ')
  };
}

function existingRoleScore(context: TeamContext | undefined, role: keyof RoleScores): number {
  return context?.existingRoles?.[role] ?? 0;
}

function adjustedMoveWeight(stats: PokemonStats, profile: FormatProfile, moveId: string, context?: TeamContext): number {
  const roles = detectRolesForMoves(stats, profile, [moveId]);
  let weight = stats.moves[moveId] ?? 0;

  if (profile.battleStyle === 'singles') {
    if (existingRoleScore(context, 'hazardSetter') > 0 && roles.hazardSetter > 0) {
      weight -= profile.roleWeights.duplicateHazardPenalty * 30;
    }
    if (existingRoleScore(context, 'hazardRemoval') > 0 && roles.hazardRemoval > 0) {
      weight -= profile.roleWeights.duplicateRemovalPenalty * 20;
    }
  }

  if (profile.battleStyle === 'doubles' && existingRoleScore(context, 'speedControl') > 0 && roles.speedControl > 0) {
    weight -= profile.roleWeights.duplicateSpeedControlPenalty * 10;
  }

  return weight;
}

function selectedMoveIds(stats: PokemonStats, profile: FormatProfile, context?: TeamContext): string[] {
  return Object.keys(stats.moves)
    .sort((a, b) => adjustedMoveWeight(stats, profile, b, context) - adjustedMoveWeight(stats, profile, a, context))
    .slice(0, 4);
}

function average(values: number[]): number {
  const scored = values.filter(value => value > 0);
  if (!scored.length) return 0;
  return scored.reduce((sum, value) => sum + value, 0) / scored.length;
}

export function buildSetCandidates(stats: PokemonStats, profile: FormatProfile, context?: TeamContext): SetCandidate[] {
  const [[abilityId, abilityWeight] = ['', 0]] = topEntries(stats.abilities);
  const [[itemId, itemWeight] = ['', 0]] = topEntries(stats.items);
  const [[spreadId, spreadWeight] = ['', 0]] = topEntries(stats.spreads);
  const [[teraTypeId, teraTypeWeight] = ['', 0]] = topEntries(stats.teraTypes);
  const moveIds = selectedMoveIds(stats, profile, context);
  const moveWeight = moveIds.reduce((sum, moveId) => sum + (stats.moves[moveId] ?? 0), 0);
  const spread = parseSpread(spreadId);

  return [{
    pokemonId: stats.id,
    pokemonName: stats.name,
    ability: abilityId ? display(abilityId) : '',
    item: itemId ? display(itemId) : '',
    teraType: teraTypeId ? display(teraTypeId) : undefined,
    nature: spread.nature,
    evs: spread.evs,
    moves: moveIds.map(display),
    roles: detectRolesForMoves(stats, profile, moveIds),
    confidence: average([abilityWeight, itemWeight, spreadWeight, teraTypeWeight, moveWeight / 4]) / 100,
    sourceWeights: {
      ability: abilityWeight,
      item: itemWeight,
      teraType: teraTypeWeight,
      moves: moveWeight,
      spread: spreadWeight
    }
  }];
}

function teamRoleTotal(partialTeam: ContextMember[], role: keyof RoleScores): number {
  return partialTeam.reduce((sum, member) => sum + member.roles[role], 0);
}

export function scoreSetForTeamContext(candidate: SetCandidate, partialTeam: ContextMember[], profile: FormatProfile): number {
  let score = 0;

  if (profile.battleStyle === 'singles') {
    const hazardSetterTotal = teamRoleTotal(partialTeam, 'hazardSetter');
    const hazardRemovalTotal = teamRoleTotal(partialTeam, 'hazardRemoval');

    score += hazardSetterTotal > 0
      ? -candidate.roles.hazardSetter * profile.roleWeights.duplicateHazardPenalty
      : candidate.roles.hazardSetter * profile.roleWeights.hazardSetter;
    score += hazardRemovalTotal > 0
      ? -candidate.roles.hazardRemoval * profile.roleWeights.duplicateRemovalPenalty
      : candidate.roles.hazardRemoval * profile.roleWeights.hazardRemoval;
  }

  if (profile.battleStyle === 'doubles') {
    const speedControlTotal = teamRoleTotal(partialTeam, 'speedControl');
    score += speedControlTotal > 0
      ? candidate.roles.speedControl * (profile.roleWeights.speedControl - profile.roleWeights.duplicateSpeedControlPenalty)
      : candidate.roles.speedControl * profile.roleWeights.speedControl;
    score += candidate.roles.positioning * profile.roleWeights.positioning;
    score += candidate.roles.spreadPressure * profile.roleWeights.spreadPressure;
  }

  return score;
}
