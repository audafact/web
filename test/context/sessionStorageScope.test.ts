import { describe, it, expect, beforeEach } from 'vitest';
import {
  getSessionScope,
  getScopedSavedSessionsKey,
  migrateLegacySavedSessions,
  parseStoredArray,
  SAVED_SESSIONS_KEY,
  SAVED_SESSIONS_MIGRATION_FLAG,
  mergeSessionsById,
} from '../../src/context/sessionStorageScope';

describe('sessionStorageScope', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('builds user and guest scopes correctly', () => {
    expect(getSessionScope('user-a')).toBe('user:user-a');
    expect(getSessionScope(null)).toBe('guest');
  });

  it('builds scoped savedSessions key correctly', () => {
    expect(getScopedSavedSessionsKey('user:user-a')).toBe('audafact_savedSessions:user:user-a');
  });

  it('parses only array payloads from storage', () => {
    expect(parseStoredArray(localStorage.getItem('missing'))).toEqual([]);
    expect(parseStoredArray('{"not":"array"}')).toEqual([]);
    expect(parseStoredArray('[{"id":"a"}]')).toEqual([{ id: 'a' }]);
    expect(parseStoredArray('invalid json')).toEqual([]);
  });

  it('migrates legacy saved sessions once into current scope', () => {
    const scopedKey = getScopedSavedSessionsKey('user:user-a');
    localStorage.setItem(SAVED_SESSIONS_KEY, JSON.stringify([{ id: 'legacy' }]));

    migrateLegacySavedSessions(localStorage, scopedKey);

    expect(localStorage.getItem(SAVED_SESSIONS_KEY)).toBeNull();
    expect(localStorage.getItem(SAVED_SESSIONS_MIGRATION_FLAG)).toBe('true');
    expect(localStorage.getItem(scopedKey)).toContain('legacy');
  });

  it('does not overwrite scoped data when migrating', () => {
    const scopedKey = getScopedSavedSessionsKey('user:user-a');
    localStorage.setItem(scopedKey, JSON.stringify([{ id: 'scoped' }]));
    localStorage.setItem(SAVED_SESSIONS_KEY, JSON.stringify([{ id: 'legacy' }]));

    migrateLegacySavedSessions(localStorage, scopedKey);

    expect(localStorage.getItem(scopedKey)).toContain('scoped');
    expect(localStorage.getItem(scopedKey)).not.toContain('legacy');
  });

  it('merges db sessions with local-only sessions by id', () => {
    const dbSessions = [{ id: 'db-1' }, { id: 'db-2' }];
    const localSessions = [{ id: 'db-2' }, { id: 'local-1' }];

    const merged = mergeSessionsById(dbSessions, localSessions);

    expect(merged).toEqual([{ id: 'db-1' }, { id: 'db-2' }, { id: 'local-1' }]);
  });
});
