export const SAVED_SESSIONS_KEY = 'audafact_savedSessions';
export const SAVED_SESSIONS_MIGRATION_FLAG = 'audafact_savedSessions_migrated_v1';

/** Legacy global keys (pre–per-account scoping); migrated once into the active scope. */
export const LEGACY_PERFORMANCES_KEY = 'audafact_performances';
export const LEGACY_AUDIO_RECORDINGS_KEY = 'audafact_audioRecordings';
export const LOCAL_RECORDINGS_MIGRATION_FLAG = 'audafact_local_recordings_migrated_v1';

export const getSessionScope = (userId?: string | null): string => userId ? `user:${userId}` : 'guest';
export const getScopedSavedSessionsKey = (scope: string): string => `${SAVED_SESSIONS_KEY}:${scope}`;
export const getScopedPerformancesKey = (scope: string): string => `${LEGACY_PERFORMANCES_KEY}:${scope}`;
export const getScopedAudioRecordingsKey = (scope: string): string => `${LEGACY_AUDIO_RECORDINGS_KEY}:${scope}`;

/**
 * One-time: move unscoped performances / audio blobs into the current scope, then delete globals.
 * Same pattern as saved sessions (first active scope after upgrade keeps legacy data).
 */
export const migrateLegacyLocalRecordings = (
  storage: Storage,
  performancesScopedKey: string,
  audioScopedKey: string,
): void => {
  if (storage.getItem(LOCAL_RECORDINGS_MIGRATION_FLAG) === 'true') return;

  const legacyPerf = storage.getItem(LEGACY_PERFORMANCES_KEY);
  const legacyAudio = storage.getItem(LEGACY_AUDIO_RECORDINGS_KEY);

  if (legacyPerf && !storage.getItem(performancesScopedKey)) {
    storage.setItem(performancesScopedKey, legacyPerf);
  }
  if (legacyAudio && !storage.getItem(audioScopedKey)) {
    storage.setItem(audioScopedKey, legacyAudio);
  }

  storage.removeItem(LEGACY_PERFORMANCES_KEY);
  storage.removeItem(LEGACY_AUDIO_RECORDINGS_KEY);
  storage.setItem(LOCAL_RECORDINGS_MIGRATION_FLAG, 'true');
};

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
