import { describe, it, expect } from 'vitest';
import { getSampleSuggestions } from '../../src/services/sampleSuggestionService';
import type { LibraryTrack } from '../../src/types/music';

function lt(p: Partial<LibraryTrack> & Pick<LibraryTrack, 'id' | 'name' | 'fileKey'>): LibraryTrack {
  return {
    genre: 'test',
    duration: 60,
    type: 'mp3',
    size: '1MB',
    tags: [],
    bpm: 120,
    ...p,
  } as LibraryTrack;
}

describe('getSampleSuggestions', () => {
  it('ranks exact key + tempo highest', () => {
    const lib = [
      lt({ id: 'a', name: 'A', fileKey: 'k/a.mp3', bpm: 120, key: 'Am' }),
      lt({ id: 'b', name: 'B', fileKey: 'k/b.mp3', bpm: 140, key: 'Cm' }),
    ];
    const r = getSampleSuggestions(lib, { key: 'Am', bpm: 120 });
    expect(r[0]?.track.id).toBe('a');
    expect(r[0]?.adjustmentLine).toContain('Matches key');
    expect(r[0]?.adjustmentLine).toContain('Tempo match');
  });

  it('excludes reference library track by id', () => {
    const lib = [
      lt({ id: 'same', name: 'Same', fileKey: 'k/s.mp3', bpm: 120, key: 'C' }),
      lt({ id: 'other', name: 'Other', fileKey: 'k/o.mp3', bpm: 120, key: 'C' }),
    ];
    const r = getSampleSuggestions(lib, {
      key: 'C',
      bpm: 120,
      excludeTrackId: 'same',
    });
    expect(r.every((s) => s.track.id !== 'same')).toBe(true);
    expect(r.length).toBeGreaterThan(0);
  });

  it('returns empty when no usable library metadata', () => {
    const lib = [lt({ id: 'x', name: 'X', fileKey: 'k/x.mp3', bpm: 0, key: undefined })];
    const r = getSampleSuggestions(lib, { key: 'C', bpm: 120 });
    expect(r).toEqual([]);
  });
});
