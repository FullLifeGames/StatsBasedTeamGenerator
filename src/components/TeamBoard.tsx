import type {GeneratedTeam} from '../domain/types';
import {PokemonCard} from './PokemonCard';

interface TeamBoardProps {
  team: GeneratedTeam | null;
}

export function TeamBoard({team}: TeamBoardProps) {
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

  return (
    <section className="team-board" aria-label="Generated team">
      <div className="team-board__header">
        <h2>Generated team</h2>
        <p>
          {team.source.format} at {team.source.cutoff}
        </p>
      </div>

      <div className="team-grid">
        {team.members.map(member => (
          <PokemonCard key={member.stats.id} member={member} />
        ))}
      </div>
    </section>
  );
}
