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
