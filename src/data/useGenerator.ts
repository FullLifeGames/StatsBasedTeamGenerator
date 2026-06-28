import {useCallback, useEffect, useMemo, useState} from 'react';
import {generateTeam} from '../domain/generator';
import {toId} from '../domain/id';
import type {FormatListing, GenerateOptions, GeneratedTeam, StatsDataset, StatsIndex, TeamMember} from '../domain/types';
import {
  fetchAnalysisSetTemplates,
  fetchMonthFormats,
  fetchStatsDataset,
  fetchStatsIndex,
  fetchTeamValidation,
  prefetchStatsDataset
} from './api';

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

function withMonthFormats(index: StatsIndex, month: string, formats: FormatListing[]): StatsIndex {
  return {
    ...index,
    formats: [
      ...index.formats.filter(listing => listing.month !== month),
      ...formats
    ]
  };
}

function initialSelection(index: StatsIndex): Selection {
  const month = index.latestMonth || index.months.at(-1) || '';
  const listings = formatsForMonth(index, month);
  const listing = listings.find(candidate => candidate.id === 'gen9ou') ?? listings[0];

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

function lockedMembersForDataset(
  team: GeneratedTeam | null,
  lockedIds: Set<string>,
  dataset: StatsDataset
): TeamMember[] {
  return (team?.members ?? [])
    .filter(member => lockedIds.has(toId(member.stats.id)) && Boolean(dataset.pokemonById[toId(member.stats.id)]))
    .map(member => ({...member, locked: true}));
}

function withLockedFlags(team: GeneratedTeam, lockedIds: Set<string>): GeneratedTeam {
  return {
    ...team,
    members: team.members.map(member => ({
      ...member,
      locked: lockedIds.has(toId(member.stats.id)) || undefined
    }))
  };
}

async function withAnalysisSets(dataset: StatsDataset, format: string, seeds: string[], lockedMembers: TeamMember[]): Promise<StatsDataset> {
  const names = new Set([
    ...dataset.pokemon.slice(0, 48).map(stats => stats.name),
    ...seeds,
    ...lockedMembers.map(member => member.stats.name)
  ].filter(Boolean));

  if (!names.size) return dataset;

  try {
    const templates = await fetchAnalysisSetTemplates(format, [...names]);
    return {
      ...dataset,
      pokemon: dataset.pokemon.map(stats => ({
        ...stats,
        analysisSets: templates[toId(stats.name)] ?? templates[toId(stats.id)] ?? stats.analysisSets
      })),
      pokemonById: Object.fromEntries(dataset.pokemon.map(stats => {
        const next = {
          ...stats,
          analysisSets: templates[toId(stats.name)] ?? templates[toId(stats.id)] ?? stats.analysisSets
        };
        return [stats.id, next];
      }))
    };
  } catch {
    return dataset;
  }
}

async function withShowdownValidation(team: GeneratedTeam, format: string): Promise<GeneratedTeam> {
  try {
    return {
      ...team,
      validation: await fetchTeamValidation(format, team.importable)
    };
  } catch {
    return {
      ...team,
      validation: {
        status: 'unavailable',
        formatName: format,
        problems: ['Showdown validation is temporarily unavailable.']
      }
    };
  }
}

export function useGenerator() {
  const [index, setIndex] = useState<StatsIndex | null>(null);
  const [dataset, setDataset] = useState<StatsDataset | null>(null);
  const [team, setTeam] = useState<GeneratedTeam | null>(null);
  const [selection, setSelection] = useState<Selection>({month: '', format: '', cutoff: 0});
  const [seeds, setSeeds] = useState<string[]>([]);
  const [lockedIds, setLockedIds] = useState<Set<string>>(() => new Set());
  const [archetype, setArchetype] = useState<Archetype>('balanced');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const hasCompleteSelection = Boolean(selection.month && selection.format && Number.isFinite(selection.cutoff));

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

  useEffect(() => {
    if (!hasCompleteSelection) return;
    prefetchStatsDataset(selection.month, selection.format, selection.cutoff);
  }, [hasCompleteSelection, selection.cutoff, selection.format, selection.month]);

  const clearGeneratedState = useCallback(() => {
    setDataset(null);
    setTeam(null);
    setLockedIds(new Set());
  }, []);

  const setMonth = useCallback((month: string) => {
    clearGeneratedState();
    const hasLoadedFormats = Boolean(index && formatsForMonth(index, month).length);
    setSelection(current => {
      const next = {...current, month};
      return hasLoadedFormats ? validSelection(index, next) : next;
    });

    if (!index || hasLoadedFormats) return;

    setLoading(true);
    setError(null);
    void fetchMonthFormats(month)
      .then(formats => {
        setIndex(current => {
          if (!current) return current;
          const nextIndex = withMonthFormats(current, month, formats);
          setSelection(selectionCurrent => validSelection(nextIndex, selectionCurrent));
          return nextIndex;
        });
      })
      .catch(caught => {
        setError(caught instanceof Error ? caught.message : 'Unable to load month formats');
        setSelection(current => current.month === month ? {...current, format: '', cutoff: 0} : current);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [clearGeneratedState, index]);

  const setFormat = useCallback((format: string) => {
    clearGeneratedState();
    setSelection(current => {
      const listing = findListing(index, current.month, format);
      const nextCutoff = listing
        ? listing.cutoffs.includes(current.cutoff) ? current.cutoff : highestCutoff(listing.cutoffs)
        : current.cutoff;

      return validSelection(index, {...current, format, cutoff: nextCutoff});
    });
  }, [clearGeneratedState, index]);

  const setCutoff = useCallback((cutoff: number) => {
    clearGeneratedState();
    setSelection(current => validSelection(index, {...current, cutoff}));
  }, [clearGeneratedState, index]);

  const toggleLock = useCallback((pokemonId: string | undefined) => {
    if (!pokemonId) return;
    const normalizedId = toId(pokemonId);

    setLockedIds(current => {
      const next = new Set(current);
      if (next.has(normalizedId)) {
        next.delete(normalizedId);
      } else {
        next.add(normalizedId);
      }
      return next;
    });

    setTeam(current => current ? ({
      ...current,
      members: current.members.map(member => {
        if (toId(member.stats.id) !== normalizedId) return member;
        return {...member, locked: !member.locked};
      })
    }) : current);
  }, []);

  const generate = useCallback(async () => {
    if (!hasCompleteSelection) return null;

    setLoading(true);
    setError(null);

    try {
      const loadedDataset = await fetchStatsDataset(selection.month, selection.format, selection.cutoff);
      const validLockedIds = new Set(
        [...lockedIds].filter(id => Boolean(loadedDataset.pokemonById[id]))
      );
      const lockedMembers = lockedMembersForDataset(team, validLockedIds, loadedDataset);
      const enrichedDataset = await withAnalysisSets(loadedDataset, selection.format, seeds, lockedMembers);
      const generatedTeam = generateTeam(enrichedDataset, selection.format, {
        seeds,
        lockedMembers,
        archetype,
        novelty: 0.3,
        randomSeed: Math.floor(Math.random() * 1_000_000)
      });
      const teamWithLockedFlags = await withShowdownValidation(withLockedFlags(generatedTeam, validLockedIds), selection.format);

      setDataset(enrichedDataset);
      setLockedIds(validLockedIds);
      setTeam(teamWithLockedFlags);
      return teamWithLockedFlags;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to generate a team');
      return null;
    } finally {
      setLoading(false);
    }
  }, [archetype, hasCompleteSelection, lockedIds, seeds, selection.cutoff, selection.format, selection.month, team]);

  const replaceMember = useCallback(async (pokemonId: string | undefined) => {
    if (!pokemonId || !team || !hasCompleteSelection) return null;
    const normalizedId = toId(pokemonId);

    setLoading(true);
    setError(null);

    try {
      const loadedDataset = await fetchStatsDataset(selection.month, selection.format, selection.cutoff);
      const validLockedIds = new Set(
        [...lockedIds].filter(id => id !== normalizedId && Boolean(loadedDataset.pokemonById[id]))
      );
      const preservedMembers = team.members
        .filter(member => toId(member.stats.id) !== normalizedId)
        .filter(member => Boolean(loadedDataset.pokemonById[toId(member.stats.id)]))
        .map(member => ({...member, locked: true}));
      const enrichedDataset = await withAnalysisSets(loadedDataset, selection.format, seeds, preservedMembers);
      const generatedTeam = generateTeam(enrichedDataset, selection.format, {
        seeds,
        lockedMembers: preservedMembers,
        bannedMembers: [normalizedId],
        archetype,
        novelty: 0.3,
        randomSeed: Math.floor(Math.random() * 1_000_000)
      });
      const teamWithLockedFlags = await withShowdownValidation(withLockedFlags(generatedTeam, validLockedIds), selection.format);

      setDataset(enrichedDataset);
      setLockedIds(validLockedIds);
      setTeam(teamWithLockedFlags);
      return teamWithLockedFlags;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to replace a team member');
      return null;
    } finally {
      setLoading(false);
    }
  }, [archetype, hasCompleteSelection, lockedIds, seeds, selection.cutoff, selection.format, selection.month, team]);

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
    toggleLock,
    replaceMember,
    generate
  };
}
