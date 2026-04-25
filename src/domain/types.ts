export type BattleStyle = 'singles' | 'doubles';

export type WeightedTable = Record<string, number>;

export interface StatsIndex {
  months: string[];
  latestMonth: string;
  formats: FormatListing[];
}

export interface FormatListing {
  id: string;
  name: string;
  month: string;
  cutoffs: number[];
}

export interface SourceMeta {
  month: string;
  format: string;
  cutoff: number;
  url: string;
  battles?: number;
}

export interface RawCounterEntry {
  n: number;
  p: number;
  d: number;
}

export interface CounterEdge {
  target: string;
  samples: number;
  probability: number;
  deviation: number;
}

export interface PokemonStats {
  id: string;
  name: string;
  usage: number;
  rawCount: number;
  viability: number;
  abilities: WeightedTable;
  items: WeightedTable;
  spreads: WeightedTable;
  moves: WeightedTable;
  teraTypes: WeightedTable;
  teammates: WeightedTable;
  checks: CounterEdge[];
}

export interface StatsDataset {
  source: SourceMeta;
  pokemon: PokemonStats[];
  pokemonById: Record<string, PokemonStats>;
  displayNames: Record<string, string>;
}

export interface RoleScores {
  physicalBreaker: number;
  specialBreaker: number;
  cleaner: number;
  defensivePivot: number;
  offensivePivot: number;
  support: number;
  status: number;
  setup: number;
  weatherTerrainSetter: number;
  weatherTerrainAbuser: number;
  hazardSetter: number;
  hazardRemoval: number;
  hazardPreservation: number;
  itemDisruption: number;
  speedControl: number;
  positioning: number;
  spreadPressure: number;
  boardControl: number;
}

export interface RoleWeights extends RoleScores {
  duplicateHazardPenalty: number;
  duplicateRemovalPenalty: number;
  duplicateSpeedControlPenalty: number;
}

export interface FormatProfile {
  id: string;
  gen: number;
  battleStyle: BattleStyle;
  teamSize: number;
  roleWeights: RoleWeights;
  warnings: string[];
}

export interface SetCandidate {
  pokemonId: string;
  pokemonName: string;
  ability: string;
  item: string;
  teraType?: string;
  nature?: string;
  evs?: string;
  moves: string[];
  roles: RoleScores;
  confidence: number;
  sourceWeights: {
    ability: number;
    item: number;
    teraType: number;
    moves: number;
    spread: number;
  };
}

export interface TeamMember {
  stats: PokemonStats;
  set: SetCandidate;
  locked?: boolean;
  explanation: string[];
}

export interface ScoreBreakdown {
  total: number;
  usage: number;
  setConfidence: number;
  synergy: number;
  roles: number;
  threats: number;
  typeBalance: number;
  setToTeamFit: number;
  duplicateRoles: number;
  archetype: number;
  warnings: string[];
}

export interface GeneratedTeam {
  members: TeamMember[];
  score: ScoreBreakdown;
  importable: string;
  threats: ThreatCoverage[];
  synergy: SynergyInsight[];
  source: SourceMeta;
}

export interface ThreatCoverage {
  threatId: string;
  threatName: string;
  usage: number;
  answers: Array<{pokemonId: string; pokemonName: string; confidence: number}>;
  covered: boolean;
}

export interface SynergyInsight {
  a: string;
  b: string;
  score: number;
}

export interface GenerateOptions {
  seeds: string[];
  lockedMembers?: TeamMember[];
  archetype: 'balanced' | 'offense' | 'bulky-offense' | 'stall' | 'weather' | 'trick-room';
  novelty: number;
}
