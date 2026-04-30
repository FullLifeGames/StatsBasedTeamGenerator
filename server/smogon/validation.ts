import {Dex, TeamValidator, Teams, type PokemonSet} from '@pkmn/sim';
import type {TeamValidation} from '../../src/domain/types';

function withValidatorDefaultLevels(team: PokemonSet[], validator: TeamValidator): PokemonSet[] {
  const defaultLevel = validator.ruleTable.adjustLevel ?? validator.ruleTable.defaultLevel;
  return team.map(set => set.level ? set : {...set, level: defaultLevel});
}

export function validateShowdownImport(format: string, importable: string): TeamValidation {
  try {
    const formatData = Dex.formats.get(format);
    if (!formatData.exists) {
      return {
        status: 'unavailable',
        formatName: format,
        problems: [`${format} is not bundled with @pkmn/sim's validator data.`]
      };
    }

    const imported = Teams.import(importable);
    if (!imported?.length) {
      return {
        status: 'invalid',
        formatName: formatData.name,
        problems: ['The Showdown import could not be parsed.']
      };
    }

    const validator = new TeamValidator(formatData);
    const team = withValidatorDefaultLevels(imported, validator);
    const problems = validator.validateTeam(team) ?? [];

    return {
      status: problems.length ? 'invalid' : 'valid',
      formatName: formatData.name,
      problems
    };
  } catch (error) {
    return {
      status: 'unavailable',
      formatName: format,
      problems: [error instanceof Error ? error.message : 'Showdown validation failed.']
    };
  }
}
