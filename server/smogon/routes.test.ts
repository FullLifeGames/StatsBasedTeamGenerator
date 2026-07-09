import {describe, expect, it} from 'vitest';
import express from 'express';
import type {AddressInfo} from 'node:net';
import type {Server} from 'node:http';
import {createSmogonRouter, isValidSetRequest, isValidStatsRequest, isValidValidationRequest} from './routes';
import type {TeamValidation} from '../../src/domain/types';

const passthroughCache = async (_key: string, _ttlMs: number, loader: () => Promise<string>) => loader();

async function requestRouter(
  dependencies: Parameters<typeof createSmogonRouter>[0],
  path: string
): Promise<{body: {message?: string}; status: number}> {
  const app = express();
  app.use('/api', createSmogonRouter(dependencies));

  const server = await new Promise<Server>(resolve => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });

  try {
    const address = server.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${address.port}${path}`);
    return {
      body: await response.json() as {message?: string},
      status: response.status
    };
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    });
  }
}

function routerDependencies(overrides: Partial<Parameters<typeof createSmogonRouter>[0]> = {}): Parameters<typeof createSmogonRouter>[0] {
  return {
    cache: passthroughCache,
    discover: async () => ({months: [], latestMonth: '', formats: []}),
    discoverMonthFormats: async () => [],
    fetchText: async () => '{}',
    fetchAnalysisSetTemplates: async () => ({}),
    validateShowdownImport: (): TeamValidation => ({status: 'valid', formatName: 'Test', problems: []}),
    ...overrides
  };
}

describe('Smogon stats route validation', () => {
  it('accepts digit-only non-negative integer cutoffs', () => {
    expect(isValidStatsRequest('2026-03', 'gen9ou', '1825')).toBe(true);
    expect(isValidStatsRequest('2026-03', 'gen9ou', '0')).toBe(true);
  });

  it('rejects non-integer cutoff strings', () => {
    expect(isValidStatsRequest('2026-03', 'gen9ou', '1e3')).toBe(false);
    expect(isValidStatsRequest('2026-03', 'gen9ou', '1825.5')).toBe(false);
    expect(isValidStatsRequest('2026-03', 'gen9ou', '-1')).toBe(false);
  });

  it('returns a stable error when upstream chaos data is not JSON', async () => {
    const {body, status} = await requestRouter(routerDependencies({
      fetchText: async () => '<!doctype html><title>Bad Gateway</title>'
    }), '/api/stats/2026-06/gen9championsvgc2026regmbbo3/1500');

    expect(status).toBe(502);
    expect(body.message).toBe('Smogon returned invalid stats data. Please try again.');
  });
});

describe('Smogon leads route', () => {
  it('parses the leads table into lead usage', async () => {
    const {body, status} = await requestRouter(routerDependencies({
      fetchText: async () => '| 1    | Jynx               | 22.62514% | 6393   | 17.078% |\n'
    }), '/api/stats/leads/2026-06/gen1ou/1760');

    expect(status).toBe(200);
    expect(body).toEqual({jynx: 22.62514});
  });

  it('rejects a malformed leads request', async () => {
    const {body, status} = await requestRouter(routerDependencies(), '/api/stats/leads/2026-6/gen1ou/1760');

    expect(status).toBe(400);
    expect(body.message).toBe('Invalid Smogon leads request');
  });

  it('reports an upstream leads failure', async () => {
    const {status} = await requestRouter(routerDependencies({
      fetchText: async () => {
        throw new Error('Smogon request failed 404');
      }
    }), '/api/stats/leads/2026-06/gen1ou/1760');

    expect(status).toBe(502);
  });
});

describe('Smogon set route validation', () => {
  it('accepts a valid format and bounded Pokemon list', () => {
    expect(isValidSetRequest('gen9ou', ['Garchomp', 'Baxcalibur'])).toBe(true);
  });

  it('rejects invalid format ids and unbounded inputs', () => {
    expect(isValidSetRequest('gen9/ou', ['Garchomp'])).toBe(false);
    expect(isValidSetRequest('gen9ou', 'Garchomp')).toBe(false);
    expect(isValidSetRequest('gen9ou', Array.from({length: 81}, (_, index) => `Pokemon ${index}`))).toBe(false);
  });
});

describe('Showdown validation route validation', () => {
  it('accepts bounded importable text for valid format ids', () => {
    expect(isValidValidationRequest('gen9ou', 'Great Tusk\n- Earthquake')).toBe(true);
  });

  it('rejects invalid format ids and empty or oversized importables', () => {
    expect(isValidValidationRequest('gen9/ou', 'Great Tusk\n- Earthquake')).toBe(false);
    expect(isValidValidationRequest('gen9ou', '')).toBe(false);
    expect(isValidValidationRequest('gen9ou', 'x'.repeat(30_001))).toBe(false);
  });
});
