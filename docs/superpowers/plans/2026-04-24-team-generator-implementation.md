# Team Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a multi-format Smogon-stats team-generator web app with format-aware singles/doubles role scoring, team-contextual set construction, sprites, explanations, and Showdown import output.

**Architecture:** Use a Vite React TypeScript client backed by a small Express API/cache for Smogon index and chaos JSON fetching. Keep generation logic in pure TypeScript domain modules so parser, role, set, scoring, and beam-search behavior are testable outside the UI.

**Tech Stack:** Vite, React, TypeScript, Express, Vitest, Testing Library, `@pkmn/dex`, `@pkmn/data`, `@pkmn/img`, `lucide-react`, plain CSS.

---

## Scope Check

This plan implements the approved v1 as one working app. The data API, generator, and UI are tightly coupled by the core workflow: select format/month/cutoff, generate a team, inspect explanation, and export Showdown text. Future saved teams, battle simulator hooks, and richer archetype systems are outside this plan.

## File Structure

- `package.json`: scripts and dependencies.
- `vite.config.ts`: Vite React config, Vitest config, and `/api` proxy to the Express API.
- `tsconfig.json`, `tsconfig.node.json`: TypeScript settings for client and server.
- `index.html`: Vite HTML entry.
- `server/index.ts`: Express API server and static production serving.
- `server/smogon/cache.ts`: disk and memory cache helpers under `.cache/smogon`.
- `server/smogon/index.ts`: Smogon month, format, cutoff discovery.
- `server/smogon/routes.ts`: API route handlers.
- `src/main.tsx`: React mount.
- `src/App.tsx`: top-level app composition and state wiring.
- `src/styles.css`: app-level responsive visual system.
- `src/domain/id.ts`: Pokemon Showdown-style id helpers.
- `src/domain/types.ts`: shared normalized types.
- `src/domain/formatProfile.ts`: singles/doubles profile inference and role weights.
- `src/domain/normalize.ts`: chaos JSON normalization.
- `src/domain/roles.ts`: role detection from moves, items, abilities, typing, and format profile.
- `src/domain/sets.ts`: team-contextual set candidate construction.
- `src/domain/scoring.ts`: usage, synergy, role, threat, duplicate-role, and set-to-team scoring.
- `src/domain/generator.ts`: beam-search team generator.
- `src/domain/importable.ts`: Showdown import formatting.
- `src/data/api.ts`: client API calls.
- `src/data/useGenerator.ts`: React state hook for selectors, locks, regeneration, and history.
- `src/components/ControlRail.tsx`: selectors and generation controls.
- `src/components/TeamBoard.tsx`: six-slot or format-sized team display.
- `src/components/PokemonCard.tsx`: Pokemon set card with sprite and slot controls.
- `src/components/InsightPanel.tsx`: importable text, score breakdown, threats, synergy, and warnings.
- `src/components/Sprite.tsx`: `@pkmn/img` sprite rendering.
- `src/test/fixtures.ts`: small deterministic stats fixtures.
- `src/test/setup.ts`: Testing Library setup.
- `src/**/*.test.ts`, `server/**/*.test.ts`: unit and component tests.

## Execution Notes

- Use `npm install` after creating `package.json`.
- Run focused tests after each implementation task.
- Commit after each task.
- Keep `.cache/`, `.superpowers/`, `dist/`, and `node_modules/` out of git.
- Before UI implementation, use `build-web-apps:frontend-app-builder` for the concept-first visual pass, then implement the accepted concept within this file structure.

---

### Task 1: Project Scaffold And Tooling

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/styles.css`
- Create: `src/test/setup.ts`
- Create: `.gitignore`

- [ ] **Step 1: Create package and config files**

Create `package.json`:

```json
{
  "name": "team-generator-based-on-stats",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "concurrently -k \"npm:dev:api\" \"npm:dev:client\"",
    "dev:client": "vite --host 127.0.0.1",
    "dev:api": "tsx watch server/index.ts",
    "build": "tsc -b && vite build",
    "preview": "vite preview --host 127.0.0.1",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint ."
  },
  "dependencies": {
    "@pkmn/data": "^0.10.7",
    "@pkmn/dex": "^0.10.7",
    "@pkmn/img": "^0.3.3",
    "cors": "^2.8.5",
    "express": "^4.19.2",
    "lucide-react": "^0.468.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.1.0",
    "@testing-library/user-event": "^14.5.2",
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/node": "^22.10.2",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.4",
    "concurrently": "^9.1.0",
    "eslint": "^9.16.0",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2",
    "vite": "^6.0.3",
    "vitest": "^2.1.8"
  }
}
```

Create `tsconfig.json`:

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.node.json" }
  ],
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src", "server", "vite.config.ts"]
}
```

Create `tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "composite": true,
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "types": ["node", "vitest/globals"]
  },
  "include": ["vite.config.ts", "server", "src"]
}
```

Create `vite.config.ts`:

```ts
import react from '@vitejs/plugin-react';
import {defineConfig} from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8787'
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts'
  }
});
```

Create `.gitignore`:

```gitignore
node_modules/
dist/
.cache/
.superpowers/
coverage/
*.local
```

- [ ] **Step 2: Create a minimal app shell**

Create `index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Smogon Team Generator</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Create `src/main.tsx`:

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import {App} from './App';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

Create `src/App.tsx`:

```tsx
export function App() {
  return (
    <main className="app-shell">
      <section className="empty-state">
        <p className="eyebrow">Smogon stats</p>
        <h1>Team generator</h1>
        <p>Scaffold ready. Data, scoring, and team generation land in the next tasks.</p>
      </section>
    </main>
  );
}
```

Create `src/styles.css`:

```css
:root {
  color: #111827;
  background: #f4f6f8;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
}

button,
input,
select,
textarea {
  font: inherit;
}

.app-shell {
  min-height: 100vh;
  padding: 24px;
}

.empty-state {
  max-width: 720px;
  margin: 12vh auto 0;
  padding: 24px;
  border: 1px solid #d9dee7;
  border-radius: 8px;
  background: #ffffff;
}

.eyebrow {
  margin: 0 0 8px;
  color: #4f46e5;
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
}
```

Create `src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 3: Install dependencies**

Run: `npm install`

Expected: dependencies install and `package-lock.json` is created.

- [ ] **Step 4: Verify scaffold**

Run: `npm test`

Expected: `No test files found` or a zero-test Vitest success message.

Run: `npm run build`

Expected: TypeScript and Vite build complete without errors.

- [ ] **Step 5: Commit**

```bash
git add .gitignore index.html package.json package-lock.json tsconfig.json tsconfig.node.json vite.config.ts src
git commit -m "chore: scaffold team generator app"
```

---

### Task 2: Domain Types And Test Fixtures

**Files:**
- Create: `src/domain/id.ts`
- Create: `src/domain/types.ts`
- Create: `src/test/fixtures.ts`
- Test: `src/domain/id.test.ts`

- [ ] **Step 1: Write failing id helper tests**

Create `src/domain/id.test.ts`:

```ts
import {describe, expect, it} from 'vitest';
import {displayName, toId} from './id';

describe('id helpers', () => {
  it('normalizes Showdown-style ids', () => {
    expect(toId('Ogerpon-Wellspring')).toBe('ogerponwellspring');
    expect(toId('Mr. Mime')).toBe('mrmime');
    expect(toId('Farfetch\u2019d')).toBe('farfetchd');
  });

  it('keeps known display names readable', () => {
    expect(displayName('greattusk', {'greattusk': 'Great Tusk'})).toBe('Great Tusk');
    expect(displayName('unknownmon', {})).toBe('unknownmon');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/domain/id.test.ts`

Expected: FAIL because `src/domain/id.ts` does not exist.

- [ ] **Step 3: Implement id helpers and shared types**

Create `src/domain/id.ts`:

```ts
export function toId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export function displayName(id: string, names: Record<string, string>): string {
  return names[id] ?? id;
}
```

Create `src/domain/types.ts`:

```ts
export type BattleStyle = 'singles' | 'doubles';

export type WeightedTable = Record<string, number>;

export interface StatsIndex {
  months: string[];
  latestMonth: string;
  formats: FormatListing[];
}

export interface FormatListing {
  id: string;
  name: string;
  month: string;
  cutoffs: number[];
}

export interface SourceMeta {
  month: string;
  format: string;
  cutoff: number;
  url: string;
  battles?: number;
}

export interface RawCounterEntry {
  n: number;
  p: number;
  d: number;
}

export interface CounterEdge {
  target: string;
  samples: number;
  probability: number;
  deviation: number;
}

export interface PokemonStats {
  id: string;
  name: string;
  usage: number;
  rawCount: number;
  viability: number;
  abilities: WeightedTable;
  items: WeightedTable;
  spreads: WeightedTable;
  moves: WeightedTable;
  teraTypes: WeightedTable;
  teammates: WeightedTable;
  checks: CounterEdge[];
}

export interface StatsDataset {
  source: SourceMeta;
  pokemon: PokemonStats[];
  pokemonById: Record<string, PokemonStats>;
  displayNames: Record<string, string>;
}

export interface RoleScores {
  physicalBreaker: number;
  specialBreaker: number;
  cleaner: number;
  defensivePivot: number;
  offensivePivot: number;
  support: number;
  status: number;
  setup: number;
  weatherTerrainSetter: number;
  weatherTerrainAbuser: number;
  hazardSetter: number;
  hazardRemoval: number;
  hazardPreservation: number;
  itemDisruption: number;
  speedControl: number;
  positioning: number;
  spreadPressure: number;
  boardControl: number;
}

export interface RoleWeights extends RoleScores {
  duplicateHazardPenalty: number;
  duplicateRemovalPenalty: number;
  duplicateSpeedControlPenalty: number;
}

export interface FormatProfile {
  id: string;
  gen: number;
  battleStyle: BattleStyle;
  teamSize: number;
  roleWeights: RoleWeights;
  warnings: string[];
}

export interface SetCandidate {
  pokemonId: string;
  pokemonName: string;
  ability: string;
  item: string;
  teraType?: string;
  nature?: string;
  evs?: string;
  moves: string[];
  roles: RoleScores;
  confidence: number;
  sourceWeights: {
    ability: number;
    item: number;
    teraType: number;
    moves: number;
    spread: number;
  };
}

export interface TeamMember {
  stats: PokemonStats;
  set: SetCandidate;
  locked?: boolean;
  explanation: string[];
}

export interface ScoreBreakdown {
  total: number;
  usage: number;
  setConfidence: number;
  synergy: number;
  roles: number;
  threats: number;
  typeBalance: number;
  setToTeamFit: number;
  duplicateRoles: number;
  archetype: number;
  warnings: string[];
}

export interface GeneratedTeam {
  members: TeamMember[];
  score: ScoreBreakdown;
  importable: string;
  threats: ThreatCoverage[];
  synergy: SynergyInsight[];
  source: SourceMeta;
}

export interface ThreatCoverage {
  threatId: string;
  threatName: string;
  usage: number;
  answers: Array<{pokemonId: string; pokemonName: string; confidence: number}>;
  covered: boolean;
}

export interface SynergyInsight {
  a: string;
  b: string;
  score: number;
}

export interface GenerateOptions {
  seeds: string[];
  lockedMembers?: TeamMember[];
  archetype: 'balanced' | 'offense' | 'bulky-offense' | 'stall' | 'weather' | 'trick-room';
  novelty: number;
}
```

Create `src/test/fixtures.ts`:

```ts
import type {PokemonStats, StatsDataset} from '../domain/types';

export function makePokemon(overrides: Partial<PokemonStats> & Pick<PokemonStats, 'id' | 'name'>): PokemonStats {
  return {
    usage: 10,
    rawCount: 1000,
    viability: 80,
    abilities: {},
    items: {},
    spreads: {},
    moves: {},
    teraTypes: {},
    teammates: {},
    checks: [],
    ...overrides
  };
}

export function makeDataset(pokemon: PokemonStats[]): StatsDataset {
  const pokemonById = Object.fromEntries(pokemon.map(mon => [mon.id, mon]));
  const displayNames = Object.fromEntries(pokemon.map(mon => [mon.id, mon.name]));
  return {
    source: {
      month: '2026-03',
      format: 'gen9ou',
      cutoff: 1825,
      url: 'https://www.smogon.com/stats/2026-03/chaos/gen9ou-1825.json',
      battles: 100000
    },
    pokemon,
    pokemonById,
    displayNames
  };
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- src/domain/id.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/id.ts src/domain/id.test.ts src/domain/types.ts src/test/fixtures.ts
git commit -m "feat: add domain model foundations"
```

---

### Task 3: Smogon Index Discovery And Cache API

**Files:**
- Create: `server/smogon/cache.ts`
- Create: `server/smogon/index.ts`
- Create: `server/smogon/routes.ts`
- Create: `server/index.ts`
- Test: `server/smogon/index.test.ts`

- [ ] **Step 1: Write failing index discovery tests**

Create `server/smogon/index.test.ts`:

```ts
import {describe, expect, it, vi} from 'vitest';
import {discoverStatsIndex, parseChaosListing, parseMonthListing} from './index';

const rootHtml = `
  <a href="2026-02/">2026-02/</a>
  <a href="2026-03/">2026-03/</a>
`;

const chaosHtml = `
  <a href="gen9ou-0.json">gen9ou-0.json</a>
  <a href="gen9ou-1500.json">gen9ou-1500.json</a>
  <a href="gen9ou-1825.json">gen9ou-1825.json</a>
  <a href="gen9doublesou-0.json">gen9doublesou-0.json</a>
  <a href="gen9doublesou-1825.json">gen9doublesou-1825.json</a>
`;

describe('Smogon index discovery', () => {
  it('parses and sorts months newest first', () => {
    expect(parseMonthListing(rootHtml)).toEqual(['2026-03', '2026-02']);
  });

  it('groups chaos files by format and cutoff', () => {
    expect(parseChaosListing(chaosHtml, '2026-03')).toEqual([
      {id: 'gen9doublesou', name: 'Gen 9 Doubles OU', month: '2026-03', cutoffs: [0, 1825]},
      {id: 'gen9ou', name: 'Gen 9 OU', month: '2026-03', cutoffs: [0, 1500, 1825]}
    ]);
  });

  it('fetches the latest index from Smogon', async () => {
    const fetcher = vi.fn(async (url: string) => {
      if (url === 'https://www.smogon.com/stats/') return rootHtml;
      if (url === 'https://www.smogon.com/stats/2026-03/chaos/') return chaosHtml;
      throw new Error(`Unexpected URL ${url}`);
    });

    await expect(discoverStatsIndex(fetcher)).resolves.toMatchObject({
      latestMonth: '2026-03',
      months: ['2026-03', '2026-02'],
      formats: [
        {id: 'gen9doublesou', cutoffs: [0, 1825]},
        {id: 'gen9ou', cutoffs: [0, 1500, 1825]}
      ]
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- server/smogon/index.test.ts`

Expected: FAIL because `server/smogon/index.ts` does not exist.

- [ ] **Step 3: Implement cache and index discovery**

Create `server/smogon/cache.ts`:

```ts
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const CACHE_DIR = path.resolve(process.cwd(), '.cache', 'smogon');
const memory = new Map<string, {expiresAt: number; value: string}>();

export async function readThroughCache(
  key: string,
  ttlMs: number,
  loader: () => Promise<string>
): Promise<string> {
  const now = Date.now();
  const cached = memory.get(key);
  if (cached && cached.expiresAt > now) return cached.value;

  await mkdir(CACHE_DIR, {recursive: true});
  const file = path.join(CACHE_DIR, `${crypto.createHash('sha1').update(key).digest('hex')}.txt`);

  try {
    const raw = await readFile(file, 'utf8');
    const parsed = JSON.parse(raw) as {expiresAt: number; value: string};
    if (parsed.expiresAt > now) {
      memory.set(key, parsed);
      return parsed.value;
    }
  } catch {
    // A missing or corrupt cache file should fall back to the network loader.
  }

  const value = await loader();
  const entry = {expiresAt: now + ttlMs, value};
  memory.set(key, entry);
  await writeFile(file, JSON.stringify(entry), 'utf8');
  return value;
}
```

Create `server/smogon/index.ts`:

```ts
import type {FormatListing, StatsIndex} from '../../src/domain/types';
import {readThroughCache} from './cache';

const STATS_ROOT = 'https://www.smogon.com/stats/';
const MONTH_PATTERN = /href="(\d{4}-\d{2})\/"/g;
const CHAOS_FILE_PATTERN = /href="([^"]+)-(\d+)\.json"/g;

export type TextFetcher = (url: string) => Promise<string>;

export function parseMonthListing(html: string): string[] {
  return [...html.matchAll(MONTH_PATTERN)]
    .map(match => match[1])
    .sort((a, b) => b.localeCompare(a));
}

export function formatName(formatId: string): string {
  const spaced = formatId
    .replace(/^gen(\d+)/, 'Gen $1 ')
    .replace(/doubles/g, ' Doubles ')
    .replace(/nationaldex/g, ' National Dex ')
    .replace(/ou/g, ' OU ')
    .replace(/uu/g, ' UU ')
    .replace(/ru/g, ' RU ')
    .replace(/nu/g, ' NU ')
    .replace(/lc/g, ' LC ')
    .replace(/\s+/g, ' ')
    .trim();
  return spaced || formatId;
}

export function parseChaosListing(html: string, month: string): FormatListing[] {
  const grouped = new Map<string, Set<number>>();
  for (const match of html.matchAll(CHAOS_FILE_PATTERN)) {
    const [, id, cutoff] = match;
    if (!grouped.has(id)) grouped.set(id, new Set());
    grouped.get(id)!.add(Number(cutoff));
  }

  return [...grouped.entries()]
    .map(([id, cutoffs]) => ({
      id,
      name: formatName(id),
      month,
      cutoffs: [...cutoffs].sort((a, b) => a - b)
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export async function fetchText(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Smogon request failed ${response.status}: ${url}`);
  return response.text();
}

export async function discoverStatsIndex(fetcher: TextFetcher = fetchText): Promise<StatsIndex> {
  const root = await readThroughCache('stats-root', 15 * 60_000, () => fetcher(STATS_ROOT));
  const months = parseMonthListing(root);
  if (!months.length) throw new Error('No Smogon stats months found');
  const latestMonth = months[0];
  const chaosUrl = `${STATS_ROOT}${latestMonth}/chaos/`;
  const chaos = await readThroughCache(`chaos-index:${latestMonth}`, 15 * 60_000, () => fetcher(chaosUrl));
  return {
    months,
    latestMonth,
    formats: parseChaosListing(chaos, latestMonth)
  };
}
```

- [ ] **Step 4: Implement API routes**

Create `server/smogon/routes.ts`:

```ts
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
```

Create `server/index.ts`:

```ts
import cors from 'cors';
import express from 'express';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createSmogonRouter} from './smogon/routes';

const app = express();
const port = Number(process.env.PORT ?? 8787);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '..', 'dist');

app.use(cors({origin: ['http://127.0.0.1:5173', 'http://localhost:5173']}));
app.use('/api', createSmogonRouter());
app.use(express.static(distDir));
app.get('*', (_request, response) => {
  response.sendFile(path.join(distDir, 'index.html'));
});

app.listen(port, '127.0.0.1', () => {
  console.log(`Smogon team generator API listening on http://127.0.0.1:${port}`);
});
```

- [ ] **Step 5: Run tests**

Run: `npm test -- server/smogon/index.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/smogon/cache.ts server/smogon/index.ts server/smogon/index.test.ts server/smogon/routes.ts server/index.ts
git commit -m "feat: discover Smogon stats index"
```

---

### Task 4: Chaos JSON Normalization

**Files:**
- Create: `src/domain/normalize.ts`
- Modify: `server/smogon/routes.ts`
- Test: `src/domain/normalize.test.ts`

- [ ] **Step 1: Write failing normalization tests**

Create `src/domain/normalize.test.ts`:

```ts
import {describe, expect, it} from 'vitest';
import {normalizeChaos} from './normalize';

const rawChaos = {
  info: {'number of battles': 1289120, cutoff: 1825},
  data: {
    'Great Tusk': {
      usage: 30.5,
      'Raw count': 788209,
      'Viability Ceiling': [44287, 92, 81, 63],
      Abilities: {protosynthesis: 4174.05},
      Items: {rockyhelmet: 940.4, boosterenergy: 1161.6},
      Spreads: {'Jolly:0/252/4/0/0/252': 926.9},
      Moves: {rapidspin: 3630.1, stealthrock: 1672.2, headlongrush: 3562.0},
      'Tera Types': {Steel: 1133.5},
      Teammates: {Kingambit: 1584.0},
      'Checks and Counters': {
        'Iron Valiant': {n: 30.68, p: 0.814, d: 0.07}
      }
    },
    'Iron Valiant': {
      usage: 16.7,
      'Raw count': 356429,
      'Viability Ceiling': [1000, 88, 70, 50],
      Abilities: {quarkdrive: 1000},
      Items: {boosterenergy: 500},
      Spreads: {'Timid:0/0/0/252/4/252': 300},
      Moves: {moonblast: 800},
      'Tera Types': {Fairy: 300},
      Teammates: {},
      'Checks and Counters': {}
    }
  }
};

describe('normalizeChaos', () => {
  it('normalizes Pokemon data and preserves display names', () => {
    const dataset = normalizeChaos(rawChaos, {
      month: '2026-03',
      format: 'gen9ou',
      cutoff: 1825,
      url: 'https://www.smogon.com/stats/2026-03/chaos/gen9ou-1825.json'
    });

    expect(dataset.source.battles).toBe(1289120);
    expect(dataset.pokemonById.greattusk.name).toBe('Great Tusk');
    expect(dataset.pokemonById.greattusk.moves.rapidspin).toBeCloseTo(3630.1);
    expect(dataset.pokemonById.greattusk.checks).toEqual([
      {target: 'ironvaliant', samples: 30.68, probability: 0.814, deviation: 0.07}
    ]);
    expect(dataset.displayNames.ironvaliant).toBe('Iron Valiant');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/domain/normalize.test.ts`

Expected: FAIL because `normalizeChaos` does not exist.

- [ ] **Step 3: Implement normalization**

Create `src/domain/normalize.ts`:

```ts
import {toId} from './id';
import type {CounterEdge, PokemonStats, SourceMeta, StatsDataset, WeightedTable} from './types';

type RawPokemon = Record<string, unknown>;

function numberValue(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function weightedTable(value: unknown): WeightedTable {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, weight]) => typeof weight === 'number' && Number.isFinite(weight))
      .map(([key, weight]) => [toId(key), weight as number])
  );
}

function teraTable(value: unknown): WeightedTable {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, weight]) => typeof weight === 'number' && Number.isFinite(weight))
      .map(([key, weight]) => [key, weight as number])
  );
}

function normalizeChecks(value: unknown): CounterEdge[] {
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value as Record<string, {n?: number; p?: number; d?: number}>)
    .map(([target, edge]) => ({
      target: toId(target),
      samples: numberValue(edge.n),
      probability: numberValue(edge.p),
      deviation: numberValue(edge.d)
    }))
    .filter(edge => edge.samples > 0);
}

function viability(value: unknown): number {
  if (Array.isArray(value)) return numberValue(value[1]);
  return numberValue(value);
}

export function normalizeChaos(raw: unknown, source: SourceMeta): StatsDataset {
  const root = raw as {info?: Record<string, unknown>; data?: Record<string, RawPokemon>};
  const displayNames: Record<string, string> = {};
  const pokemon: PokemonStats[] = Object.entries(root.data ?? {}).map(([name, entry]) => {
    const id = toId(name);
    displayNames[id] = name;
    return {
      id,
      name,
      usage: numberValue(entry.usage),
      rawCount: numberValue(entry['Raw count']),
      viability: viability(entry['Viability Ceiling']),
      abilities: weightedTable(entry.Abilities),
      items: weightedTable(entry.Items),
      spreads: entry.Spreads && typeof entry.Spreads === 'object'
        ? Object.fromEntries(Object.entries(entry.Spreads as Record<string, number>))
        : {},
      moves: weightedTable(entry.Moves),
      teraTypes: teraTable(entry['Tera Types']),
      teammates: weightedTable(entry.Teammates),
      checks: normalizeChecks(entry['Checks and Counters'])
    };
  });

  pokemon.sort((a, b) => b.usage - a.usage);
  return {
    source: {
      ...source,
      battles: numberValue(root.info?.['number of battles'], source.battles)
    },
    pokemon,
    pokemonById: Object.fromEntries(pokemon.map(mon => [mon.id, mon])),
    displayNames
  };
}
```

- [ ] **Step 4: Add stats data API route**

Modify `server/smogon/routes.ts`:

```ts
import type {Router} from 'express';
import express from 'express';
import {normalizeChaos} from '../../src/domain/normalize';
import {readThroughCache} from './cache';
import {discoverStatsIndex, fetchText} from './index';

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

  router.get('/stats/:month/:format/:cutoff', async (request, response) => {
    const {month, format, cutoff} = request.params;
    const cutoffNumber = Number(cutoff);
    const url = `https://www.smogon.com/stats/${month}/chaos/${format}-${cutoffNumber}.json`;

    if (!/^\d{4}-\d{2}$/.test(month) || !/^[a-z0-9]+$/.test(format) || !Number.isFinite(cutoffNumber)) {
      response.status(400).json({message: 'Invalid Smogon stats request'});
      return;
    }

    try {
      const rawText = await readThroughCache(`chaos:${month}:${format}:${cutoffNumber}`, 24 * 60 * 60_000, () => fetchText(url));
      response.json(normalizeChaos(JSON.parse(rawText), {month, format, cutoff: cutoffNumber, url}));
    } catch (error) {
      response.status(502).json({
        message: error instanceof Error ? error.message : 'Unable to fetch Smogon chaos data'
      });
    }
  });

  return router;
}
```

- [ ] **Step 5: Run tests**

Run: `npm test -- src/domain/normalize.test.ts server/smogon/index.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/domain/normalize.ts src/domain/normalize.test.ts server/smogon/routes.ts
git commit -m "feat: normalize Smogon chaos data"
```

---

### Task 5: Format Profiles And Role Detection

**Files:**
- Create: `src/domain/formatProfile.ts`
- Create: `src/domain/roles.ts`
- Test: `src/domain/formatProfile.test.ts`
- Test: `src/domain/roles.test.ts`

- [ ] **Step 1: Write failing format profile tests**

Create `src/domain/formatProfile.test.ts`:

```ts
import {describe, expect, it} from 'vitest';
import {inferFormatProfile} from './formatProfile';

describe('inferFormatProfile', () => {
  it('uses singles hazard weights for singles formats', () => {
    const profile = inferFormatProfile('gen9ou');
    expect(profile.battleStyle).toBe('singles');
    expect(profile.teamSize).toBe(6);
    expect(profile.roleWeights.hazardSetter).toBeGreaterThan(profile.roleWeights.speedControl);
  });

  it('uses doubles speed control weights for doubles formats', () => {
    const profile = inferFormatProfile('gen9doublesou');
    expect(profile.battleStyle).toBe('doubles');
    expect(profile.roleWeights.speedControl).toBeGreaterThan(profile.roleWeights.hazardSetter);
    expect(profile.roleWeights.positioning).toBeGreaterThan(1);
  });
});
```

Create `src/domain/roles.test.ts`:

```ts
import {describe, expect, it} from 'vitest';
import {makePokemon} from '../test/fixtures';
import {inferFormatProfile} from './formatProfile';
import {detectRoles} from './roles';

describe('detectRoles', () => {
  it('detects singles hazard and removal roles', () => {
    const roles = detectRoles(makePokemon({
      id: 'greattusk',
      name: 'Great Tusk',
      moves: {stealthrock: 60, rapidspin: 90, headlongrush: 90, closecombat: 40}
    }), inferFormatProfile('gen9ou'));

    expect(roles.hazardSetter).toBeGreaterThan(0.4);
    expect(roles.hazardRemoval).toBeGreaterThan(0.6);
  });

  it('detects doubles speed control and positioning roles', () => {
    const roles = detectRoles(makePokemon({
      id: 'tornadus',
      name: 'Tornadus',
      moves: {tailwind: 95, protect: 55, taunt: 40, bleakwindstorm: 80}
    }), inferFormatProfile('gen9doublesou'));

    expect(roles.speedControl).toBeGreaterThan(0.8);
    expect(roles.positioning).toBeGreaterThan(0.3);
    expect(roles.spreadPressure).toBeGreaterThan(0.4);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/domain/formatProfile.test.ts src/domain/roles.test.ts`

Expected: FAIL because profile and role modules do not exist.

- [ ] **Step 3: Implement format profile inference**

Create `src/domain/formatProfile.ts`:

```ts
import type {FormatProfile, RoleScores, RoleWeights} from './types';

const zeroRoles: RoleScores = {
  physicalBreaker: 0,
  specialBreaker: 0,
  cleaner: 0,
  defensivePivot: 0,
  offensivePivot: 0,
  support: 0,
  status: 0,
  setup: 0,
  weatherTerrainSetter: 0,
  weatherTerrainAbuser: 0,
  hazardSetter: 0,
  hazardRemoval: 0,
  hazardPreservation: 0,
  itemDisruption: 0,
  speedControl: 0,
  positioning: 0,
  spreadPressure: 0,
  boardControl: 0
};

export const emptyRoles = zeroRoles;

const singlesWeights: RoleWeights = {
  ...zeroRoles,
  physicalBreaker: 1,
  specialBreaker: 1,
  cleaner: 0.9,
  defensivePivot: 0.9,
  offensivePivot: 0.75,
  support: 0.65,
  status: 0.55,
  setup: 0.75,
  weatherTerrainSetter: 0.45,
  weatherTerrainAbuser: 0.45,
  hazardSetter: 1.35,
  hazardRemoval: 1.2,
  hazardPreservation: 0.8,
  itemDisruption: 0.7,
  speedControl: 0.35,
  positioning: 0.25,
  spreadPressure: 0.2,
  boardControl: 0.3,
  duplicateHazardPenalty: 1.4,
  duplicateRemovalPenalty: 1.0,
  duplicateSpeedControlPenalty: 0.2
};

const doublesWeights: RoleWeights = {
  ...zeroRoles,
  physicalBreaker: 0.9,
  specialBreaker: 0.9,
  cleaner: 0.7,
  defensivePivot: 0.55,
  offensivePivot: 0.7,
  support: 0.8,
  status: 0.6,
  setup: 0.45,
  weatherTerrainSetter: 0.8,
  weatherTerrainAbuser: 0.7,
  hazardSetter: 0.15,
  hazardRemoval: 0.05,
  hazardPreservation: 0.05,
  itemDisruption: 0.35,
  speedControl: 1.5,
  positioning: 1.25,
  spreadPressure: 0.9,
  boardControl: 1.0,
  duplicateHazardPenalty: 0.1,
  duplicateRemovalPenalty: 0.05,
  duplicateSpeedControlPenalty: 0.25
};

export function inferFormatProfile(formatId: string): FormatProfile {
  const doubles = /doubles|vgc|2v2|4v4/.test(formatId);
  const gen = Number(formatId.match(/^gen(\d+)/)?.[1] ?? 9);
  return {
    id: formatId,
    gen,
    battleStyle: doubles ? 'doubles' : 'singles',
    teamSize: formatId.includes('1v1') ? 3 : 6,
    roleWeights: doubles ? doublesWeights : singlesWeights,
    warnings: formatId.includes('hackmons') || formatId.includes('metronome')
      ? ['Format has unusual rules; role inference may be noisy.']
      : []
  };
}
```

- [ ] **Step 4: Implement role detection**

Create `src/domain/roles.ts`:

```ts
import {emptyRoles} from './formatProfile';
import type {FormatProfile, PokemonStats, RoleScores} from './types';

const hazardMoves = new Set(['stealthrock', 'spikes', 'toxicspikes', 'stickyweb']);
const removalMoves = new Set(['rapidspin', 'defog', 'courtchange', 'mortalspin', 'tidyup']);
const speedControlMoves = new Set(['tailwind', 'trickroom', 'icywind', 'electroweb', 'thunderwave', 'quash']);
const positioningMoves = new Set(['protect', 'fakeout', 'followme', 'ragepowder', 'helpinghand', 'uturn', 'voltswitch', 'partingshot']);
const spreadMoves = new Set(['earthquake', 'rockslide', 'heatwave', 'dazzlinggleam', 'muddywater', 'makeitrain', 'bleakwindstorm', 'discharge']);
const setupMoves = new Set(['swordsdance', 'nastyplot', 'dragondance', 'calmmind', 'bulkup', 'irondefense']);
const statusMoves = new Set(['toxic', 'willowisp', 'thunderwave', 'spore', 'stunspore', 'glare']);
const itemDisruptionMoves = new Set(['knockoff', 'trick', 'switcheroo']);

function hasWeightedMove(stats: PokemonStats, moves: Set<string>): number {
  const total = Object.values(stats.moves).reduce((sum, value) => sum + value, 0);
  if (!total) return 0;
  const score = Object.entries(stats.moves)
    .filter(([move]) => moves.has(move))
    .reduce((sum, [, value]) => sum + value, 0);
  return Math.min(1, score / Math.max(total / 4, 1));
}

function abilityHas(stats: PokemonStats, ids: string[]): boolean {
  return ids.some(id => stats.abilities[id] > 0);
}

export function detectRoles(stats: PokemonStats, profile: FormatProfile): RoleScores {
  const roles: RoleScores = {...emptyRoles};
  const moves = stats.moves;

  roles.hazardSetter = hasWeightedMove(stats, hazardMoves);
  roles.hazardRemoval = hasWeightedMove(stats, removalMoves);
  roles.speedControl = hasWeightedMove(stats, speedControlMoves);
  roles.positioning = hasWeightedMove(stats, positioningMoves);
  roles.spreadPressure = hasWeightedMove(stats, spreadMoves);
  roles.setup = hasWeightedMove(stats, setupMoves);
  roles.status = hasWeightedMove(stats, statusMoves);
  roles.itemDisruption = hasWeightedMove(stats, itemDisruptionMoves);

  roles.hazardPreservation = stats.id.includes('gholdengo') || abilityHas(stats, ['goodasgold']) ? 0.8 : 0;
  roles.weatherTerrainSetter = abilityHas(stats, ['drizzle', 'drought', 'sandstream', 'snowwarning', 'electric surge', 'psychicsurge', 'grassy surge', 'mistysurge'].map(id => id.replace(/\s/g, ''))) ? 0.8 : 0;
  roles.support = Math.max(roles.positioning, roles.status, roles.hazardRemoval * 0.6, roles.speedControl * 0.6);
  roles.physicalBreaker = Math.min(1, ((moves.closecombat ?? 0) + (moves.earthquake ?? 0) + (moves.headlongrush ?? 0) + (moves.suckerpunch ?? 0)) / 150);
  roles.specialBreaker = Math.min(1, ((moves.moonblast ?? 0) + (moves.shadowball ?? 0) + (moves.makeitrain ?? 0) + (moves.dracometeor ?? 0)) / 150);
  roles.cleaner = Math.max(roles.speedControl * 0.4, moves.suckerpunch ? 0.6 : 0, moves.extremespeed ? 0.6 : 0);
  roles.defensivePivot = Math.min(1, ((stats.items.leftovers ?? 0) + (stats.items.rockyhelmet ?? 0) + (stats.moves.recover ?? 0) + (stats.moves.roost ?? 0)) / 150);
  roles.offensivePivot = Math.min(1, ((moves.uturn ?? 0) + (moves.voltswitch ?? 0) + (moves.flipturn ?? 0)) / 100);
  roles.boardControl = profile.battleStyle === 'doubles'
    ? Math.max(roles.speedControl * 0.7, roles.positioning * 0.6, abilityHas(stats, ['intimidate']) ? 0.75 : 0)
    : Math.max(roles.hazardSetter * 0.4, roles.hazardRemoval * 0.4);

  return roles;
}
```

- [ ] **Step 5: Run tests**

Run: `npm test -- src/domain/formatProfile.test.ts src/domain/roles.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/domain/formatProfile.ts src/domain/formatProfile.test.ts src/domain/roles.ts src/domain/roles.test.ts
git commit -m "feat: infer format-aware roles"
```

---

### Task 6: Team-Contextual Sets And Showdown Import

**Files:**
- Create: `src/domain/sets.ts`
- Create: `src/domain/importable.ts`
- Test: `src/domain/sets.test.ts`
- Test: `src/domain/importable.test.ts`

- [ ] **Step 1: Write failing set and import tests**

Create `src/domain/sets.test.ts`:

```ts
import {describe, expect, it} from 'vitest';
import {makePokemon} from '../test/fixtures';
import {inferFormatProfile} from './formatProfile';
import {buildSetCandidates, scoreSetForTeamContext} from './sets';

describe('set construction', () => {
  it('builds likely sets from weighted stats', () => {
    const stats = makePokemon({
      id: 'greattusk',
      name: 'Great Tusk',
      abilities: {protosynthesis: 100},
      items: {boosterenergy: 60, rockyhelmet: 40},
      spreads: {'Jolly:0/252/4/0/0/252': 80},
      moves: {rapidspin: 90, headlongrush: 90, stealthrock: 50, knockoff: 35, iceSpinner: 30},
      teraTypes: {Steel: 40}
    });

    const [set] = buildSetCandidates(stats, inferFormatProfile('gen9ou'));

    expect(set.ability).toBe('Protosynthesis');
    expect(set.item).toBe('Booster Energy');
    expect(set.moves).toHaveLength(4);
    expect(set.moves).toContain('Rapid Spin');
    expect(set.evs).toBe('0 HP / 252 Atk / 4 Def / 0 SpA / 0 SpD / 252 Spe');
    expect(set.nature).toBe('Jolly');
  });

  it('penalizes another singles rocker when hazards are already covered', () => {
    const profile = inferFormatProfile('gen9ou');
    const rocker = buildSetCandidates(makePokemon({
      id: 'tinglu',
      name: 'Ting-Lu',
      abilities: {vesselofruin: 100},
      items: {leftovers: 100},
      spreads: {'Careful:252/0/4/0/252/0': 100},
      moves: {stealthrock: 90, spikes: 80, earthquake: 60, whirlwind: 40},
      teraTypes: {Poison: 40}
    }), profile)[0];

    const score = scoreSetForTeamContext(rocker, [{roles: {...rocker.roles, hazardSetter: 1}}], profile);
    expect(score).toBeLessThan(0);
  });
});
```

Create `src/domain/importable.test.ts`:

```ts
import {describe, expect, it} from 'vitest';
import type {SetCandidate} from './types';
import {formatSet} from './importable';

describe('formatSet', () => {
  it('creates Showdown import text', () => {
    const set: SetCandidate = {
      pokemonId: 'greattusk',
      pokemonName: 'Great Tusk',
      ability: 'Protosynthesis',
      item: 'Booster Energy',
      teraType: 'Steel',
      nature: 'Jolly',
      evs: '0 HP / 252 Atk / 4 Def / 0 SpA / 0 SpD / 252 Spe',
      moves: ['Rapid Spin', 'Headlong Rush', 'Stealth Rock', 'Knock Off'],
      roles: {
        physicalBreaker: 0,
        specialBreaker: 0,
        cleaner: 0,
        defensivePivot: 0,
        offensivePivot: 0,
        support: 0,
        status: 0,
        setup: 0,
        weatherTerrainSetter: 0,
        weatherTerrainAbuser: 0,
        hazardSetter: 1,
        hazardRemoval: 1,
        hazardPreservation: 0,
        itemDisruption: 1,
        speedControl: 0,
        positioning: 0,
        spreadPressure: 0,
        boardControl: 0
      },
      confidence: 0.8,
      sourceWeights: {ability: 100, item: 60, teraType: 40, moves: 265, spread: 80}
    };

    expect(formatSet(set)).toContain('Great Tusk @ Booster Energy');
    expect(formatSet(set)).toContain('Ability: Protosynthesis');
    expect(formatSet(set)).toContain('Tera Type: Steel');
    expect(formatSet(set)).toContain('- Rapid Spin');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/domain/sets.test.ts src/domain/importable.test.ts`

Expected: FAIL because `sets.ts` and `importable.ts` do not exist.

- [ ] **Step 3: Implement set construction**

Create `src/domain/sets.ts`:

```ts
import {detectRoles} from './roles';
import type {FormatProfile, PokemonStats, RoleScores, SetCandidate} from './types';

const statNames = ['HP', 'Atk', 'Def', 'SpA', 'SpD', 'Spe'];

function topEntries(table: Record<string, number>, count: number): Array<[string, number]> {
  return Object.entries(table).sort((a, b) => b[1] - a[1]).slice(0, count);
}

function titleCaseId(id: string): string {
  const special: Record<string, string> = {
    rapidspin: 'Rapid Spin',
    headlongrush: 'Headlong Rush',
    stealthrock: 'Stealth Rock',
    knockoff: 'Knock Off',
    boosterenergy: 'Booster Energy',
    rockyhelmet: 'Rocky Helmet',
    protosynthesis: 'Protosynthesis',
    vesselofruin: 'Vessel of Ruin'
  };
  if (special[id]) return special[id];
  return id.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^\w/, char => char.toUpperCase());
}

function parseSpread(spread: string | undefined): {nature?: string; evs?: string; weight: number} {
  if (!spread) return {weight: 0};
  const [nature, evText] = spread.split(':');
  const values = (evText ?? '').split('/').map(value => Number(value));
  if (values.length !== 6 || values.some(value => !Number.isFinite(value))) return {nature, weight: 0};
  return {
    nature,
    evs: values.map((value, index) => `${value} ${statNames[index]}`).join(' / '),
    weight: 1
  };
}

export function buildSetCandidates(stats: PokemonStats, profile: FormatProfile): SetCandidate[] {
  const ability = topEntries(stats.abilities, 1)[0] ?? ['none', 0];
  const items = topEntries(stats.items, 3);
  const spreads = topEntries(stats.spreads, 2);
  const tera = topEntries(stats.teraTypes, 2);
  const movePool = topEntries(stats.moves, 8);
  const roles = detectRoles(stats, profile);

  return (items.length ? items : [['leftovers', 0]]).flatMap(([item, itemWeight]) =>
    (spreads.length ? spreads : [['Serious:0/0/0/0/0/0', 0]]).map(([spread, spreadWeight]) => {
      const parsedSpread = parseSpread(spread);
      const selectedMoves = movePool.slice(0, 4);
      const moveWeight = selectedMoves.reduce((sum, [, weight]) => sum + weight, 0);
      const teraEntry = tera[0] ?? [undefined, 0];
      const maxMoveWeight = Math.max(1, movePool.slice(0, 4).reduce((sum, [, weight]) => sum + weight, 0));
      return {
        pokemonId: stats.id,
        pokemonName: stats.name,
        ability: titleCaseId(ability[0]),
        item: titleCaseId(item),
        teraType: teraEntry[0],
        nature: parsedSpread.nature,
        evs: parsedSpread.evs,
        moves: selectedMoves.map(([move]) => titleCaseId(move)),
        roles,
        confidence: Math.min(1, (ability[1] + itemWeight + spreadWeight + moveWeight + (teraEntry[1] ?? 0)) / (ability[1] + itemWeight + spreadWeight + maxMoveWeight + (teraEntry[1] ?? 0) || 1)),
        sourceWeights: {
          ability: ability[1],
          item: itemWeight,
          teraType: teraEntry[1] ?? 0,
          moves: moveWeight,
          spread: spreadWeight
        }
      };
    })
  );
}

export function scoreSetForTeamContext(
  candidate: SetCandidate,
  partialTeam: Array<{roles: RoleScores}>,
  profile: FormatProfile
): number {
  const existingHazards = partialTeam.filter(member => member.roles.hazardSetter > 0.5).length;
  const existingRemoval = partialTeam.filter(member => member.roles.hazardRemoval > 0.5).length;
  const existingSpeed = partialTeam.filter(member => member.roles.speedControl > 0.5).length;

  let score = 0;
  if (candidate.roles.hazardSetter > 0.5 && existingHazards >= 1) score -= profile.roleWeights.duplicateHazardPenalty;
  if (candidate.roles.hazardRemoval > 0.5 && existingRemoval >= 1) score -= profile.roleWeights.duplicateRemovalPenalty;
  if (candidate.roles.speedControl > 0.5 && existingSpeed >= 2) score -= profile.roleWeights.duplicateSpeedControlPenalty;
  if (candidate.roles.speedControl > 0.5 && profile.battleStyle === 'doubles' && existingSpeed === 0) score += 0.8;
  if (candidate.roles.hazardSetter > 0.5 && profile.battleStyle === 'singles' && existingHazards === 0) score += 0.7;
  return score;
}
```

- [ ] **Step 4: Implement import formatting**

Create `src/domain/importable.ts`:

```ts
import type {GeneratedTeam, SetCandidate} from './types';

export function formatSet(set: SetCandidate): string {
  const lines = [
    `${set.pokemonName} @ ${set.item}`,
    `Ability: ${set.ability}`
  ];
  if (set.teraType) lines.push(`Tera Type: ${set.teraType}`);
  if (set.evs) lines.push(`EVs: ${set.evs}`);
  if (set.nature) lines.push(`${set.nature} Nature`);
  lines.push(...set.moves.map(move => `- ${move}`));
  return lines.join('\n');
}

export function formatTeam(team: Pick<GeneratedTeam, 'members'>): string {
  return team.members.map(member => formatSet(member.set)).join('\n\n');
}
```

- [ ] **Step 5: Run tests**

Run: `npm test -- src/domain/sets.test.ts src/domain/importable.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/domain/sets.ts src/domain/sets.test.ts src/domain/importable.ts src/domain/importable.test.ts
git commit -m "feat: build team-contextual sets"
```

---

### Task 7: Scoring, Threat Coverage, And Synergy

**Files:**
- Create: `src/domain/scoring.ts`
- Test: `src/domain/scoring.test.ts`

- [ ] **Step 1: Write failing scoring tests**

Create `src/domain/scoring.test.ts`:

```ts
import {describe, expect, it} from 'vitest';
import {makeDataset, makePokemon} from '../test/fixtures';
import {inferFormatProfile} from './formatProfile';
import {buildSetCandidates} from './sets';
import {scoreTeam, threatCoverage} from './scoring';
import type {TeamMember} from './types';

function member(mon: ReturnType<typeof makePokemon>, format = 'gen9ou'): TeamMember {
  return {
    stats: mon,
    set: buildSetCandidates(mon, inferFormatProfile(format))[0],
    explanation: []
  };
}

describe('scoring', () => {
  it('penalizes redundant singles hazards', () => {
    const rockerA = makePokemon({id: 'tinglu', name: 'Ting-Lu', moves: {stealthrock: 100}, teammates: {}});
    const rockerB = makePokemon({id: 'glimmora', name: 'Glimmora', moves: {stealthrock: 100, spikes: 100}, teammates: {}});
    const dataset = makeDataset([rockerA, rockerB]);

    const score = scoreTeam([member(rockerA), member(rockerB)], dataset, inferFormatProfile('gen9ou'));
    expect(score.duplicateRoles).toBeLessThan(0);
  });

  it('rewards doubles speed control more than hazards', () => {
    const tailwind = makePokemon({id: 'tornadus', name: 'Tornadus', moves: {tailwind: 100, protect: 50}});
    const rocker = makePokemon({id: 'glimmora', name: 'Glimmora', moves: {stealthrock: 100}});
    const dataset = makeDataset([tailwind, rocker]);

    const speedScore = scoreTeam([member(tailwind, 'gen9doublesou')], dataset, inferFormatProfile('gen9doublesou'));
    const hazardScore = scoreTeam([member(rocker, 'gen9doublesou')], dataset, inferFormatProfile('gen9doublesou'));
    expect(speedScore.roles).toBeGreaterThan(hazardScore.roles);
  });

  it('reports covered and uncovered threats', () => {
    const greatTusk = makePokemon({id: 'greattusk', name: 'Great Tusk', usage: 30, checks: [{target: 'kingambit', samples: 50, probability: 0.7, deviation: 0.05}]});
    const kingambit = makePokemon({id: 'kingambit', name: 'Kingambit', usage: 28});
    const dataset = makeDataset([greatTusk, kingambit]);
    const coverage = threatCoverage([member(greatTusk)], dataset);

    expect(coverage.find(item => item.threatId === 'kingambit')?.covered).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/domain/scoring.test.ts`

Expected: FAIL because `scoring.ts` does not exist.

- [ ] **Step 3: Implement scoring**

Create `src/domain/scoring.ts`:

```ts
import {scoreSetForTeamContext} from './sets';
import type {FormatProfile, GeneratedTeam, ScoreBreakdown, StatsDataset, SynergyInsight, TeamMember, ThreatCoverage} from './types';

function clamp(value: number, min = -10, max = 10): number {
  return Math.max(min, Math.min(max, value));
}

export function synergyInsights(members: TeamMember[]): SynergyInsight[] {
  const insights: SynergyInsight[] = [];
  for (let i = 0; i < members.length; i += 1) {
    for (let j = i + 1; j < members.length; j += 1) {
      const a = members[i];
      const b = members[j];
      const raw = (a.stats.teammates[b.stats.id] ?? 0) + (b.stats.teammates[a.stats.id] ?? 0);
      insights.push({a: a.stats.id, b: b.stats.id, score: raw / Math.max(1, a.stats.usage + b.stats.usage)});
    }
  }
  return insights.sort((a, b) => b.score - a.score);
}

export function threatCoverage(members: TeamMember[], dataset: StatsDataset, limit = 12): ThreatCoverage[] {
  const threats = dataset.pokemon.slice(0, limit);
  return threats.map(threat => {
    const answers = members.flatMap(member => {
      const edge = member.stats.checks.find(check => check.target === threat.id);
      if (!edge) return [];
      const confidence = edge.probability * Math.min(1, edge.samples / 40) * (1 - Math.min(0.5, edge.deviation));
      return [{pokemonId: member.stats.id, pokemonName: member.stats.name, confidence}];
    }).sort((a, b) => b.confidence - a.confidence);
    return {
      threatId: threat.id,
      threatName: threat.name,
      usage: threat.usage,
      answers,
      covered: answers.some(answer => answer.confidence >= 0.35)
    };
  });
}

function roleScore(members: TeamMember[], profile: FormatProfile): number {
  const totals = members.reduce((acc, member) => {
    for (const [key, value] of Object.entries(member.set.roles)) {
      acc[key] = (acc[key] ?? 0) + value;
    }
    return acc;
  }, {} as Record<string, number>);

  return Object.entries(profile.roleWeights).reduce((sum, [role, weight]) => {
    if (role.startsWith('duplicate')) return sum;
    return sum + Math.min(1.5, totals[role] ?? 0) * weight;
  }, 0);
}

function duplicateRolePenalty(members: TeamMember[], profile: FormatProfile): number {
  const hazards = members.filter(member => member.set.roles.hazardSetter > 0.5).length;
  const removal = members.filter(member => member.set.roles.hazardRemoval > 0.5).length;
  const speed = members.filter(member => member.set.roles.speedControl > 0.5).length;
  return -(
    Math.max(0, hazards - 1) * profile.roleWeights.duplicateHazardPenalty +
    Math.max(0, removal - 1) * profile.roleWeights.duplicateRemovalPenalty +
    Math.max(0, speed - 2) * profile.roleWeights.duplicateSpeedControlPenalty
  );
}

export function scoreTeam(members: TeamMember[], dataset: StatsDataset, profile: FormatProfile): ScoreBreakdown {
  const usage = members.reduce((sum, member) => sum + member.stats.usage, 0) / Math.max(1, members.length);
  const setConfidence = members.reduce((sum, member) => sum + member.set.confidence, 0);
  const synergy = synergyInsights(members).reduce((sum, insight) => sum + insight.score, 0);
  const roles = roleScore(members, profile);
  const threats = threatCoverage(members, dataset).filter(threat => threat.covered).length;
  const duplicateRoles = duplicateRolePenalty(members, profile);
  const setToTeamFit = members.reduce((sum, member, index) => {
    const previous = members.slice(0, index).map(existing => ({roles: existing.set.roles}));
    return sum + scoreSetForTeamContext(member.set, previous, profile);
  }, 0);

  const score: ScoreBreakdown = {
    usage: clamp(usage / 5, 0, 10),
    setConfidence: clamp(setConfidence),
    synergy: clamp(synergy),
    roles: clamp(roles),
    threats: clamp(threats / 2),
    typeBalance: 0,
    setToTeamFit: clamp(setToTeamFit),
    duplicateRoles,
    archetype: 0,
    warnings: []
  };

  score.total = Object.entries(score)
    .filter(([key, value]) => key !== 'total' && key !== 'warnings' && typeof value === 'number')
    .reduce((sum, [, value]) => sum + (value as number), 0);
  return score;
}

export function attachInsights(team: Omit<GeneratedTeam, 'threats' | 'synergy'>, dataset: StatsDataset): GeneratedTeam {
  return {
    ...team,
    threats: threatCoverage(team.members, dataset),
    synergy: synergyInsights(team.members)
  };
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- src/domain/scoring.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/scoring.ts src/domain/scoring.test.ts
git commit -m "feat: score teams from roles threats and synergy"
```

---

### Task 8: Beam Search Generator

**Files:**
- Create: `src/domain/generator.ts`
- Test: `src/domain/generator.test.ts`

- [ ] **Step 1: Write failing generator tests**

Create `src/domain/generator.test.ts`:

```ts
import {describe, expect, it} from 'vitest';
import {makeDataset, makePokemon} from '../test/fixtures';
import {generateTeam} from './generator';

describe('generateTeam', () => {
  it('keeps seed Pokemon and fills to format team size', () => {
    const dataset = makeDataset([
      makePokemon({id: 'greattusk', name: 'Great Tusk', usage: 30, moves: {rapidspin: 90, stealthrock: 60}, abilities: {protosynthesis: 100}, items: {boosterenergy: 100}}),
      makePokemon({id: 'kingambit', name: 'Kingambit', usage: 29, moves: {suckerpunch: 90}, abilities: {supremeoverlord: 100}, items: {blackglasses: 100}}),
      makePokemon({id: 'gholdengo', name: 'Gholdengo', usage: 22, moves: {makeitrain: 90}, abilities: {goodasgold: 100}, items: {airballoon: 100}}),
      makePokemon({id: 'dragapult', name: 'Dragapult', usage: 14, moves: {dracometeor: 80}, abilities: {infiltrator: 100}, items: {choicespecs: 100}}),
      makePokemon({id: 'corviknight', name: 'Corviknight', usage: 14, moves: {uturn: 70, roost: 50}, abilities: {pressure: 100}, items: {rockyhelmet: 100}}),
      makePokemon({id: 'samurotthisui', name: 'Samurott-Hisui', usage: 10, moves: {ceaselessedge: 90}, abilities: {sharpness: 100}, items: {focussash: 100}})
    ]);

    const team = generateTeam(dataset, 'gen9ou', {seeds: ['greattusk'], archetype: 'balanced', novelty: 0});
    expect(team.members).toHaveLength(6);
    expect(team.members[0].stats.id).toBe('greattusk');
    expect(team.importable).toContain('Great Tusk');
    expect(team.score.total).toBeGreaterThan(0);
  });

  it('does not select the same Pokemon twice', () => {
    const dataset = makeDataset([
      makePokemon({id: 'a', name: 'A', usage: 50, moves: {stealthrock: 100}}),
      makePokemon({id: 'b', name: 'B', usage: 40, moves: {rapidspin: 100}}),
      makePokemon({id: 'c', name: 'C', usage: 30, moves: {suckerpunch: 100}})
    ]);
    const team = generateTeam(dataset, 'gen91v1', {seeds: [], archetype: 'balanced', novelty: 0});
    expect(new Set(team.members.map(member => member.stats.id)).size).toBe(team.members.length);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/domain/generator.test.ts`

Expected: FAIL because `generator.ts` does not exist.

- [ ] **Step 3: Implement beam search**

Create `src/domain/generator.ts`:

```ts
import {inferFormatProfile} from './formatProfile';
import {formatTeam} from './importable';
import {attachInsights, scoreTeam} from './scoring';
import {buildSetCandidates, scoreSetForTeamContext} from './sets';
import type {GenerateOptions, GeneratedTeam, StatsDataset, TeamMember} from './types';

interface Beam {
  members: TeamMember[];
  score: number;
}

function memberFromStats(stats: StatsDataset['pokemon'][number], partial: TeamMember[], format: string): TeamMember | undefined {
  const profile = inferFormatProfile(format);
  const candidates = buildSetCandidates(stats, profile)
    .sort((a, b) => {
      const aScore = a.confidence + scoreSetForTeamContext(a, partial.map(member => ({roles: member.set.roles})), profile);
      const bScore = b.confidence + scoreSetForTeamContext(b, partial.map(member => ({roles: member.set.roles})), profile);
      return bScore - aScore;
    });
  const set = candidates[0];
  if (!set) return undefined;
  return {
    stats,
    set,
    explanation: [
      `${stats.name} adds ${stats.usage.toFixed(1)} usage value in this format.`,
      `Selected set confidence ${(set.confidence * 100).toFixed(0)}%.`
    ]
  };
}

export function generateTeam(dataset: StatsDataset, formatId: string, options: GenerateOptions): GeneratedTeam {
  const profile = inferFormatProfile(formatId);
  const pool = dataset.pokemon.slice(0, Math.min(dataset.pokemon.length, 80));
  const seedMembers = options.seeds
    .map(seed => dataset.pokemonById[seed])
    .filter(Boolean)
    .map(stats => memberFromStats(stats, [], formatId))
    .filter((member): member is TeamMember => Boolean(member));

  let beams: Beam[] = [{members: seedMembers, score: 0}];
  const beamWidth = 12;

  while (beams[0]?.members.length < Math.min(profile.teamSize, dataset.pokemon.length)) {
    const next: Beam[] = [];
    for (const beam of beams) {
      const selected = new Set(beam.members.map(member => member.stats.id));
      for (const stats of pool) {
        if (selected.has(stats.id)) continue;
        const member = memberFromStats(stats, beam.members, formatId);
        if (!member) continue;
        const members = [...beam.members, member];
        const score = scoreTeam(members, dataset, profile).total;
        next.push({members, score});
      }
    }
    beams = next
      .sort((a, b) => b.score - a.score)
      .filter((beam, index, all) => all.findIndex(other => other.members.map(member => member.stats.id).join('|') === beam.members.map(member => member.stats.id).join('|')) === index)
      .slice(0, beamWidth);
    if (!beams.length) break;
  }

  const best = beams[0] ?? {members: seedMembers, score: 0};
  const score = scoreTeam(best.members, dataset, profile);
  return attachInsights({
    members: best.members,
    score: {
      ...score,
      warnings: [...score.warnings, ...profile.warnings]
    },
    importable: formatTeam({members: best.members}),
    source: dataset.source
  }, dataset);
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- src/domain/generator.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/generator.ts src/domain/generator.test.ts
git commit -m "feat: generate teams with beam search"
```

---

### Task 9: Client API And Generator State

**Files:**
- Create: `src/data/api.ts`
- Create: `src/data/useGenerator.ts`
- Test: `src/data/api.test.ts`
- Test: `src/data/useGenerator.test.tsx`

- [ ] **Step 1: Write failing client data tests**

Create `src/data/api.test.ts`:

```ts
import {afterEach, describe, expect, it, vi} from 'vitest';
import {fetchStatsDataset, fetchStatsIndex} from './api';

afterEach(() => vi.restoreAllMocks());

describe('api client', () => {
  it('fetches the stats index', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({months: ['2026-03'], latestMonth: '2026-03', formats: []}))));
    await expect(fetchStatsIndex()).resolves.toMatchObject({latestMonth: '2026-03'});
  });

  it('throws readable API errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({message: 'Smogon unavailable'}), {status: 502})));
    await expect(fetchStatsDataset('2026-03', 'gen9ou', 1825)).rejects.toThrow('Smogon unavailable');
  });
});
```

Create `src/data/useGenerator.test.tsx`:

```tsx
import {renderHook, waitFor} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {makeDataset, makePokemon} from '../test/fixtures';
import {useGenerator} from './useGenerator';

afterEach(() => vi.restoreAllMocks());

describe('useGenerator', () => {
  it('loads index and generates a team', async () => {
    const dataset = makeDataset([
      makePokemon({id: 'greattusk', name: 'Great Tusk', usage: 30, moves: {rapidspin: 90}, abilities: {protosynthesis: 100}, items: {boosterenergy: 100}}),
      makePokemon({id: 'kingambit', name: 'Kingambit', usage: 29, moves: {suckerpunch: 90}, abilities: {supremeoverlord: 100}, items: {blackglasses: 100}}),
      makePokemon({id: 'gholdengo', name: 'Gholdengo', usage: 22, moves: {makeitrain: 90}, abilities: {goodasgold: 100}, items: {airballoon: 100}})
    ]);

    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/stats/index')) {
        return new Response(JSON.stringify({
          months: ['2026-03'],
          latestMonth: '2026-03',
          formats: [{id: 'gen91v1', name: 'Gen 9 1v1', month: '2026-03', cutoffs: [0]}]
        }));
      }
      return new Response(JSON.stringify(dataset));
    }));

    const {result} = renderHook(() => useGenerator());
    await waitFor(() => expect(result.current.index?.latestMonth).toBe('2026-03'));
    await result.current.generate();
    expect(result.current.team?.members.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/data/api.test.ts src/data/useGenerator.test.tsx`

Expected: FAIL because data modules do not exist.

- [ ] **Step 3: Implement API client**

Create `src/data/api.ts`:

```ts
import type {StatsDataset, StatsIndex} from '../domain/types';

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof body.message === 'string' ? body.message : `Request failed: ${response.status}`);
  }
  return body as T;
}

export function fetchStatsIndex(): Promise<StatsIndex> {
  return getJson<StatsIndex>('/api/stats/index');
}

export function fetchStatsDataset(month: string, format: string, cutoff: number): Promise<StatsDataset> {
  return getJson<StatsDataset>(`/api/stats/${month}/${format}/${cutoff}`);
}
```

- [ ] **Step 4: Implement generator hook**

Create `src/data/useGenerator.ts`:

```ts
import {useCallback, useEffect, useMemo, useState} from 'react';
import {generateTeam} from '../domain/generator';
import type {GeneratedTeam, StatsDataset, StatsIndex} from '../domain/types';
import {fetchStatsDataset, fetchStatsIndex} from './api';

export function useGenerator() {
  const [index, setIndex] = useState<StatsIndex | null>(null);
  const [dataset, setDataset] = useState<StatsDataset | null>(null);
  const [team, setTeam] = useState<GeneratedTeam | null>(null);
  const [month, setMonth] = useState('');
  const [format, setFormat] = useState('');
  const [cutoff, setCutoff] = useState(0);
  const [seeds, setSeeds] = useState<string[]>([]);
  const [archetype, setArchetype] = useState<'balanced' | 'offense' | 'bulky-offense' | 'stall' | 'weather' | 'trick-room'>('balanced');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchStatsIndex()
      .then(nextIndex => {
        setIndex(nextIndex);
        setMonth(nextIndex.latestMonth);
        const first = nextIndex.formats.find(item => item.month === nextIndex.latestMonth) ?? nextIndex.formats[0];
        if (first) {
          setFormat(first.id);
          setCutoff(first.cutoffs.at(-1) ?? 0);
        }
      })
      .catch(error => setError(error instanceof Error ? error.message : 'Unable to load stats index'));
  }, []);

  const selectedFormat = useMemo(
    () => index?.formats.find(item => item.id === format && item.month === month) ?? index?.formats.find(item => item.id === format),
    [format, index, month]
  );

  const generate = useCallback(async () => {
    if (!month || !format) return;
    setLoading(true);
    setError('');
    try {
      const nextDataset = await fetchStatsDataset(month, format, cutoff);
      setDataset(nextDataset);
      setTeam(generateTeam(nextDataset, format, {seeds, archetype, novelty: 0}));
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to generate team');
    } finally {
      setLoading(false);
    }
  }, [archetype, cutoff, format, month, seeds]);

  return {
    index,
    dataset,
    team,
    month,
    setMonth,
    format,
    setFormat,
    cutoff,
    setCutoff,
    seeds,
    setSeeds,
    archetype,
    setArchetype,
    selectedFormat,
    error,
    loading,
    generate
  };
}
```

- [ ] **Step 5: Run tests**

Run: `npm test -- src/data/api.test.ts src/data/useGenerator.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/data/api.ts src/data/api.test.ts src/data/useGenerator.ts src/data/useGenerator.test.tsx
git commit -m "feat: wire client data and generation state"
```

---

### Task 10: Generator Controls And App Layout

**Files:**
- Modify: `src/App.tsx`
- Create: `src/components/ControlRail.tsx`
- Create: `src/components/TeamBoard.tsx`
- Test: `src/App.test.tsx`

- [ ] **Step 1: Write failing app UI test**

Create `src/App.test.tsx`:

```tsx
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {App} from './App';
import {makeDataset, makePokemon} from './test/fixtures';

afterEach(() => vi.restoreAllMocks());

describe('App', () => {
  it('shows format controls and generates a team', async () => {
    const dataset = makeDataset([
      makePokemon({id: 'greattusk', name: 'Great Tusk', usage: 30, moves: {rapidspin: 90}, abilities: {protosynthesis: 100}, items: {boosterenergy: 100}}),
      makePokemon({id: 'kingambit', name: 'Kingambit', usage: 29, moves: {suckerpunch: 90}, abilities: {supremeoverlord: 100}, items: {blackglasses: 100}}),
      makePokemon({id: 'gholdengo', name: 'Gholdengo', usage: 22, moves: {makeitrain: 90}, abilities: {goodasgold: 100}, items: {airballoon: 100}})
    ]);

    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/stats/index')) {
        return new Response(JSON.stringify({
          months: ['2026-03'],
          latestMonth: '2026-03',
          formats: [{id: 'gen91v1', name: 'Gen 9 1v1', month: '2026-03', cutoffs: [0]}]
        }));
      }
      return new Response(JSON.stringify(dataset));
    }));

    render(<App />);
    expect(await screen.findByLabelText('Format')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: /generate team/i}));
    expect(await screen.findByText('Great Tusk')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/App.test.tsx`

Expected: FAIL because the current `App` shell has no controls.

- [ ] **Step 3: Implement control rail**

Create `src/components/ControlRail.tsx`:

```tsx
import {RefreshCcw} from 'lucide-react';
import type {FormatListing, StatsIndex} from '../domain/types';

type Archetype = 'balanced' | 'offense' | 'bulky-offense' | 'stall' | 'weather' | 'trick-room';

interface ControlRailProps {
  index: StatsIndex | null;
  month: string;
  setMonth: (month: string) => void;
  format: string;
  setFormat: (format: string) => void;
  cutoff: number;
  setCutoff: (cutoff: number) => void;
  archetype: Archetype;
  setArchetype: (archetype: Archetype) => void;
  selectedFormat?: FormatListing;
  loading: boolean;
  onGenerate: () => void;
}

export function ControlRail(props: ControlRailProps) {
  const formats = props.index?.formats ?? [];
  const cutoffs = props.selectedFormat?.cutoffs ?? [];
  return (
    <aside className="control-rail">
      <div>
        <p className="eyebrow">Builder</p>
        <h1>Smogon team generator</h1>
      </div>

      <label>
        Month
        <select value={props.month} onChange={event => props.setMonth(event.target.value)}>
          {(props.index?.months ?? []).map(month => <option key={month} value={month}>{month}</option>)}
        </select>
      </label>

      <label>
        Format
        <select value={props.format} onChange={event => props.setFormat(event.target.value)}>
          {formats.map(format => <option key={format.id} value={format.id}>{format.name}</option>)}
        </select>
      </label>

      <label>
        Rating cutoff
        <select value={props.cutoff} onChange={event => props.setCutoff(Number(event.target.value))}>
          {cutoffs.map(cutoff => <option key={cutoff} value={cutoff}>{cutoff}</option>)}
        </select>
      </label>

      <label>
        Archetype
        <select value={props.archetype} onChange={event => props.setArchetype(event.target.value as Archetype)}>
          <option value="balanced">Balanced optimal</option>
          <option value="offense">Offense</option>
          <option value="bulky-offense">Bulky offense</option>
          <option value="stall">Stall</option>
          <option value="weather">Weather</option>
          <option value="trick-room">Trick Room</option>
        </select>
      </label>

      <button className="primary-action" type="button" onClick={props.onGenerate} disabled={props.loading || !props.format}>
        <RefreshCcw size={16} aria-hidden="true" />
        {props.loading ? 'Generating...' : 'Generate team'}
      </button>
    </aside>
  );
}
```

- [ ] **Step 4: Implement team board shell and App wiring**

Create `src/components/TeamBoard.tsx`:

```tsx
import type {GeneratedTeam} from '../domain/types';

interface TeamBoardProps {
  team: GeneratedTeam | null;
}

export function TeamBoard({team}: TeamBoardProps) {
  if (!team) {
    return (
      <section className="team-board empty-team">
        <h2>No team generated yet</h2>
        <p>Choose a format and generate a team to see sets, roles, and explanations.</p>
      </section>
    );
  }

  return (
    <section className="team-board" aria-label="Generated team">
      {team.members.map(member => (
        <article className="pokemon-card" key={member.stats.id}>
          <h3>{member.stats.name}</h3>
          <p>{member.set.item}</p>
        </article>
      ))}
    </section>
  );
}
```

Modify `src/App.tsx`:

```tsx
import {ControlRail} from './components/ControlRail';
import {TeamBoard} from './components/TeamBoard';
import {useGenerator} from './data/useGenerator';

export function App() {
  const generator = useGenerator();

  return (
    <main className="app-layout">
      <ControlRail
        index={generator.index}
        month={generator.month}
        setMonth={generator.setMonth}
        format={generator.format}
        setFormat={generator.setFormat}
        cutoff={generator.cutoff}
        setCutoff={generator.setCutoff}
        archetype={generator.archetype}
        setArchetype={generator.setArchetype}
        selectedFormat={generator.selectedFormat}
        loading={generator.loading}
        onGenerate={generator.generate}
      />
      <TeamBoard team={generator.team} />
      {generator.error && <p className="error-banner" role="alert">{generator.error}</p>}
    </main>
  );
}
```

- [ ] **Step 5: Add layout CSS**

Append to `src/styles.css`:

```css
.app-layout {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 18px;
  min-height: 100vh;
  padding: 18px;
}

.control-rail,
.team-board {
  border: 1px solid #d9dee7;
  border-radius: 8px;
  background: #ffffff;
}

.control-rail {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 18px;
}

.control-rail h1 {
  margin: 0;
  font-size: 1.35rem;
}

.control-rail label {
  display: grid;
  gap: 6px;
  color: #4b5563;
  font-size: 0.86rem;
  font-weight: 700;
}

.control-rail select,
.primary-action {
  min-height: 40px;
  border: 1px solid #cfd6e2;
  border-radius: 7px;
  background: #ffffff;
  color: #111827;
}

.primary-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-color: #2563eb;
  background: #2563eb;
  color: #ffffff;
  font-weight: 800;
  cursor: pointer;
}

.team-board {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  align-content: start;
  padding: 18px;
}

.empty-team {
  display: flex;
  min-height: 320px;
  flex-direction: column;
  justify-content: center;
}

.pokemon-card {
  min-height: 120px;
  border: 1px solid #dfe5ee;
  border-radius: 8px;
  padding: 14px;
  background: #fbfcfe;
}

.pokemon-card h3 {
  margin: 0 0 6px;
}

.error-banner {
  position: fixed;
  right: 18px;
  bottom: 18px;
  max-width: 420px;
  padding: 12px 14px;
  border-radius: 8px;
  background: #991b1b;
  color: #ffffff;
}

@media (max-width: 860px) {
  .app-layout {
    grid-template-columns: 1fr;
  }

  .team-board {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 6: Run tests**

Run: `npm test -- src/App.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx src/App.test.tsx src/components/ControlRail.tsx src/components/TeamBoard.tsx src/styles.css
git commit -m "feat: add generator control layout"
```

---

### Task 11: Rich Team Cards, Sprites, And Insight Panel

**Files:**
- Create: `src/components/Sprite.tsx`
- Create: `src/components/PokemonCard.tsx`
- Create: `src/components/InsightPanel.tsx`
- Modify: `src/components/TeamBoard.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`
- Test: `src/components/Sprite.test.tsx`
- Test: `src/components/InsightPanel.test.tsx`

- [ ] **Step 1: Write failing component tests**

Create `src/components/Sprite.test.tsx`:

```tsx
import {render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {PokemonSprite} from './Sprite';

describe('PokemonSprite', () => {
  it('renders an image with accessible alt text', () => {
    render(<PokemonSprite name="Great Tusk" />);
    expect(screen.getByAltText('Great Tusk sprite')).toHaveAttribute('src');
  });
});
```

Create `src/components/InsightPanel.test.tsx`:

```tsx
import {render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {makeDataset, makePokemon} from '../test/fixtures';
import {generateTeam} from '../domain/generator';
import {InsightPanel} from './InsightPanel';

describe('InsightPanel', () => {
  it('shows importable text and score breakdown', () => {
    const dataset = makeDataset([
      makePokemon({id: 'greattusk', name: 'Great Tusk', moves: {rapidspin: 90}, abilities: {protosynthesis: 100}, items: {boosterenergy: 100}}),
      makePokemon({id: 'kingambit', name: 'Kingambit', moves: {suckerpunch: 90}, abilities: {supremeoverlord: 100}, items: {blackglasses: 100}}),
      makePokemon({id: 'gholdengo', name: 'Gholdengo', moves: {makeitrain: 90}, abilities: {goodasgold: 100}, items: {airballoon: 100}})
    ]);
    const team = generateTeam(dataset, 'gen91v1', {seeds: [], archetype: 'balanced', novelty: 0});

    render(<InsightPanel team={team} />);
    expect(screen.getByText('Showdown import')).toBeInTheDocument();
    expect(screen.getByText(/Total/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue(/Great Tusk/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/components/Sprite.test.tsx src/components/InsightPanel.test.tsx`

Expected: FAIL because components do not exist.

- [ ] **Step 3: Implement sprite and card components**

Create `src/components/Sprite.tsx`:

```tsx
import {Sprites} from '@pkmn/img';

interface PokemonSpriteProps {
  name: string;
}

export function PokemonSprite({name}: PokemonSpriteProps) {
  const sprite = Sprites.getPokemon(name, {gen: 'gen5ani'});
  return (
    <img
      className="pokemon-sprite"
      src={sprite.url}
      width={sprite.w}
      height={sprite.h}
      alt={`${name} sprite`}
      style={{imageRendering: sprite.pixelated ? 'pixelated' : 'auto'}}
    />
  );
}
```

Create `src/components/PokemonCard.tsx`:

```tsx
import {Lock, RefreshCcw} from 'lucide-react';
import type {TeamMember} from '../domain/types';
import {PokemonSprite} from './Sprite';

interface PokemonCardProps {
  member: TeamMember;
}

function roleLabels(member: TeamMember): string[] {
  const roles = member.set.roles;
  return Object.entries(roles)
    .filter(([, value]) => value > 0.55)
    .slice(0, 4)
    .map(([role]) => role.replace(/[A-Z]/g, letter => ` ${letter.toLowerCase()}`));
}

export function PokemonCard({member}: PokemonCardProps) {
  return (
    <article className="pokemon-card">
      <div className="card-topline">
        <PokemonSprite name={member.stats.name} />
        <div>
          <h3>{member.stats.name}</h3>
          <p>{member.set.item} · {member.set.ability}</p>
        </div>
      </div>
      <div className="role-list">
        {roleLabels(member).map(role => <span key={role}>{role}</span>)}
      </div>
      <ol className="move-list">
        {member.set.moves.map(move => <li key={move}>{move}</li>)}
      </ol>
      <div className="card-actions">
        <button type="button" aria-label={`Lock ${member.stats.name}`}><Lock size={15} /></button>
        <button type="button" aria-label={`Replace ${member.stats.name}`}><RefreshCcw size={15} /></button>
      </div>
    </article>
  );
}
```

Modify `src/components/TeamBoard.tsx`:

```tsx
import type {GeneratedTeam} from '../domain/types';
import {PokemonCard} from './PokemonCard';

interface TeamBoardProps {
  team: GeneratedTeam | null;
}

export function TeamBoard({team}: TeamBoardProps) {
  if (!team) {
    return (
      <section className="team-board empty-team">
        <h2>No team generated yet</h2>
        <p>Choose a format and generate a team to see sets, roles, and explanations.</p>
      </section>
    );
  }

  return (
    <section className="team-board" aria-label="Generated team">
      {team.members.map(member => <PokemonCard key={member.stats.id} member={member} />)}
    </section>
  );
}
```

- [ ] **Step 4: Implement insight panel**

Create `src/components/InsightPanel.tsx`:

```tsx
import type {GeneratedTeam} from '../domain/types';

interface InsightPanelProps {
  team: GeneratedTeam | null;
}

export function InsightPanel({team}: InsightPanelProps) {
  if (!team) {
    return (
      <aside className="insight-panel">
        <h2>Team insights</h2>
        <p>Generate a team to see threat coverage, synergy, and Showdown import text.</p>
      </aside>
    );
  }

  const scoreRows = Object.entries(team.score)
    .filter(([key, value]) => key !== 'warnings' && typeof value === 'number');

  return (
    <aside className="insight-panel">
      <section>
        <h2>Score</h2>
        <dl className="score-list">
          {scoreRows.map(([key, value]) => (
            <div key={key}>
              <dt>{key === 'total' ? 'Total' : key}</dt>
              <dd>{Number(value).toFixed(1)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <h2>Threat coverage</h2>
        <ul className="threat-list">
          {team.threats.slice(0, 8).map(threat => (
            <li key={threat.threatId} className={threat.covered ? 'covered' : 'uncovered'}>
              <span>{threat.threatName}</span>
              <strong>{threat.covered ? threat.answers[0]?.pokemonName : 'Open'}</strong>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Showdown import</h2>
        <textarea readOnly value={team.importable} aria-label="Showdown importable team" />
      </section>
    </aside>
  );
}
```

Modify `src/App.tsx`:

```tsx
import {ControlRail} from './components/ControlRail';
import {InsightPanel} from './components/InsightPanel';
import {TeamBoard} from './components/TeamBoard';
import {useGenerator} from './data/useGenerator';

export function App() {
  const generator = useGenerator();

  return (
    <main className="app-layout">
      <ControlRail
        index={generator.index}
        month={generator.month}
        setMonth={generator.setMonth}
        format={generator.format}
        setFormat={generator.setFormat}
        cutoff={generator.cutoff}
        setCutoff={generator.setCutoff}
        archetype={generator.archetype}
        setArchetype={generator.setArchetype}
        selectedFormat={generator.selectedFormat}
        loading={generator.loading}
        onGenerate={generator.generate}
      />
      <TeamBoard team={generator.team} />
      <InsightPanel team={generator.team} />
      {generator.error && <p className="error-banner" role="alert">{generator.error}</p>}
    </main>
  );
}
```

- [ ] **Step 5: Add card and panel CSS**

Append to `src/styles.css`:

```css
.app-layout {
  grid-template-columns: 280px minmax(0, 1fr) 340px;
}

.insight-panel {
  display: grid;
  gap: 16px;
  align-content: start;
  border: 1px solid #d9dee7;
  border-radius: 8px;
  padding: 18px;
  background: #ffffff;
}

.insight-panel h2 {
  margin: 0 0 10px;
  font-size: 1rem;
}

.card-topline {
  display: grid;
  grid-template-columns: 64px 1fr;
  gap: 10px;
  align-items: center;
}

.pokemon-sprite {
  max-width: 64px;
  max-height: 64px;
  object-fit: contain;
}

.role-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 10px 0;
}

.role-list span {
  border-radius: 999px;
  padding: 3px 7px;
  background: #e0f2fe;
  color: #075985;
  font-size: 0.75rem;
  font-weight: 700;
}

.move-list {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px 12px;
  margin: 10px 0 0;
  padding-left: 18px;
  color: #374151;
  font-size: 0.86rem;
}

.card-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.card-actions button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: 1px solid #d5dce8;
  border-radius: 7px;
  background: #ffffff;
  cursor: pointer;
}

.score-list {
  display: grid;
  gap: 6px;
  margin: 0;
}

.score-list div,
.threat-list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.score-list dt,
.score-list dd {
  margin: 0;
}

.threat-list {
  display: grid;
  gap: 7px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.covered strong {
  color: #047857;
}

.uncovered strong {
  color: #b91c1c;
}

.insight-panel textarea {
  width: 100%;
  min-height: 240px;
  resize: vertical;
  border: 1px solid #cfd6e2;
  border-radius: 8px;
  padding: 10px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.8rem;
}

@media (max-width: 1180px) {
  .app-layout {
    grid-template-columns: 260px minmax(0, 1fr);
  }

  .insight-panel {
    grid-column: 1 / -1;
  }
}
```

- [ ] **Step 6: Run tests**

Run: `npm test -- src/components/Sprite.test.tsx src/components/InsightPanel.test.tsx src/App.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components src/App.tsx src/styles.css
git commit -m "feat: show rich team insights"
```

---

### Task 12: Interaction Polish, Locks, And Replacement Hooks

**Files:**
- Modify: `src/data/useGenerator.ts`
- Modify: `src/components/PokemonCard.tsx`
- Modify: `src/components/TeamBoard.tsx`
- Test: `src/data/useGenerator.test.tsx`

- [ ] **Step 1: Add failing lock/regenerate test**

Modify `src/data/useGenerator.test.tsx` with this additional test:

```tsx
it('locks a generated slot and preserves it on regenerate', async () => {
  const dataset = makeDataset([
    makePokemon({id: 'greattusk', name: 'Great Tusk', usage: 30, moves: {rapidspin: 90}, abilities: {protosynthesis: 100}, items: {boosterenergy: 100}}),
    makePokemon({id: 'kingambit', name: 'Kingambit', usage: 29, moves: {suckerpunch: 90}, abilities: {supremeoverlord: 100}, items: {blackglasses: 100}}),
    makePokemon({id: 'gholdengo', name: 'Gholdengo', usage: 22, moves: {makeitrain: 90}, abilities: {goodasgold: 100}, items: {airballoon: 100}})
  ]);

  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    if (String(input).endsWith('/api/stats/index')) {
      return new Response(JSON.stringify({
        months: ['2026-03'],
        latestMonth: '2026-03',
        formats: [{id: 'gen91v1', name: 'Gen 9 1v1', month: '2026-03', cutoffs: [0]}]
      }));
    }
    return new Response(JSON.stringify(dataset));
  }));

  const {result} = renderHook(() => useGenerator());
  await waitFor(() => expect(result.current.index).not.toBeNull());
  await result.current.generate();
  const lockedId = result.current.team!.members[0].stats.id;
  result.current.toggleLock(lockedId);
  await result.current.generate();
  expect(result.current.team!.members.some(member => member.stats.id === lockedId && member.locked)).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/data/useGenerator.test.tsx`

Expected: FAIL because `toggleLock` does not exist.

- [ ] **Step 3: Implement locked member state**

Modify `src/data/useGenerator.ts`:

```ts
import {useCallback, useEffect, useMemo, useState} from 'react';
import {generateTeam} from '../domain/generator';
import type {GeneratedTeam, StatsDataset, StatsIndex, TeamMember} from '../domain/types';
import {fetchStatsDataset, fetchStatsIndex} from './api';

export function useGenerator() {
  const [index, setIndex] = useState<StatsIndex | null>(null);
  const [dataset, setDataset] = useState<StatsDataset | null>(null);
  const [team, setTeam] = useState<GeneratedTeam | null>(null);
  const [lockedMembers, setLockedMembers] = useState<TeamMember[]>([]);
  const [month, setMonth] = useState('');
  const [format, setFormat] = useState('');
  const [cutoff, setCutoff] = useState(0);
  const [seeds, setSeeds] = useState<string[]>([]);
  const [archetype, setArchetype] = useState<'balanced' | 'offense' | 'bulky-offense' | 'stall' | 'weather' | 'trick-room'>('balanced');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchStatsIndex()
      .then(nextIndex => {
        setIndex(nextIndex);
        setMonth(nextIndex.latestMonth);
        const first = nextIndex.formats.find(item => item.month === nextIndex.latestMonth) ?? nextIndex.formats[0];
        if (first) {
          setFormat(first.id);
          setCutoff(first.cutoffs.at(-1) ?? 0);
        }
      })
      .catch(error => setError(error instanceof Error ? error.message : 'Unable to load stats index'));
  }, []);

  const selectedFormat = useMemo(
    () => index?.formats.find(item => item.id === format && item.month === month) ?? index?.formats.find(item => item.id === format),
    [format, index, month]
  );

  const generate = useCallback(async () => {
    if (!month || !format) return;
    setLoading(true);
    setError('');
    try {
      const nextDataset = dataset ?? await fetchStatsDataset(month, format, cutoff);
      setDataset(nextDataset);
      const lockedSeeds = lockedMembers.map(member => member.stats.id);
      const nextTeam = generateTeam(nextDataset, format, {seeds: [...lockedSeeds, ...seeds], lockedMembers, archetype, novelty: 0});
      nextTeam.members = nextTeam.members.map(member => lockedSeeds.includes(member.stats.id) ? {...member, locked: true} : member);
      setTeam(nextTeam);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to generate team');
    } finally {
      setLoading(false);
    }
  }, [archetype, cutoff, dataset, format, lockedMembers, month, seeds]);

  const toggleLock = useCallback((pokemonId: string) => {
    setLockedMembers(current => {
      if (current.some(member => member.stats.id === pokemonId)) {
        return current.filter(member => member.stats.id !== pokemonId);
      }
      const member = team?.members.find(member => member.stats.id === pokemonId);
      return member ? [...current, {...member, locked: true}] : current;
    });
  }, [team]);

  return {
    index,
    dataset,
    team,
    month,
    setMonth,
    format,
    setFormat,
    cutoff,
    setCutoff,
    seeds,
    setSeeds,
    archetype,
    setArchetype,
    selectedFormat,
    error,
    loading,
    generate,
    toggleLock
  };
}
```

- [ ] **Step 4: Wire lock buttons**

Modify `src/components/PokemonCard.tsx`:

```tsx
import {Lock, LockOpen, RefreshCcw} from 'lucide-react';
import type {TeamMember} from '../domain/types';
import {PokemonSprite} from './Sprite';

interface PokemonCardProps {
  member: TeamMember;
  onToggleLock: (pokemonId: string) => void;
}

function roleLabels(member: TeamMember): string[] {
  const roles = member.set.roles;
  return Object.entries(roles)
    .filter(([, value]) => value > 0.55)
    .slice(0, 4)
    .map(([role]) => role.replace(/[A-Z]/g, letter => ` ${letter.toLowerCase()}`));
}

export function PokemonCard({member, onToggleLock}: PokemonCardProps) {
  return (
    <article className={`pokemon-card ${member.locked ? 'locked' : ''}`}>
      <div className="card-topline">
        <PokemonSprite name={member.stats.name} />
        <div>
          <h3>{member.stats.name}</h3>
          <p>{member.set.item} · {member.set.ability}</p>
        </div>
      </div>
      <div className="role-list">
        {roleLabels(member).map(role => <span key={role}>{role}</span>)}
      </div>
      <ol className="move-list">
        {member.set.moves.map(move => <li key={move}>{move}</li>)}
      </ol>
      <div className="card-actions">
        <button type="button" aria-label={`${member.locked ? 'Unlock' : 'Lock'} ${member.stats.name}`} onClick={() => onToggleLock(member.stats.id)}>
          {member.locked ? <Lock size={15} /> : <LockOpen size={15} />}
        </button>
        <button type="button" aria-label={`Replace ${member.stats.name}`}><RefreshCcw size={15} /></button>
      </div>
    </article>
  );
}
```

Modify `src/components/TeamBoard.tsx`:

```tsx
import type {GeneratedTeam} from '../domain/types';
import {PokemonCard} from './PokemonCard';

interface TeamBoardProps {
  team: GeneratedTeam | null;
  onToggleLock: (pokemonId: string) => void;
}

export function TeamBoard({team, onToggleLock}: TeamBoardProps) {
  if (!team) {
    return (
      <section className="team-board empty-team">
        <h2>No team generated yet</h2>
        <p>Choose a format and generate a team to see sets, roles, and explanations.</p>
      </section>
    );
  }

  return (
    <section className="team-board" aria-label="Generated team">
      {team.members.map(member => <PokemonCard key={member.stats.id} member={member} onToggleLock={onToggleLock} />)}
    </section>
  );
}
```

Modify `src/App.tsx` so the team board receives the lock handler:

```tsx
<TeamBoard team={generator.team} onToggleLock={generator.toggleLock} />
```

- [ ] **Step 5: Run tests**

Run: `npm test -- src/data/useGenerator.test.tsx src/App.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/data/useGenerator.ts src/data/useGenerator.test.tsx src/components/PokemonCard.tsx src/components/TeamBoard.tsx src/App.tsx
git commit -m "feat: preserve locked team slots"
```

---

### Task 13: Visual Design Pass And Responsive Polish

**Files:**
- Modify: `src/styles.css`
- Modify: `src/components/ControlRail.tsx`
- Modify: `src/components/TeamBoard.tsx`
- Modify: `src/components/InsightPanel.tsx`

- [ ] **Step 1: Generate UI concept before visual coding**

Use `build-web-apps:frontend-app-builder` and `imagegen` to generate one accepted layout concept for a dense, calm competitive Pokemon team-generation tool. The accepted concept must preserve these structural elements:

```text
Left rail: format/month/cutoff/archetype/seed controls and generate button.
Center: six team slots with sprites, moves, role chips, lock/replace controls.
Right panel: score, threat coverage, synergy, warnings, Showdown import text.
Style: compact Showdown companion, restrained palette, type-color accents, no marketing hero.
```

Expected: one accepted concept path is recorded in the implementation notes for final reporting.

- [ ] **Step 2: Apply the visual system in CSS**

Modify `src/styles.css` to match the accepted concept while preserving these constraints:

```css
.app-layout {
  width: 100%;
  min-height: 100vh;
}

.control-rail,
.team-board,
.insight-panel,
.pokemon-card {
  border-radius: 8px;
}

.primary-action:focus-visible,
.card-actions button:focus-visible,
.control-rail select:focus-visible,
.insight-panel textarea:focus-visible {
  outline: 3px solid #93c5fd;
  outline-offset: 2px;
}
```

Use type colors only for chips and semantic accents. Keep the page from becoming a single-hue blue, purple, beige, brown, or dark-slate theme.

- [ ] **Step 3: Verify responsive behavior with component tests**

Run: `npm test -- src/App.test.tsx src/components/Sprite.test.tsx src/components/InsightPanel.test.tsx`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/styles.css src/components/ControlRail.tsx src/components/TeamBoard.tsx src/components/InsightPanel.tsx
git commit -m "style: polish team generator interface"
```

---

### Task 14: End-To-End Verification And Browser QA

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-04-24-team-generator-implementation.md` only if verification discovers a plan correction during execution.

- [ ] **Step 1: Create README usage instructions**

Create `README.md`:

```md
# Smogon Stats Team Generator

A multi-format Pokemon team generator powered by Smogon usage stats, checks and counters, teammate data, and format-aware role scoring.

## Run Locally

```bash
npm install
npm run dev
```

Open the Vite URL printed by the terminal, usually `http://127.0.0.1:5173`.

## What The Generator Uses

- Smogon monthly stats index for available months, formats, and cutoffs.
- Smogon chaos JSON for usage, sets, teammate data, and checks/counters.
- Singles role weights prioritize hazards, removal, item disruption, and defensive/offensive sequencing.
- Doubles role weights prioritize speed control, positioning, board control, and spread pressure.
- Set choices are team-contextual, so the generator penalizes low-value repeated roles like excessive singles hazard setters.
```

- [ ] **Step 2: Run the full automated suite**

Run: `npm test`

Expected: PASS for all unit and component tests.

Run: `npm run build`

Expected: PASS with a Vite production build.

- [ ] **Step 3: Run the app locally**

Run: `npm run dev`

Expected: Vite serves the client on `http://127.0.0.1:5173` and Express serves the API on `http://127.0.0.1:8787`.

- [ ] **Step 4: Browser verification**

Use the Browser plugin against `http://127.0.0.1:5173`.

Verify:

```text
Desktop viewport:
- Format/month/cutoff controls load from Smogon.
- Generate team creates a full team for Gen 9 OU.
- Generate team creates a doubles team for Gen 9 Doubles OU when selected.
- Locking a slot and regenerating preserves that Pokemon.
- Showdown import text updates and is selectable.
- Threat coverage and score sections are visible.
- Sprites load and do not overlap controls.

Mobile viewport:
- Controls, team cards, and insight panel stack in a usable order.
- Text does not overflow buttons, cards, or panels.
- Import textarea remains reachable.
```

Expected: no blank screens, no console-breaking runtime errors, no incoherent overlap, and core workflow works.

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: add local usage instructions"
```

---

## Self-Review Notes

- Spec coverage: the plan covers multi-format discovery, chaos parsing, `@pkmn` data/sprite usage, singles/doubles role differences, team-contextual set construction, beam-search generation, explanations, threat coverage, Showdown import output, caching, tests, and browser verification.
- Scope held: saved teams, simulator validation, account features, and deeper archetype modeling are excluded from v1.
- Type consistency: core names are `StatsIndex`, `FormatProfile`, `PokemonStats`, `SetCandidate`, `TeamMember`, `GeneratedTeam`, `scoreTeam`, `generateTeam`, and `formatTeam` throughout the plan.
