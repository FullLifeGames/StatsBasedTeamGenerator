import type {GeneratedTeam} from '../domain/types';
import {PokemonCard} from './PokemonCard';

interface TeamBoardProps {
  team: GeneratedTeam | null;
  onToggleLock?: (pokemonId: string) => void;
  onReplace?: (pokemonId: string) => void;
}

export function TeamBoard({team, onToggleLock, onReplace}: TeamBoardProps) {
  if (!team) {
    return (
      <section className="team-board" aria-label="Generated team">
        <div className="team-board__empty">
          <h2>No team generated yet</h2>
          <p>Choose a format and generate a team to fill this board.</p>
        </div>
      </section>
    );
  }

  const coveredThreats = team.threats.filter(threat => threat.covered).length;

  return (
    <section className="team-board" aria-label="Generated team">
      <div className="team-board__header">
        <div>
          <h2>Generated team</h2>
          <p>
            {team.source.format} at {team.source.cutoff}
          </p>
        </div>
        <dl className="team-board__metrics" aria-label="Team summary">
          <div>
            <dt>Score</dt>
            <dd>{team.score.total.toFixed(1)}</dd>
          </div>
          <div>
            <dt>Threats</dt>
            <dd>{coveredThreats}/{team.threats.length}</dd>
          </div>
        </dl>
      </div>

      <div className="team-grid">
        {team.members.map(member => (
          <PokemonCard
            key={member.stats.id}
            member={member}
            onReplace={onReplace}
            onToggleLock={onToggleLock}
          />
        ))}
      </div>
    </section>
  );
}
