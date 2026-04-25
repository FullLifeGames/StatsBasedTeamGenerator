import {useCallback, useEffect, useMemo, useState} from 'react';
import {generateTeam} from '../domain/generator';
import type {FormatListing, GenerateOptions, GeneratedTeam, StatsDataset, StatsIndex} from '../domain/types';
import {fetchStatsDataset, fetchStatsIndex} from './api';

type Archetype = GenerateOptions['archetype'];

interface Selection {
  month: string;
  format: string;
  cutoff: number;
}

function highestCutoff(cutoffs: number[]): number {
  return Math.max(...cutoffs);
}

function formatsForMonth(index: StatsIndex | null, month: string): FormatListing[] {
  return index?.formats.filter(listing => listing.month === month) ?? [];
}

function findListing(index: StatsIndex | null, month: string, format: string): FormatListing | undefined {
  return formatsForMonth(index, month).find(listing => listing.id === format);
}

function initialSelection(index: StatsIndex): Selection {
  const month = index.latestMonth || index.months.at(-1) || '';
  const [listing] = formatsForMonth(index, month);

  return {
    month,
    format: listing?.id ?? '',
    cutoff: listing ? highestCutoff(listing.cutoffs) : 0
  };
}

function validSelection(index: StatsIndex | null, selection: Selection): Selection {
  if (!index) return selection;

  const listings = formatsForMonth(index, selection.month);
  const listing = listings.find(candidate => candidate.id === selection.format) ?? listings[0];
  if (!listing) return {...selection, format: '', cutoff: 0};

  return {
    ...selection,
    format: listing.id,
    cutoff: listing.cutoffs.includes(selection.cutoff) ? selection.cutoff : highestCutoff(listing.cutoffs)
  };
}

export function useGenerator() {
  const [index, setIndex] = useState<StatsIndex | null>(null);
  const [dataset, setDataset] = useState<StatsDataset | null>(null);
  const [team, setTeam] = useState<GeneratedTeam | null>(null);
  const [selection, setSelection] = useState<Selection>({month: '', format: '', cutoff: 0});
  const [seeds, setSeeds] = useState<string[]>([]);
  const [archetype, setArchetype] = useState<Archetype>('balanced');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadIndex(): Promise<void> {
      setLoading(true);
      setError(null);

      try {
        const loadedIndex = await fetchStatsIndex();
        if (cancelled) return;
        setIndex(loadedIndex);
        setSelection(initialSelection(loadedIndex));
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : 'Unable to load stats index');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadIndex();

    return () => {
      cancelled = true;
    };
  }, []);

  const setMonth = useCallback((month: string) => {
    setSelection(current => validSelection(index, {...current, month}));
  }, [index]);

  const setFormat = useCallback((format: string) => {
    setSelection(current => {
      const listing = findListing(index, current.month, format);
      const nextCutoff = listing
        ? listing.cutoffs.includes(current.cutoff) ? current.cutoff : highestCutoff(listing.cutoffs)
        : current.cutoff;

      return validSelection(index, {...current, format, cutoff: nextCutoff});
    });
  }, [index]);

  const setCutoff = useCallback((cutoff: number) => {
    setSelection(current => validSelection(index, {...current, cutoff}));
  }, [index]);

  const generate = useCallback(async () => {
    if (!selection.month || !selection.format || !selection.cutoff) return null;

    setLoading(true);
    setError(null);

    try {
      const loadedDataset = await fetchStatsDataset(selection.month, selection.format, selection.cutoff);
      const generatedTeam = generateTeam(loadedDataset, selection.format, {
        seeds,
        archetype,
        novelty: 0
      });

      setDataset(loadedDataset);
      setTeam(generatedTeam);
      return generatedTeam;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to generate a team');
      return null;
    } finally {
      setLoading(false);
    }
  }, [archetype, seeds, selection.cutoff, selection.format, selection.month]);

  const availableFormats = useMemo(() => formatsForMonth(index, selection.month), [index, selection.month]);
  const availableCutoffs = useMemo(
    () => findListing(index, selection.month, selection.format)?.cutoffs ?? [],
    [index, selection.format, selection.month]
  );

  return {
    index,
    dataset,
    team,
    month: selection.month,
    format: selection.format,
    cutoff: selection.cutoff,
    seeds,
    archetype,
    error,
    loading,
    availableFormats,
    availableCutoffs,
    setMonth,
    setFormat,
    setCutoff,
    setSeeds,
    setArchetype,
    generate
  };
}
