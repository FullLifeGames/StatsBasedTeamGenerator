import type {Router} from 'express';
import express from 'express';
import {normalizeChaos} from '../../src/domain/normalize';
import {readThroughCache} from './cache';
import {discoverMonthFormats, discoverStatsIndex, fetchText} from './index';

interface SmogonRouterDependencies {
  cache: typeof readThroughCache;
  discover: typeof discoverStatsIndex;
  discoverMonthFormats: typeof discoverMonthFormats;
  fetchText: typeof fetchText;
}

const defaultDependencies: SmogonRouterDependencies = {
  cache: readThroughCache,
  discover: discoverStatsIndex,
  discoverMonthFormats,
  fetchText
};

export function isValidStatsRequest(month: string, format: string, cutoff: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(month) || !/^[a-z0-9]+$/.test(format) || !/^\d+$/.test(cutoff)) return false;
  const cutoffNumber = Number(cutoff);
  return Number.isSafeInteger(cutoffNumber) && cutoffNumber >= 0;
}

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

  return router;
}
