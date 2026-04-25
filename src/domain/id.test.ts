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
