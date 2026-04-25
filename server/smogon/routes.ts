import type {Router} from 'express';
import express from 'express';
import {normalizeChaos} from '../../src/domain/normalize';
import {readThroughCache} from './cache';
import {discoverStatsIndex, fetchText} from './index';

interface SmogonRouterDependencies {
  cache: typeof readThroughCache;
  discover: typeof discoverStatsIndex;
  fetchText: typeof fetchText;
}

const defaultDependencies: SmogonRouterDependencies = {
  cache: readThroughCache,
  discover: discoverStatsIndex,
  fetchText
};

export function createSmogonRouter(dependencies: SmogonRouterDependencies = defaultDependencies): Router {
  const router = express.Router();

  router.get('/stats/index', async (_request, response) => {
    try {
      response.json(await dependencies.discover());
    } catch (error) {
      response.status(502).json({
        message: error instanceof Error ? error.message : 'Unable to discover Smogon stats'
      });
    }
  });

  router.get('/stats/:month/:format/:cutoff', async (request, response) => {
    const {month, format, cutoff} = request.params;
    const cutoffNumber = Number(cutoff);
    const url = `https://www.smogon.com/stats/${month}/chaos/${format}-${cutoffNumber}.json`;

    if (!/^\d{4}-\d{2}$/.test(month) || !/^[a-z0-9]+$/.test(format) || !Number.isFinite(cutoffNumber)) {
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

  return router;
}
