import type {GeneratedTeam, ScoreBreakdown} from '../domain/types';

interface InsightPanelProps {
  team: GeneratedTeam | null;
}

const scoreLabels: Array<[keyof Omit<ScoreBreakdown, 'warnings'>, string]> = [
  ['total', 'Total'],
  ['usage', 'Usage'],
  ['setConfidence', 'Sets'],
  ['synergy', 'Synergy'],
  ['roles', 'Roles'],
  ['threats', 'Threats'],
  ['setToTeamFit', 'Fit'],
  ['duplicateRoles', 'Dupes']
];

function formatScore(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export function InsightPanel({team}: InsightPanelProps) {
  if (!team) {
    return (
      <aside className="insight-panel" aria-label="Team insights">
        <h2>Insights</h2>
        <div className="insight-empty">
          <p>Generate a team to see score details, threat coverage, and a Showdown import.</p>
        </div>
      </aside>
    );
  }

  const coveredThreats = team.threats.filter(threat => threat.covered).length;

  return (
    <aside className="insight-panel" aria-label="Team insights">
      <div className="insight-panel__header">
        <h2>Insights</h2>
        <p>{team.source.month}</p>
      </div>

      <section className="insight-section" aria-labelledby="score-heading">
        <h3 id="score-heading">Score breakdown</h3>
        <dl className="score-grid">
          {scoreLabels.map(([key, label]) => (
            <div className="score-row" key={key}>
              <dt>{label}</dt>
              <dd>{formatScore(team.score[key])}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="insight-section" aria-labelledby="threat-heading">
        <h3 id="threat-heading">Threat coverage</h3>
        <p className="insight-kicker">
          {coveredThreats}/{team.threats.length} tracked threats covered
        </p>
        <ul className="threat-list">
          {team.threats.slice(0, 5).map(threat => (
            <li key={threat.threatId}>
              <span>{threat.threatName}</span>
              <strong>{threat.covered ? 'Covered' : 'Open'}</strong>
            </li>
          ))}
        </ul>
      </section>

      {team.score.warnings.length ? (
        <section className="insight-section" aria-labelledby="warning-heading">
          <h3 id="warning-heading">Warnings</h3>
          <ul className="warning-list">
            {team.score.warnings.map(warning => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="insight-section" aria-labelledby="import-heading">
        <h3 id="import-heading">Showdown import</h3>
        <textarea
          aria-labelledby="import-heading"
          className="showdown-import"
          readOnly
          value={team.importable}
        />
      </section>
    </aside>
  );
}
