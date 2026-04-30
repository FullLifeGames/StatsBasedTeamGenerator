import {Moon, Sun, WandSparkles} from 'lucide-react';
import type {useGenerator} from '../data/useGenerator';

type GeneratorState = ReturnType<typeof useGenerator>;

type ControlRailProps = Pick<
  GeneratorState,
  | 'index'
  | 'month'
  | 'format'
  | 'cutoff'
  | 'archetype'
  | 'loading'
  | 'availableFormats'
  | 'availableCutoffs'
  | 'setMonth'
  | 'setFormat'
  | 'setCutoff'
  | 'setArchetype'
  | 'generate'
>;

interface ThemeProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

const archetypes: Array<{value: GeneratorState['archetype']; label: string}> = [
  {value: 'balanced', label: 'Balanced'},
  {value: 'offense', label: 'Offense'},
  {value: 'bulky-offense', label: 'Bulky offense'},
  {value: 'stall', label: 'Stall'},
  {value: 'weather', label: 'Weather'},
  {value: 'trick-room', label: 'Trick room'}
];

export function ControlRail({
  index,
  month,
  format,
  cutoff,
  archetype,
  loading,
  availableFormats,
  availableCutoffs,
  setMonth,
  setFormat,
  setCutoff,
  setArchetype,
  generate,
  darkMode,
  onToggleDarkMode
}: ControlRailProps & ThemeProps) {
  const months = index?.months ?? [];
  const canGenerate = Boolean(format) && !loading;

  return (
    <aside className="control-rail" aria-label="Generator controls">
      <div className="control-rail__header">
        <p className="eyebrow">Smogon stats</p>
        <h1>Team generator</h1>
      </div>
      <div className="control-rail__meta" aria-label="Loaded stats options">
        <span>{availableFormats.length} formats</span>
        <span>{availableCutoffs.length} cutoffs</span>
      </div>

      <button
        className="theme-toggle"
        type="button"
        aria-label={darkMode ? 'Light mode' : 'Dark mode'}
        onClick={onToggleDarkMode}
      >
        {darkMode ? <Sun aria-hidden="true" size={17} /> : <Moon aria-hidden="true" size={17} />}
        {darkMode ? 'Light mode' : 'Dark mode'}
      </button>

      <label className="field">
        <span>Month</span>
        <select value={month} onChange={event => setMonth(event.target.value)} disabled={loading || !months.length}>
          {months.map(option => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Format</span>
        <select
          value={format}
          onChange={event => setFormat(event.target.value)}
          disabled={loading || !availableFormats.length}
        >
          {availableFormats.map(option => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Rating cutoff</span>
        <select
          value={Number.isFinite(cutoff) ? String(cutoff) : ''}
          onChange={event => setCutoff(Number(event.target.value))}
          disabled={loading || !availableCutoffs.length}
        >
          {availableCutoffs.map(option => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Archetype</span>
        <select
          value={archetype}
          onChange={event => setArchetype(event.target.value as GeneratorState['archetype'])}
          disabled={loading}
        >
          {archetypes.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <button className="generate-button" type="button" onClick={() => void generate()} disabled={!canGenerate}>
        <WandSparkles aria-hidden="true" size={18} />
        Generate team
      </button>
    </aside>
  );
}
