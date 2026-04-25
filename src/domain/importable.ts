import type {SetCandidate, TeamMember} from './types';

type ImportableMember = SetCandidate | TeamMember;
type ImportableTeam = ImportableMember[] | {members: ImportableMember[]};

function setFrom(member: ImportableMember): SetCandidate {
  return 'set' in member ? member.set : member;
}

export function formatSet(set: SetCandidate): string {
  const lines = [set.item ? `${set.pokemonName} @ ${set.item}` : set.pokemonName];

  if (set.ability) lines.push(`Ability: ${set.ability}`);
  if (set.teraType) lines.push(`Tera Type: ${set.teraType}`);
  if (set.evs) lines.push(`EVs: ${set.evs}`);
  if (set.nature) lines.push(`${set.nature} Nature`);
  lines.push(...set.moves.map(move => `- ${move}`));

  return lines.join('\n');
}

export function formatTeam(team: ImportableTeam): string {
  const members = Array.isArray(team) ? team : team.members;
  return members.map(member => formatSet(setFrom(member))).join('\n\n');
}
