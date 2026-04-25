import {Lock, RefreshCcw} from 'lucide-react';
import type {RoleScores, TeamMember} from '../domain/types';
import {PokemonSprite} from './Sprite';

interface PokemonCardProps {
  member: TeamMember;
}

const roleLabels: Record<keyof RoleScores, string> = {
  physicalBreaker: 'Physical',
  specialBreaker: 'Special',
  cleaner: 'Cleaner',
  defensivePivot: 'Def pivot',
  offensivePivot: 'Off pivot',
  support: 'Support',
  status: 'Status',
  setup: 'Setup',
  weatherTerrainSetter: 'Weather',
  weatherTerrainAbuser: 'Abuser',
  hazardSetter: 'Hazards',
  hazardRemoval: 'Removal',
  hazardPreservation: 'Blocker',
  itemDisruption: 'Item ctrl',
  speedControl: 'Speed',
  positioning: 'Position',
  spreadPressure: 'Spread',
  boardControl: 'Board'
};

function topRoles(roles: RoleScores): string[] {
  return (Object.entries(roles) as Array<[keyof RoleScores, number]>)
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([role]) => roleLabels[role]);
}

export function PokemonCard({member}: PokemonCardProps) {
  const roles = topRoles(member.set.roles);

  return (
    <article className="pokemon-card">
      <div className="pokemon-card__topline">
        <PokemonSprite name={member.stats.name} />
        <div className="pokemon-card__identity">
          <h3>{member.stats.name}</h3>
          <p>{member.set.item || 'No item'}</p>
          <p>{member.set.ability || 'No ability'}</p>
        </div>
        <div className="pokemon-card__actions" aria-label={`${member.stats.name} controls`}>
          <button type="button" aria-label={`Lock ${member.stats.name}`}>
            <Lock size={16} aria-hidden="true" />
          </button>
          <button type="button" aria-label={`Replace ${member.stats.name}`}>
            <RefreshCcw size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="role-chip-list" aria-label={`${member.stats.name} roles`}>
        {roles.length ? roles.map(role => (
          <span className="role-chip" key={role}>{role}</span>
        )) : (
          <span className="role-chip role-chip--muted">Flexible</span>
        )}
      </div>

      <ul className="move-list">
        {member.set.moves.map(move => (
          <li key={move}>{move}</li>
        ))}
      </ul>
    </article>
  );
}
