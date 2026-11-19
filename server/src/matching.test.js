import { describe, expect, it } from 'vitest';
import { rankMatches } from './matching.js';

describe('rankMatches', () => {
  it('ranks candidates using category, location, and item details', () => {
    const source = { title: 'Blue Samsung phone', description: 'Cracked case with sticker', category: 'Electronics', location: 'Central Library' };
    const close = { title: 'Samsung phone with blue case', description: 'Sticker on cracked case', category: 'Electronics', location: 'Library entrance' };
    const distant = { title: 'Novel', description: 'Hardcover book', category: 'Books', location: 'Sports field' };

    const matches = rankMatches(source, [distant, close]);

    expect(matches).toHaveLength(1);
    expect(matches[0].item).toBe(close);
    expect(matches[0].score).toBeGreaterThanOrEqual(25);
    expect(matches[0].reasons).toEqual(expect.arrayContaining(['Same category', 'Similar campus location', 'Similar item details']));
  });

  it('limits returned suggestions', () => {
    const source = { title: 'Blue wallet', description: '', category: 'Accessories', location: 'Library' };
    const candidates = Array.from({ length: 8 }, (_, index) => ({ title: `Blue wallet ${index}`, description: '', category: 'Accessories', location: 'Library' }));

    expect(rankMatches(source, candidates, 3)).toHaveLength(3);
  });
});
