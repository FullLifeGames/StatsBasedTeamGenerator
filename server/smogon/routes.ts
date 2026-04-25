import type {Router} from 'express';
import express from 'express';
import {discoverStatsIndex} from './index';

export function createSmogonRouter(): Router {
  const router = express.Router();

  router.get('/stats/index', async (_request, response) => {
    try {
      response.json(await discoverStatsIndex());
    } catch (error) {
      response.status(502).json({
        message: error instanceof Error ? error.message : 'Unable to discover Smogon stats'
      });
    }
  });

  return router;
}
