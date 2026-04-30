import type {Router} from 'express';
import express from 'express';
import {normalizeChaos} from '../../src/domain/normalize';
import {readThroughCache} from './cache';
import {discoverMonthFormats, discoverStatsIndex, fetchText} from './index';
import {fetchAnalysisSetTemplates} from './sets';
import {validateShowdownImport} from './validation';

interface SmogonRouterDependencies {
  cache: typeof readThroughCache;
  discover: typeof discoverStatsIndex;
  discoverMonthFormats: typeof discoverMonthFormats;
  fetchText: typeof fetchText;
  fetchAnalysisSetTemplates: typeof fetchAnalysisSetTemplates;
  validateShowdownImport: typeof validateShowdownImport;
}

const defaultDependencies: SmogonRouterDependencies = {
  cache: readThroughCache,
  discover: discoverStatsIndex,
  discoverMonthFormats,
  fetchText,
  fetchAnalysisSetTemplates,
  validateShowdownImport
};

export function isValidStatsRequest(month: string, format: string, cutoff: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(month) || !/^[a-z0-9]+$/.test(format) || !/^\d+$/.test(cutoff)) return false;
  const cutoffNumber = Number(cutoff);
  return Number.isSafeInteger(cutoffNumber) && cutoffNumber >= 0;
}

export function isValidSetRequest(format: string, pokemon: unknown): pokemon is string[] {
  return /^[a-z0-9]+$/.test(format)
    && Array.isArray(pokemon)
    && pokemon.length <= 80
    && pokemon.every(name => typeof name === 'string' && name.length > 0 && name.length <= 80);
}

export function isValidValidationRequest(format: string, importable: unknown): importable is string {
  return /^[a-z0-9]+$/.test(format)
    && typeof importable === 'string'
    && importable.length > 0
    && importable.length <= 30_000;
}

export function createSmogonRouter(dependencies: SmogonRouterDependencies = defaultDependencies): Router {
  const router = express.Router();

  router.use(express.json({limit: '128kb'}));

  router.get('/stats/index', async (_request, response) => {
    try {
      response.json(await dependencies.discover());
    } catch (error) {
      response.status(502).json({
        message: error instanceof Error ? error.message : 'Unable to discover Smogon stats'
      });
    }
  });

  router.get('/stats/index/:month', async (request, response) => {
    const {month} = request.params;
    if (!/^\d{4}-\d{2}$/.test(month)) {
      response.status(400).json({message: 'Invalid Smogon stats month'});
      return;
    }

    try {
      response.json(await dependencies.discoverMonthFormats(month));
    } catch (error) {
      response.status(502).json({
        message: error instanceof Error ? error.message : 'Unable to discover Smogon month formats'
      });
    }
  });

  router.get('/stats/:month/:format/:cutoff', async (request, response) => {
    const {month, format, cutoff} = request.params;
    const cutoffNumber = Number(cutoff);
    const url = `https://www.smogon.com/stats/${month}/chaos/${format}-${cutoffNumber}.json`;

    if (!isValidStatsRequest(month, format, cutoff)) {
      response.status(400).json({message: 'Invalid Smogon stats request'});
      return;
    }

    try {
      const rawText = await dependencies.cache(`chaos:${month}:${format}:${cutoffNumber}`, 24 * 60 * 60_000, () =>
        dependencies.fetchText(url)
      );
      response.json(normalizeChaos(JSON.parse(rawText), {month, format, cutoff: cutoffNumber, url}));
    } catch (error) {
      response.status(502).json({
        message: error instanceof Error ? error.message : 'Unable to fetch Smogon chaos data'
      });
    }
  });

  router.post('/sets/:format', async (request, response) => {
    const {format} = request.params;
    const pokemon = (request.body as {pokemon?: unknown}).pokemon;

    if (!isValidSetRequest(format, pokemon)) {
      response.status(400).json({message: 'Invalid Smogon set request'});
      return;
    }

    try {
      response.json(await dependencies.fetchAnalysisSetTemplates(format, pokemon));
    } catch (error) {
      response.status(502).json({
        message: error instanceof Error ? error.message : 'Unable to fetch Smogon set data'
      });
    }
  });

  router.post('/validate/:format', (request, response) => {
    const {format} = request.params;
    const importable = (request.body as {importable?: unknown}).importable;

    if (!isValidValidationRequest(format, importable)) {
      response.status(400).json({message: 'Invalid Showdown validation request'});
      return;
    }

    response.json(dependencies.validateShowdownImport(format, importable));
  });

  return router;
}
