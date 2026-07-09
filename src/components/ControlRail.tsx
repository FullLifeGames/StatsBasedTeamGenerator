import {LoaderCircle, Moon, Sun, WandSparkles} from 'lucide-react';
import {archetypeListings} from '../domain/archetype';
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
  | 'generating'
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

const archetypeOrder: Array<GeneratorState['archetype']> = [
  'balanced',
  'hyper-offense',
  'offense',
  'bulky-offense',
  'stall',
  'weather',
  'trick-room'
];

const archetypes = archetypeOrder.map(value => archetypeListings.find(listing => listing.value === value)!);

export function ControlRail({
  index,
  month,
  format,
  cutoff,
  archetype,
  loading,
  generating,
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
  const generateLabel = generating ? 'Generating team' : 'Generate team';
  const selectedArchetype = archetypes.find(option => option.value === archetype) ?? archetypes[0];

  return (
    <aside className="control-rail" aria-busy={loading || undefined} aria-label="Generator controls">
      <div className="control-rail__header">
        <p className="eyebrow">Smogon stats</p>
        <h1>Team Generator</h1>
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
        <small className="field__hint">{selectedArchetype.description}</small>
      </label>

      <button
        className="generate-button"
        type="button"
        onClick={() => void generate()}
        disabled={!canGenerate}
        aria-busy={generating || undefined}
      >
        {generating ? (
          <LoaderCircle className="generate-button__spinner" aria-hidden="true" size={18} />
        ) : (
          <WandSparkles aria-hidden="true" size={18} />
        )}
        {generateLabel}
      </button>
      {generating ? <span className="sr-only" role="status">{generateLabel}</span> : null}
    </aside>
  );
}
