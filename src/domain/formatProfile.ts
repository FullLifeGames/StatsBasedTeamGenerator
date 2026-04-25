import type {FormatProfile, RoleScores, RoleWeights} from './types';

const zeroRoles: RoleScores = {
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
};

export const emptyRoles = zeroRoles;

const singlesWeights: RoleWeights = {
  ...zeroRoles,
  physicalBreaker: 1,
  specialBreaker: 1,
  cleaner: 0.9,
  defensivePivot: 0.9,
  offensivePivot: 0.75,
  support: 0.65,
  status: 0.55,
  setup: 0.75,
  weatherTerrainSetter: 0.45,
  weatherTerrainAbuser: 0.45,
  hazardSetter: 1.35,
  hazardRemoval: 1.2,
  hazardPreservation: 0.8,
  itemDisruption: 0.7,
  speedControl: 0.35,
  positioning: 0.25,
  spreadPressure: 0.2,
  boardControl: 0.3,
  duplicateHazardPenalty: 1.4,
  duplicateRemovalPenalty: 1.0,
  duplicateSpeedControlPenalty: 0.2
};

const doublesWeights: RoleWeights = {
  ...zeroRoles,
  physicalBreaker: 0.9,
  specialBreaker: 0.9,
  cleaner: 0.7,
  defensivePivot: 0.55,
  offensivePivot: 0.7,
  support: 0.8,
  status: 0.6,
  setup: 0.45,
  weatherTerrainSetter: 0.8,
  weatherTerrainAbuser: 0.7,
  hazardSetter: 0.15,
  hazardRemoval: 0.05,
  hazardPreservation: 0.05,
  itemDisruption: 0.35,
  speedControl: 1.5,
  positioning: 1.25,
  spreadPressure: 0.9,
  boardControl: 1.0,
  duplicateHazardPenalty: 0.1,
  duplicateRemovalPenalty: 0.05,
  duplicateSpeedControlPenalty: 0.25
};

export function inferFormatProfile(formatId: string): FormatProfile {
  const doubles = /doubles|vgc|2v2|4v4/.test(formatId);
  const gen = Number(formatId.match(/^gen(\d+)/)?.[1] ?? 9);
  return {
    id: formatId,
    gen,
    battleStyle: doubles ? 'doubles' : 'singles',
    teamSize: formatId.includes('1v1') ? 3 : 6,
    roleWeights: doubles ? doublesWeights : singlesWeights,
    warnings: formatId.includes('hackmons') || formatId.includes('metronome')
      ? ['Format has unusual rules; role inference may be noisy.']
      : []
  };
}
