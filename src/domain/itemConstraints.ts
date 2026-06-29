import {Dex} from '@pkmn/dex';
import {toId} from './id';
import type {FormatProfile, TeamMember} from './types';

export interface MegaStoneMember {
  pokemonName: string;
  itemName: string;
}

function selectedItemId(member: TeamMember): string {
  return toId(member.set.itemId ?? member.set.item);
}

export function isMegaStone(profile: FormatProfile, itemId: string): boolean {
  const item = Dex.forGen(profile.gen).items.get(itemId);
  return item.exists && Boolean(item.megaStone);
}

export function megaStoneMembers(members: TeamMember[], profile: FormatProfile): MegaStoneMember[] {
  return members.flatMap(member => {
    const itemId = selectedItemId(member);
    if (!itemId || !isMegaStone(profile, itemId)) return [];

    return [{
      pokemonName: member.stats.name,
      itemName: member.set.item || Dex.forGen(profile.gen).items.get(itemId).name
    }];
  });
}

export function megaStonePenalty(members: TeamMember[], profile: FormatProfile): number {
  const extraMegaStoneCount = Math.max(0, megaStoneMembers(members, profile).length - 1);
  if (extraMegaStoneCount === 0) return 0;

  const thirdAndLaterMegaStoneCount = Math.max(0, extraMegaStoneCount - 1);
  return 3 + thirdAndLaterMegaStoneCount * 8;
}

export function multipleMegaStoneWarnings(members: TeamMember[], profile: FormatProfile): string[] {
  const megaMembers = megaStoneMembers(members, profile);
  if (megaMembers.length <= 1) return [];

  const holders = megaMembers
    .map(member => `${member.pokemonName} (${member.itemName})`)
    .join(', ');

  return [`Multiple Mega Stones: ${holders}`];
}
