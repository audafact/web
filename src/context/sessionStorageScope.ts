export const SAVED_SESSIONS_KEY = 'audafact_savedSessions';
export const SAVED_SESSIONS_MIGRATION_FLAG = 'audafact_savedSessions_migrated_v1';

export const getSessionScope = (userId?: string | null): string => userId ? `user:${userId}` : 'guest';
export const getScopedSavedSessionsKey = (scope: string): string => `${SAVED_SESSIONS_KEY}:${scope}`;

export const parseStoredArray = <T>(raw: string | null): T[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const migrateLegacySavedSessions = (storage: Storage, scopedKey: string): void => {
  const migrationCompleted = storage.getItem(SAVED_SESSIONS_MIGRATION_FLAG) === 'true';
  const scopedRaw = storage.getItem(scopedKey);

  if (!migrationCompleted) {
    const legacyRaw = storage.getItem(SAVED_SESSIONS_KEY);
    if (!scopedRaw && legacyRaw) {
      storage.setItem(scopedKey, legacyRaw);
    }
    storage.removeItem(SAVED_SESSIONS_KEY);
    storage.setItem(SAVED_SESSIONS_MIGRATION_FLAG, 'true');
  }
};

export const mergeSessionsById = <T extends { id: string }>(dbSessions: T[], localSessions: T[]): T[] => {
  const dbIds = new Set(dbSessions.map((session) => session.id));
  const localOnly = localSessions.filter((session) => !dbIds.has(session.id));
  return [...dbSessions, ...localOnly];
};
