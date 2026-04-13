import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
  useLayoutEffect,
} from 'react';
import { DatabaseService } from '../services/databaseService';
import { useAnalytics } from '../hooks/useAnalytics';
import { getNumericLimitsForDbTier } from '../config/tierConfig';
import { Recording, Session } from '../types/music';
import {
  PERFORMANCE_EVENT_SCHEMA_VERSION,
  NewPerformanceEvent,
  parsePerformanceEvents,
  PerformanceEvent,
  clonePerformanceEventsForDb,
} from '../types/performanceEvents';
import { StorageService } from '../services/storageService';
import { useAuth } from './AuthContext';
import { supabase } from '../services/supabase';
import { ensureStereo, convertToWav, convertToMp3, downloadBlob } from '../lib/audioExport';
import { getSignedUrl } from '../lib/storage';
import { deleteByKey } from '../lib/storage';
import {
  getSessionScope,
  getScopedSavedSessionsKey,
  getScopedPerformancesKey,
  getScopedAudioRecordingsKey,
  mergeSessionsById,
  migrateLegacySavedSessions,
  migrateLegacyLocalRecordings,
  parseStoredArray,
} from './sessionStorageScope';
import { schedulePerformanceEventsPass } from '../lib/performancePlaybackSchedule';
import { exposeAdvancedPerformanceUi } from '../config/featureFlags';

type RecordingEvent = PerformanceEvent;

interface RecordingSessionEvent {
  timestamp: number;
  type: string;
  trackId: string;
  data: unknown;
}

interface RecordingSession {
  id: string;
  startTime: number;
  endTime?: number;
  events: RecordingSessionEvent[];
  tracks: string[];
  duration: number;
  session_name?: string;
}

interface Performance {
  id: string;
  startTime: number;
  endTime?: number;
  events: RecordingEvent[];
  tracks: string[];
  duration: number;
  audioBlob?: Blob; // Add audio blob to performances
  databaseId?: string; // Database recording ID if saved to database
  fileKey?: string; // R2 key for playback when blob unavailable (e.g. after refresh)
  eventSchemaVersion?: number;
  /** Loop cycle length (defaults to duration); used for modulo overdub playback */
  cycleLengthMs?: number;
}

interface AudioRecording {
  id: string;
  startTime: number;
  endTime?: number;
  audioBlob?: Blob;
  tracks: string[];
  duration: number;
  tempo: number;
  countInBeats: number;
  events: RecordingEvent[]; // Add events to audio recordings
}

interface RecordingContextValue {
  // Performance recording
  isRecordingPerformance: boolean;
  currentPerformance: Performance | null;
  performances: Performance[];
  startPerformanceRecording: (
    appAudioContext?: AudioContext,
    options?: { recordEvents?: boolean; recordMix?: boolean; continueOverdub?: boolean }
  ) => void;
  stopPerformanceRecording: () => void;
  addRecordingEvent: (event: NewPerformanceEvent) => void;
  getRecordingDestination: () => MediaStreamAudioDestinationNode | null;
  registerStudioAudioContext: (ctx: AudioContext | null) => void;
  /** Tracks in this set are excluded from event recording (empty = all tracks record) */
  unarmedRecordingTrackIds: string[];
  toggleRecordingArmForTrack: (trackId: string) => void;
  clearRecordingArmExclusions: () => void;
  startPerformancePlayback: (
    performanceId: string,
    options?: {
      loop?: boolean;
      audioContext?: AudioContext | null;
      /** Play master mix under event replay (default false; avoids double playback) */
      referenceAudio?: boolean;
      /** Play stored mix only; no event dispatch */
      referenceOnly?: boolean;
      trackIdFilter?: string | null;
    }
  ) => Promise<void>;
  startReferenceOnlyPlayback: (performanceId: string, options?: { loop?: boolean }) => Promise<void>;
  startLanePlayback: (performanceId: string, trackId: string, options?: { loop?: boolean }) => Promise<void>;
  stopPerformancePlayback: () => void;
  playingPerformanceId: string | null;
  engagedTrackIds: string[];
  setTrackEngaged: (trackId: string, engaged: boolean) => void;
  isPerformanceLoopEnabled: boolean;
  isOverdubEnabled: boolean;
  setOverdubEnabled: (enabled: boolean) => void;
  recordEventsEnabled: boolean;
  setRecordEventsEnabled: (v: boolean) => void;
  recordMixEnabled: boolean;
  setRecordMixEnabled: (v: boolean) => void;
  /**
   * True once any deck has started playback during the current mix capture session.
   * Used for UI: "Ready" vs actively recording when event count stays at 0 (e.g. mix-only / simple mode).
   */
  mixRecordingHasPlayback: boolean;
  /** Call from Studio when a track begins playback while mix recording is armed. Idempotent until the next session. */
  signalMixRecordingPlayback: () => void;

  // Audio recording
  isRecordingAudio: boolean;
  currentAudioRecording: AudioRecording | null;
  audioRecordings: AudioRecording[];
  startAudioRecording: (tempo: number, countInBeats?: number) => void;
  stopAudioRecording: () => void;
  
  // Sessions (state snapshots)
  savedSessions: RecordingSession[];
  saveCurrentState: (studioState: any) => void;
  
  // Management
  clearAll: () => void;
  exportPerformance: (performanceId: string, options?: { filename?: string; format: 'mp3' | 'wav' }) => void;
  exportByFileKey: (fileKey: string, filename: string, format: 'mp3' | 'wav', recordingId?: string) => Promise<void>;
  savePerformanceName: (performanceId: string, filename: string) => Promise<void>;
  updateRecordingName: (recordingId: string, filename: string) => Promise<void>;
  exportSession: (sessionId: string) => void;
  exportAudioRecording: (recordingId: string) => void;
  deletePerformance: (performanceId: string, options?: { fileKey?: string }) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  renameSession: (sessionId: string, newName: string) => Promise<void>;
  deleteAudioRecording: (recordingId: string) => Promise<void>;
  pendingExport: { performanceId: string; canSave: boolean } | null;
  clearPendingExport: () => void;
  pendingSession: { sessionId: string } | null;
  clearPendingSession: () => void;
  discardPerformance: (performanceId: string) => void;
  savedRecordings: Recording[];
  refreshSavedRecordings: () => Promise<void>;
  deleteSavedRecording: (recordingId: string, options?: { fileKey?: string }) => Promise<void>;
  exportSharedSessionBundle: (sessionId: string, options?: { performanceId?: string }) => void;
  importSharedSessionBundle: (bundle: unknown) => { sessionId?: string; performanceId?: string } | null;
}

const RecordingContextInstance = createContext<RecordingContextValue | null>(null);

export const RecordingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { trackStudioAction } = useAnalytics();
  const sessionScope = getSessionScope(user?.id);
  const scopedSavedSessionsKey = getScopedSavedSessionsKey(sessionScope);
  const scopedPerformancesKey = getScopedPerformancesKey(sessionScope);
  const scopedAudioRecordingsKey = getScopedAudioRecordingsKey(sessionScope);

  const parsePerformancesFromStorage = useCallback((raw: string | null): Performance[] => {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.map((item) => ({
        ...item,
        events: parsePerformanceEvents(item?.events),
        eventSchemaVersion: typeof item?.eventSchemaVersion === 'number'
          ? item.eventSchemaVersion
          : PERFORMANCE_EVENT_SCHEMA_VERSION,
      }));
    } catch (error) {
      console.error('Failed to parse local performances:', error);
      return [];
    }
  }, []);

  // Performance recording state
  const [isRecordingPerformance, setIsRecordingPerformance] = useState(false);
  const [mixRecordingHasPlayback, setMixRecordingHasPlayback] = useState(false);
  const [currentPerformance, setCurrentPerformance] = useState<Performance | null>(null);
  const [performances, setPerformances] = useState<Performance[]>([]);
  const [localRecordingsHydrated, setLocalRecordingsHydrated] = useState(false);
  const performanceStartTimeRef = useRef<number>(0);
  const performancesRef = useRef<Performance[]>([]);

  useEffect(() => {
    performancesRef.current = performances;
  }, [performances]);

  // Audio recording state
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [currentAudioRecording, setCurrentAudioRecording] = useState<AudioRecording | null>(null);
  const [audioRecordings, setAudioRecordings] = useState<AudioRecording[]>([]);
  
  // Sessions state
  const [savedSessions, setSavedSessions] = useState<RecordingSession[]>([]);
  const [sessionsHydrated, setSessionsHydrated] = useState(false);

  // MediaRecorder ref for audio recording
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const performanceEventsRef = useRef<RecordingEvent[]>([]);
  const performanceTracksRef = useRef<string[]>([]);
  const audioCheckIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordingDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const [pendingExport, setPendingExport] = useState<{ performanceId: string; canSave: boolean } | null>(null);
  const [pendingSession, setPendingSession] = useState<{ sessionId: string } | null>(null);
  const [savedRecordings, setSavedRecordings] = useState<Recording[]>([]);
  const [playingPerformanceId, setPlayingPerformanceId] = useState<string | null>(null);
  const playingPerformanceIdRef = useRef<string | null>(null);
  const [engagedTrackIds, setEngagedTrackIds] = useState<string[]>([]);
  const [isPerformanceLoopEnabled, setIsPerformanceLoopEnabled] = useState(false);
  const [isOverdubEnabled, setIsOverdubEnabled] = useState(false);
  const playbackTimeoutsRef = useRef<number[]>([]);
  const playbackAbortRef = useRef<{ cancelled: boolean } | null>(null);
  const playbackAudioRef = useRef<HTMLAudioElement | null>(null);
  const engagedTrackIdsRef = useRef<Set<string>>(new Set());
  const studioAudioContextRef = useRef<AudioContext | null>(null);
  const defaultLogEvents = exposeAdvancedPerformanceUi;
  const recordEventsEnabledRef = useRef(defaultLogEvents);
  const recordMixEnabledRef = useRef(true);
  const unarmedRecordingTrackIdsRef = useRef<Set<string>>(new Set());
  const overdubTimestampOffsetRef = useRef(0);
  const playbackScheduleCancelRef = useRef<(() => void) | null>(null);

  const [unarmedRecordingTrackIds, setUnarmedRecordingTrackIds] = useState<string[]>([]);
  const [recordEventsEnabled, setRecordEventsEnabled] = useState(defaultLogEvents);
  const [recordMixEnabled, setRecordMixEnabled] = useState(true);

  const refreshSavedRecordings = useCallback(async () => {
    if (!user?.id) {
      setSavedRecordings([]);
      return;
    }
    setSavedRecordings([]);
    try {
      const recordings = await DatabaseService.getUserRecordings(user.id);
      setSavedRecordings(recordings);
    } catch (error) {
      console.error('Failed to load saved recordings:', error);
      setSavedRecordings([]);
    }
  }, [user?.id]);

  // Load saved recordings on mount and when user changes
  useEffect(() => {
    refreshSavedRecordings();
  }, [refreshSavedRecordings]);

  const recordingAuthKeyRef = useRef<string | undefined>(undefined);
  useLayoutEffect(() => {
    const key = user?.id ?? '__guest__';
    if (recordingAuthKeyRef.current === key) return;
    recordingAuthKeyRef.current = key;
    setSavedRecordings([]);
  }, [user?.id]);

  // Per-account local performances / legacy audio list (not the same as DB savedRecordings).
  // useLayoutEffect avoids persisting the previous account's in-memory rows into the new scope key.
  useLayoutEffect(() => {
    setLocalRecordingsHydrated(false);
    try {
      migrateLegacyLocalRecordings(localStorage, scopedPerformancesKey, scopedAudioRecordingsKey);
      setPerformances(parsePerformancesFromStorage(localStorage.getItem(scopedPerformancesKey)));
      const audioRaw = localStorage.getItem(scopedAudioRecordingsKey);
      setAudioRecordings(audioRaw ? JSON.parse(audioRaw) : []);
    } catch (error) {
      console.error('Failed to load scoped local recordings:', error);
      setPerformances([]);
      setAudioRecordings([]);
    } finally {
      setLocalRecordingsHydrated(true);
    }
  }, [scopedPerformancesKey, scopedAudioRecordingsKey, parsePerformancesFromStorage]);

  // Hydrate in-memory performances from saved recordings so event replay survives refresh/login.
  useEffect(() => {
    if (!user?.id || !localRecordingsHydrated || savedRecordings.length === 0) return;
    setPerformances(prev => {
      const existingDbIds = new Set(prev.map(p => p.databaseId).filter(Boolean));
      const hydrated = savedRecordings
        .filter((recording) => !existingDbIds.has(recording.id))
        .map((recording): Performance => {
          const events = parsePerformanceEvents(recording.performance_events);
          return {
            id: `db_performance_${recording.id}`,
            startTime: recording.created_at ? new Date(recording.created_at).getTime() : Date.now(),
            duration: Math.round((recording.length ?? 0) * 1000),
            events,
            tracks: Array.from(new Set(events.map(e => e.trackId))),
            databaseId: recording.id,
            fileKey: recording.file_key,
            eventSchemaVersion: recording.event_schema_version ?? PERFORMANCE_EVENT_SCHEMA_VERSION,
          };
        })
        .filter((performance) => performance.events.length > 0 || performance.fileKey);

      if (hydrated.length === 0) return prev;
      return [...prev, ...hydrated];
    });
  }, [savedRecordings, localRecordingsHydrated, user?.id]);

  // Load scoped local sessions on auth-scope change and migrate legacy key once.
  useEffect(() => {
    setSessionsHydrated(false);
    try {
      migrateLegacySavedSessions(localStorage, scopedSavedSessionsKey);
      const loaded = parseStoredArray<RecordingSession>(localStorage.getItem(scopedSavedSessionsKey));
      setSavedSessions(loaded);
    } catch (error) {
      console.error('Failed to load scoped saved sessions:', error);
      setSavedSessions([]);
    } finally {
      setSessionsHydrated(true);
    }
  }, [scopedSavedSessionsKey]);

  // Hydrate savedSessions from DB when user logs in (merge DB + current-scope local)
  useEffect(() => {
    if (!user?.id || !sessionsHydrated) return;
    let mounted = true;
    (async () => {
      try {
        const dbSessions = await DatabaseService.getUserSessions(user.id);
        if (!mounted) return;
        const dbAsRecording: RecordingSession[] = dbSessions.map((s: Session) => ({
          id: s.id,
          startTime: s.created_at ? new Date(s.created_at).getTime() : Date.now(),
          events: [{ timestamp: 0, type: 'cue_trigger' as const, trackId: 'studio', data: s.full_state ?? {} }],
          tracks: s.full_state?.tracks?.map((t: { id: string }) => t.id) ?? s.track_ids ?? [],
          duration: 0,
          session_name: s.session_name
        }));
        setSavedSessions(prev => {
          return mergeSessionsById(dbAsRecording, prev);
        });
      } catch (err) {
        console.error('Error hydrating sessions from DB:', err);
      }
    })();
    return () => { mounted = false; };
  }, [user?.id, sessionsHydrated]);

  // Refresh saved recordings when a new one is saved
  useEffect(() => {
    const handler = () => refreshSavedRecordings();
    window.addEventListener('recordingSaved', handler);
    return () => window.removeEventListener('recordingSaved', handler);
  }, [refreshSavedRecordings]);

  // Persist data to localStorage when it changes (after scope hydration to avoid wiping on init)
  useEffect(() => {
    if (!localRecordingsHydrated) return;
    try {
      localStorage.setItem(scopedPerformancesKey, JSON.stringify(performances));
    } catch (error) {
      console.error('Failed to persist performances:', error);
    }
  }, [performances, scopedPerformancesKey, localRecordingsHydrated]);

  useEffect(() => {
    if (!localRecordingsHydrated) return;
    try {
      localStorage.setItem(scopedAudioRecordingsKey, JSON.stringify(audioRecordings));
    } catch (error) {
      console.error('Failed to persist audio recordings:', error);
    }
  }, [audioRecordings, scopedAudioRecordingsKey, localRecordingsHydrated]);

  useEffect(() => {
    engagedTrackIdsRef.current = new Set(engagedTrackIds);
  }, [engagedTrackIds]);

  useEffect(() => {
    recordEventsEnabledRef.current = recordEventsEnabled;
  }, [recordEventsEnabled]);

  useEffect(() => {
    recordMixEnabledRef.current = recordMixEnabled;
  }, [recordMixEnabled]);

  useEffect(() => {
    unarmedRecordingTrackIdsRef.current = new Set(unarmedRecordingTrackIds);
  }, [unarmedRecordingTrackIds]);

  useEffect(() => {
    playingPerformanceIdRef.current = playingPerformanceId;
  }, [playingPerformanceId]);

  useEffect(() => {
    if (!sessionsHydrated) return;
    localStorage.setItem(scopedSavedSessionsKey, JSON.stringify(savedSessions));
  }, [savedSessions, scopedSavedSessionsKey, sessionsHydrated]);

  const finalizePerformanceCapture = useCallback(
    async (performanceId: string, startTime: number, mimeType: string, chunks: Blob[]) => {
      let finalAudioBlob: Blob | undefined;
      if (chunks.length > 0) {
        const originalBlob = new Blob(chunks, { type: mimeType || 'audio/webm' });
        finalAudioBlob = originalBlob;
        try {
          const decodeCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const arrayBuffer = await originalBlob.arrayBuffer();
          let audioBuffer = await decodeCtx.decodeAudioData(arrayBuffer);
          audioBuffer = ensureStereo(audioBuffer);
          const wavBlob = convertToWav(audioBuffer);
          if (wavBlob) {
            finalAudioBlob = wavBlob;
          }
        } catch (error) {
          console.warn('Failed to convert audio format, using original:', error);
        }
      }

      const endTime = Date.now();
      const duration = endTime - startTime;
      const eventCount = performanceEventsRef.current.length;
      const eventsForDb = clonePerformanceEventsForDb(performanceEventsRef.current);

      const completedPerformance: Performance = {
        id: performanceId,
        startTime,
        endTime,
        duration,
        cycleLengthMs: duration,
        events: performanceEventsRef.current,
        tracks: performanceTracksRef.current,
        audioBlob: finalAudioBlob,
        eventSchemaVersion: PERFORMANCE_EVENT_SCHEMA_VERSION,
      };

      setPerformances((prev) => [completedPerformance, ...prev]);
      setCurrentPerformance(null);
      setIsRecordingPerformance(false);
      setMixRecordingHasPlayback(false);
      overdubTimestampOffsetRef.current = 0;

      let canSave = true;
      if (user?.id && (finalAudioBlob || eventCount > 0)) {
        try {
          const { error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('id', user.id)
            .single();

          if (userError && userError.code === 'PGRST116') {
            const { error: createUserError } = await supabase
              .from('users')
              .insert({ id: user.id, access_tier: 'free' });
            if (createUserError) console.error('Failed to create user record:', createUserError);
          } else if (userError) {
            console.error('Error checking user record:', userError);
          }

          const { count: recordingCount, error: countError } = await supabase
            .from('recordings')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id);

          let currentRecordingCount: number;
          if (!countError && recordingCount != null) {
            currentRecordingCount = recordingCount;
          } else {
            const { data: recordingRows } = await supabase
              .from('recordings')
              .select('id')
              .eq('user_id', user.id);
            currentRecordingCount = recordingRows?.length ?? 0;
          }

          const { data: userData, error: userTierError } = await supabase
            .from('users')
            .select('access_tier')
            .eq('id', user.id)
            .single();
          const rawTier = userTierError ? 'free' : (userData?.access_tier || 'free');
          const normalized =
            rawTier === 'pro' || rawTier === 'enterprise'
              ? 'pro'
              : rawTier === 'starter'
                ? 'starter'
                : 'free';
          const maxRecordings = getNumericLimitsForDbTier(normalized).maxRecordings;
          canSave = currentRecordingCount < maxRecordings;

          if (canSave) {
            const notes = `Performance recording with ${eventCount} events`;
            let recordingRecord: Awaited<ReturnType<typeof DatabaseService.createRecording>> = null;
            let r2Key: string | undefined;
            const captureModel =
              finalAudioBlob && eventCount > 0
                ? 'audio_plus_events'
                : finalAudioBlob
                  ? 'audio_only'
                  : 'events_only';

            if (finalAudioBlob) {
              try {
                const r2Result = await StorageService.uploadRecordingBlob(
                  finalAudioBlob,
                  user.id,
                  undefined,
                  notes
                );

                if (r2Result) {
                  r2Key = r2Result.key;
                  recordingRecord = await DatabaseService.createRecording({
                    user_id: user.id,
                    session_id: undefined,
                    recording_url: `https://media.audafact.com/${r2Result.key}`,
                    length: duration / 1000,
                    notes,
                    file_key: r2Result.key,
                    content_hash: r2Result.content_hash,
                    size_bytes: r2Result.size_bytes,
                    content_type: r2Result.content_type,
                    original_name: r2Result.original_name,
                    performance_events: eventsForDb,
                    event_schema_version: PERFORMANCE_EVENT_SCHEMA_VERSION,
                    performance_meta: { capture_model: captureModel },
                  });
                }
              } catch (uploadError) {
                console.warn('R2 upload failed, falling back to local:', uploadError);
              }
            }

            if (!recordingRecord) {
              recordingRecord = await DatabaseService.createRecording({
                user_id: user.id,
                session_id: undefined,
                recording_url: `local://recording_${Date.now()}.wav`,
                length: duration / 1000,
                notes,
                performance_events: eventsForDb,
                event_schema_version: PERFORMANCE_EVENT_SCHEMA_VERSION,
                performance_meta: { capture_model: captureModel },
              });
            }

            if (recordingRecord) {
              const fileKey = r2Key;
              setPerformances((prev) =>
                prev.map((p) =>
                  p.id === performanceId
                    ? {
                        ...p,
                        databaseId: recordingRecord!.id,
                        eventSchemaVersion: PERFORMANCE_EVENT_SCHEMA_VERSION,
                        ...(fileKey && { fileKey }),
                      }
                    : p
                )
              );
              window.dispatchEvent(
                new CustomEvent('recordingSaved', {
                  detail: { userId: user.id, recordingCount: 1 },
                })
              );
            }
          }
        } catch (error) {
          console.error('Failed to save recording to database:', error);
          canSave = false;
        }
      }
      setPendingExport({ performanceId, canSave });
      window.dispatchEvent(new CustomEvent('recordingCompleted'));

      mediaRecorderRef.current = null;
      audioStreamRef.current = null;
      recordingDestinationRef.current = null;

      if (audioCheckIntervalRef.current) {
        clearTimeout(audioCheckIntervalRef.current);
        audioCheckIntervalRef.current = null;
      }
    },
    [user]
  );

  const signalMixRecordingPlayback = useCallback(() => {
    setMixRecordingHasPlayback(true);
  }, []);

  // Combined recording functions
  const startPerformanceRecording = useCallback(
    async (
      appAudioContext?: AudioContext,
      options?: { recordEvents?: boolean; recordMix?: boolean; continueOverdub?: boolean }
    ) => {
      try {
        const resolvedAudioContext = appAudioContext ?? studioAudioContextRef.current ?? null;
        const recEvents = options?.recordEvents !== false;
        const recMix =
          options?.recordMix !== undefined ? options.recordMix : Boolean(resolvedAudioContext);
        recordEventsEnabledRef.current = recEvents;
        recordMixEnabledRef.current = recMix;
        setRecordEventsEnabled(recEvents);
        setRecordMixEnabled(recMix);

        if (!recEvents && !recMix) {
          alert('Enable at least one of: Log events or Record mix.');
          return;
        }

        if (recMix && !resolvedAudioContext) {
          console.error('No audio context available for recording (pass-through or Studio registration missing)');
          alert('Audio context is required when recording the mix.');
          return;
        }

        const performanceId = `performance_${Date.now()}`;
        const startTime = Date.now();
        performanceStartTimeRef.current = startTime;

        overdubTimestampOffsetRef.current = 0;
        if (options?.continueOverdub && playingPerformanceIdRef.current) {
          const base = performances.find((x) => x.id === playingPerformanceIdRef.current);
          if (base?.events?.length) {
            const maxTs = Math.max(...base.events.map((e) => e.timestamp));
            overdubTimestampOffsetRef.current = Math.max(maxTs + 1, base.duration);
          }
        }

        const newPerformance: Performance = {
          id: performanceId,
          startTime,
          events: [],
          tracks: [],
          duration: 0,
          eventSchemaVersion: PERFORMANCE_EVENT_SCHEMA_VERSION,
        };

        performanceEventsRef.current = [];
        performanceTracksRef.current = [];
        setMixRecordingHasPlayback(false);
        setCurrentPerformance(newPerformance);
        setIsRecordingPerformance(true);

        if (!recMix) {
          recordingDestinationRef.current = null;
          mediaRecorderRef.current = null;
          audioStreamRef.current = null;
          trackStudioAction('recording_started', {});
          return;
        }

        const mixContext = resolvedAudioContext as AudioContext;
        const destination = mixContext.createMediaStreamDestination();
        recordingDestinationRef.current = destination;

        let mimeType = '';
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm';
        } else if (MediaRecorder.isTypeSupported('audio/mp4;codecs=mp4a.40.2')) {
          mimeType = 'audio/mp4;codecs=mp4a.40.2';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        }

        const mediaRecorder = new MediaRecorder(destination.stream, mimeType ? { mimeType } : undefined);

        mediaRecorder.onerror = (event) => {
          console.error('MediaRecorder error:', event);
        };

        mediaRecorderRef.current = mediaRecorder;
        audioStreamRef.current = destination.stream;

        const chunks: Blob[] = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunks.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          await finalizePerformanceCapture(performanceId, startTime, mimeType, chunks);
        };

        mediaRecorder.start();
        trackStudioAction('recording_started', {});
      } catch (error) {
        console.error('Failed to start performance recording:', error);
        alert('Failed to start recording. Please check microphone permissions.');
      }
    },
    [finalizePerformanceCapture, performances, trackStudioAction]
  );

  const stopPerformanceRecording = useCallback(() => {
    if (!currentPerformance) return;

    trackStudioAction('recording_stopped', {});

    try {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
        if (audioStreamRef.current) {
          audioStreamRef.current.getTracks().forEach((track) => track.stop());
          audioStreamRef.current = null;
        }
      } else {
        void finalizePerformanceCapture(currentPerformance.id, currentPerformance.startTime, '', []);
      }
    } catch (error) {
      console.error('Error stopping performance recording:', error);
    }
  }, [currentPerformance, trackStudioAction, finalizePerformanceCapture]);

  const addRecordingEvent = useCallback((event: NewPerformanceEvent) => {
    if (!exposeAdvancedPerformanceUi) {
      return;
    }
    if (!isRecordingPerformance || !currentPerformance) {
      return;
    }
    if (!recordEventsEnabledRef.current) {
      return;
    }
    if (unarmedRecordingTrackIdsRef.current.has(event.trackId)) {
      return;
    }

    const raw = Date.now() - performanceStartTimeRef.current;
    const timestamp = raw + overdubTimestampOffsetRef.current;
    const newEvent = {
      ...event,
      timestamp
    } as RecordingEvent;
    
    // Update refs immediately
    performanceEventsRef.current = [...performanceEventsRef.current, newEvent];
    if (!performanceTracksRef.current.includes(event.trackId)) {
      performanceTracksRef.current = [...performanceTracksRef.current, event.trackId];
    }
    

    
    setCurrentPerformance(prev => {
      if (!prev) return null;
      
      // Add track to performance if not already included
      const tracks = prev.tracks.includes(event.trackId) 
        ? prev.tracks 
        : [...prev.tracks, event.trackId];
      
      return {
        ...prev,
        events: [...prev.events, newEvent],
        tracks
      };
    });
  }, [isRecordingPerformance, currentPerformance]);

  // Audio recording functions (deprecated - now combined with performance recording)
  const startAudioRecording = useCallback(async (tempo: number, countInBeats: number = 4) => {
    console.warn('startAudioRecording is deprecated. Use startPerformanceRecording instead.');
    await startPerformanceRecording();
  }, [startPerformanceRecording]);

  const stopAudioRecording = useCallback(() => {
    console.warn('stopAudioRecording is deprecated. Use stopPerformanceRecording instead.');
    stopPerformanceRecording();
  }, [stopPerformanceRecording]);

  // Session functions
  const saveCurrentState = useCallback(async (studioState: any) => {
    const sessionId = `session_${Date.now()}`;
    const currentTime = Date.now();
    
    const sessionName = `Studio Session ${new Date().toLocaleString()}`;
    const stateSession: RecordingSession = {
      id: sessionId,
      startTime: currentTime,
      endTime: currentTime,
      events: [{
        timestamp: 0,
        type: 'cue_trigger', // Using a dummy type for state snapshots
        trackId: 'studio',
        data: studioState
      }],
      tracks: studioState.tracks?.map((track: any) => track.id) || [],
      duration: 0,
      session_name: sessionName
    };
    
    // Save to local state immediately for UI responsiveness
    setSavedSessions(prev => [stateSession, ...prev]);
    
    // If user is authenticated, save to database
    if (user?.id) {
      try {
        // Check if user can save more sessions
        const { count: sessionCount, error: countError } = await supabase
          .from('sessions')
          .select('id', { count: 'exact' })
          .eq('user_id', user.id);
        
        if (countError) {
          console.error('Error checking session count:', countError);
          return;
        }
        
        const currentSessionCount = sessionCount || 0;
        
        // Get user's access tier from database
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('access_tier')
          .eq('id', user.id)
          .single();
        
        const rawTier = userError ? 'free' : (userData?.access_tier || 'free');
        const normalized =
          rawTier === 'pro' || rawTier === 'enterprise'
            ? 'pro'
            : rawTier === 'starter'
              ? 'starter'
              : 'free';
        const maxSessions = getNumericLimitsForDbTier(normalized).maxSessions;
        
        if (currentSessionCount >= maxSessions) {
          console.warn('User has reached session limit');
          // Remove from local state since it couldn't be saved to database
          setSavedSessions(prev => prev.filter(s => s.id !== sessionId));
          return;
        }
        
        // Helper function to check if a string is a valid UUID
        const isValidUUID = (str: string): boolean => {
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
          return uuidRegex.test(str);
        };

        // Filter track IDs to only include valid UUIDs (uploaded tracks)
        const validTrackIds = studioState.tracks
          ?.map((track: any) => track.id)
          .filter((id: string) => isValidUUID(id)) || [];

        // Save to database (full_state contains complete restore data; legacy columns kept for compatibility)
        const dbSession = await DatabaseService.createSession({
          user_id: user.id,
          session_name: sessionName,
          track_ids: validTrackIds,
          cuepoints: studioState.tracks?.map((track: any) => ({ trackId: track.id, cuePoints: track.cuePoints || [] })) || [],
          loop_regions: studioState.tracks?.map((track: any) => ({
            trackId: track.id,
            start: track.loopStart,
            end: track.loopEnd
          })).filter((region: any) => region.start !== undefined && region.end !== undefined) || [],
          mode: 'loop',
          full_state: studioState
        });
        
        if (dbSession) {
          // Update local session with database ID and name
          setSavedSessions(prev => prev.map(s => 
            s.id === sessionId ? { ...s, id: dbSession.id, session_name: dbSession.session_name } : s
          ));
          setPendingSession({ sessionId: dbSession.id });
          trackStudioAction('saved', { sessionName: sessionName, isModified: true });
          window.dispatchEvent(new CustomEvent('sessionSaved', {
            detail: { userId: user.id, sessionCount: currentSessionCount + 1 }
          }));
        } else {
          console.error('Failed to save session to database');
          // Remove from local state since it couldn't be saved to database
          setSavedSessions(prev => prev.filter(s => s.id !== sessionId));
        }
      } catch (error) {
        console.error('Error saving session to database:', error);
        // Remove from local state since it couldn't be saved to database
        setSavedSessions(prev => prev.filter(s => s.id !== sessionId));
      }
    }
  }, [user, trackStudioAction]);

  // Management functions
  const clearAll = useCallback(() => {
    setPerformances([]);
    setAudioRecordings([]);
    setSavedSessions([]);
    try {
      localStorage.removeItem(scopedPerformancesKey);
      localStorage.removeItem(scopedAudioRecordingsKey);
      localStorage.removeItem(scopedSavedSessionsKey);
    } catch (error) {
      console.error('Failed to clear local recording storage:', error);
    }
  }, [scopedPerformancesKey, scopedAudioRecordingsKey, scopedSavedSessionsKey]);

  const exportPerformance = useCallback(async (performanceId: string, options?: { filename?: string; format?: 'mp3' | 'wav' }) => {
    const performance = performances.find(p => p.id === performanceId);
    if (!performance) return;
    
    const format = options?.format ?? 'wav';
    const baseFilename = options?.filename ?? `audafact_recording_${new Date().toISOString().slice(0, 16).replace('T', '_')}`;
    const extension = format === 'mp3' ? 'mp3' : 'wav';
    const filename = baseFilename.endsWith(`.${extension}`) ? baseFilename : `${baseFilename}.${extension}`;
    
    const audioBlob = performance.audioBlob;
    if (!audioBlob) return;
    
    try {
      let blobToDownload = audioBlob;
      if (format === 'mp3') {
        blobToDownload = await convertToMp3(audioBlob);
      } else {
        // Ensure .wav extension - blob is already WAV from recording
        if (!audioBlob.type.includes('wav')) {
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          const arrayBuffer = await audioBlob.arrayBuffer();
          let audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          audioBuffer = ensureStereo(audioBuffer);
          const wavBlob = convertToWav(audioBuffer);
          if (wavBlob) blobToDownload = wavBlob;
        }
      }
      downloadBlob(blobToDownload, filename);
      trackStudioAction('downloaded', { fileName: filename, format });

      // Persist custom filename to DB when recording was saved
      if (performance.databaseId && user?.id) {
        await DatabaseService.updateRecordingOriginalName(performance.databaseId, user.id, filename);
        refreshSavedRecordings();
      }
    } catch (error) {
      console.error('Export failed:', error);
    }
  }, [performances, user?.id, refreshSavedRecordings, trackStudioAction]);

  const exportByFileKey = useCallback(async (fileKey: string, filename: string, format: 'mp3' | 'wav', recordingId?: string) => {
    try {
      const url = await getSignedUrl(fileKey);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
      const audioBlob = await res.blob();

      let blobToDownload: Blob;
      if (format === 'mp3') {
        blobToDownload = await convertToMp3(audioBlob);
      } else {
        if (!audioBlob.type.includes('wav')) {
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          const arrayBuffer = await audioBlob.arrayBuffer();
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          const wavBlob = convertToWav(ensureStereo(audioBuffer));
          blobToDownload = wavBlob ?? audioBlob;
        } else {
          blobToDownload = audioBlob;
        }
      }
      downloadBlob(blobToDownload, filename);
      trackStudioAction('downloaded', { fileName: filename, format });

      if (recordingId && user?.id) {
        await DatabaseService.updateRecordingOriginalName(recordingId, user.id, filename);
        refreshSavedRecordings();
      }
    } catch (error) {
      console.error('Export by fileKey failed:', error);
      throw error;
    }
  }, [user?.id, refreshSavedRecordings, trackStudioAction]);

  const savePerformanceName = useCallback(async (performanceId: string, filename: string) => {
    const performance = performancesRef.current.find(p => p.id === performanceId);
    if (!performance || !user?.id) return;
    if (performance.databaseId) {
      await DatabaseService.updateRecordingOriginalName(performance.databaseId, user.id, filename);
      refreshSavedRecordings();
      return;
    }
    // No databaseId yet: create the save with user's filename (save-only flow).
    // Event-log-only captures have no audioBlob; auto-save still supports them — mirror that here.
    const eventsForDb = clonePerformanceEventsForDb(performance.events);
    const eventCount = eventsForDb.length;
    if (!performance.audioBlob && eventCount === 0) return;
    try {
      const { count: recordingCount } = await supabase
        .from('recordings')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);
      const { data: userData } = await supabase
        .from('users')
        .select('access_tier')
        .eq('id', user.id)
        .single();
      const rawTier = userData?.access_tier || 'free';
      const normalized =
        rawTier === 'pro' || rawTier === 'enterprise' ? 'pro'
        : rawTier === 'starter' ? 'starter' : 'free';
      const maxRecordings = getNumericLimitsForDbTier(normalized).maxRecordings;
      if ((recordingCount ?? 0) >= maxRecordings) return;
      const baseName = filename.replace(/\.(mp3|wav)$/i, '') || 'recording';
      const notes = `Performance recording with ${eventCount} events`;
      let recordingRecord: Awaited<ReturnType<typeof DatabaseService.createRecording>> = null;
      let r2Result: Awaited<ReturnType<typeof StorageService.uploadRecordingBlob>> = null;

      if (performance.audioBlob) {
        r2Result = await StorageService.uploadRecordingBlob(
          performance.audioBlob,
          user.id,
          undefined,
          notes,
          baseName
        );
        if (r2Result) {
          recordingRecord = await DatabaseService.createRecording({
            user_id: user.id,
            session_id: undefined,
            recording_url: `https://media.audafact.com/${r2Result.key}`,
            length: performance.duration / 1000,
            notes,
            file_key: r2Result.key,
            content_hash: r2Result.content_hash,
            size_bytes: r2Result.size_bytes,
            content_type: r2Result.content_type,
            original_name: filename,
            performance_events: eventsForDb,
            event_schema_version: performance.eventSchemaVersion ?? PERFORMANCE_EVENT_SCHEMA_VERSION,
            performance_meta: { capture_model: 'audio_plus_events' },
          });
        }
        if (!recordingRecord) {
          recordingRecord = await DatabaseService.createRecording({
            user_id: user.id,
            session_id: undefined,
            recording_url: `local://recording_${Date.now()}.wav`,
            length: performance.duration / 1000,
            notes,
            original_name: filename,
            performance_events: eventsForDb,
            event_schema_version: performance.eventSchemaVersion ?? PERFORMANCE_EVENT_SCHEMA_VERSION,
            performance_meta: { capture_model: 'events_only_fallback' },
          });
        }
      } else {
        recordingRecord = await DatabaseService.createRecording({
          user_id: user.id,
          session_id: undefined,
          recording_url: `local://recording_${Date.now()}.wav`,
          length: performance.duration / 1000,
          notes,
          original_name: filename,
          performance_events: eventsForDb,
          event_schema_version: performance.eventSchemaVersion ?? PERFORMANCE_EVENT_SCHEMA_VERSION,
          performance_meta: { capture_model: 'events_only' },
        });
      }
      if (recordingRecord) {
        setPerformances(prev => prev.map(p =>
          p.id === performanceId
            ? { ...p, databaseId: recordingRecord!.id, fileKey: r2Result?.key }
            : p
        ));
        await DatabaseService.updateRecordingOriginalName(recordingRecord.id, user.id, filename);
        refreshSavedRecordings();
      }
    } catch (error) {
      console.error('Failed to save performance to app:', error);
    }
  }, [user?.id, refreshSavedRecordings]);

  const updateRecordingName = useCallback(async (recordingId: string, filename: string) => {
    if (!user?.id) return;
    await DatabaseService.updateRecordingOriginalName(recordingId, user.id, filename);
    refreshSavedRecordings();
  }, [user?.id, refreshSavedRecordings]);

  const exportSession = useCallback((sessionId: string) => {
    const session = savedSessions.find(s => s.id === sessionId);
    if (!session) return;
    
    const dataStr = JSON.stringify(session, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `audafact_session_${sessionId}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [savedSessions]);

  const exportAudioRecording = useCallback((recordingId: string) => {
    const recording = audioRecordings.find(r => r.id === recordingId);
    if (!recording || !recording.audioBlob) return;
    
    const url = URL.createObjectURL(recording.audioBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `audafact_recording_${recordingId}.wav`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [audioRecordings]);

  const deletePerformance = useCallback(async (performanceId: string, options?: { fileKey?: string }) => {
    // Find the performance to get its database ID
    const performance = performances.find(p => p.id === performanceId);
    const fileKey = options?.fileKey ?? performance?.fileKey;

    // Remove from local state immediately for UI responsiveness
    setPerformances(prev => prev.filter(p => p.id !== performanceId));

    // If performance has a database ID and user is authenticated, delete from storage then database
    if (performance?.databaseId && user?.id) {
      try {
        // Delete from R2 storage first (match upload flow)
        if (fileKey) {
          try {
            await deleteByKey(fileKey);
          } catch (storageError) {
            console.warn('Failed to delete from storage (continuing anyway):', storageError);
          }
        }
        const success = await DatabaseService.deleteRecording(performance.databaseId, user.id);
        if (success) refreshSavedRecordings();
        else console.error('Failed to delete recording from database');
      } catch (error) {
        console.error('Error deleting recording from database:', error);
      }
    }
  }, [performances, user, refreshSavedRecordings]);

  const deleteSavedRecording = useCallback(async (recordingId: string, options?: { fileKey?: string }) => {
    if (!user?.id) return;
    try {
      // Delete from R2 storage first (match upload flow)
      if (options?.fileKey) {
        try {
          await deleteByKey(options.fileKey);
        } catch (storageError) {
          console.warn('Failed to delete from storage (continuing anyway):', storageError);
        }
      }
      const success = await DatabaseService.deleteRecording(recordingId, user.id);
      if (success) await refreshSavedRecordings();
      else console.error('Failed to delete recording from database');
    } catch (error) {
      console.error('Error deleting recording from database:', error);
    }
  }, [user?.id, refreshSavedRecordings]);

  const deleteSession = useCallback(async (sessionId: string) => {
    // Remove from local state immediately for UI responsiveness
    setSavedSessions(prev => prev.filter(s => s.id !== sessionId));
    
    // If user is authenticated, delete from database
    if (user?.id) {
      try {
        const success = await DatabaseService.deleteSession(sessionId, user.id);
        if (!success) {
          console.error('Failed to delete session from database');
        }
      } catch (error) {
        console.error('Error deleting session from database:', error);
      }
    } else {
      // Guest or not authenticated: still add locally and prompt for name
      setPendingSession({ sessionId });
    }
  }, [user]);

  const renameSession = useCallback(async (sessionId: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;

    setSavedSessions(prev => prev.map(s =>
      s.id === sessionId ? { ...s, session_name: trimmed } : s
    ));

    const isValidUUID = (str: string): boolean =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);

    if (user?.id && isValidUUID(sessionId)) {
      try {
        const updated = await DatabaseService.updateSession(sessionId, user.id, { session_name: trimmed });
        if (!updated) {
          console.error('Failed to rename session in database');
        }
      } catch (error) {
        console.error('Error renaming session in database:', error);
      }
    }
  }, [user]);

  const deleteAudioRecording = useCallback(async (recordingId: string) => {
    // Remove from local state immediately for UI responsiveness
    setAudioRecordings(prev => prev.filter(r => r.id !== recordingId));
    
    // If user is authenticated, delete from database
    if (user?.id) {
      try {
        const success = await DatabaseService.deleteRecording(recordingId, user.id);
        if (!success) {
          console.error('Failed to delete recording from database');
          // Could add error handling here (e.g., show toast, restore to local state)
        }
      } catch (error) {
        console.error('Error deleting recording from database:', error);
        // Could add error handling here
      }
    }
  }, [user]);

  const getRecordingDestination = useCallback(() => {
    return recordingDestinationRef.current;
  }, []);

  const registerStudioAudioContext = useCallback((ctx: AudioContext | null) => {
    studioAudioContextRef.current = ctx;
  }, []);

  const toggleRecordingArmForTrack = useCallback((trackId: string) => {
    setUnarmedRecordingTrackIds((prev) => {
      const s = new Set(prev);
      if (s.has(trackId)) s.delete(trackId);
      else s.add(trackId);
      unarmedRecordingTrackIdsRef.current = s;
      return [...s];
    });
  }, []);

  const clearRecordingArmExclusions = useCallback(() => {
    unarmedRecordingTrackIdsRef.current = new Set();
    setUnarmedRecordingTrackIds([]);
  }, []);

  const clearPlaybackTimers = useCallback(() => {
    playbackScheduleCancelRef.current?.();
    playbackScheduleCancelRef.current = null;
    playbackTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    playbackTimeoutsRef.current = [];
  }, []);

  const stopPerformancePlayback = useCallback(() => {
    if (playbackAbortRef.current) {
      playbackAbortRef.current.cancelled = true;
    }
    clearPlaybackTimers();
    setPlayingPerformanceId(null);
    setEngagedTrackIds([]);
    setIsPerformanceLoopEnabled(false);
    if (playbackAudioRef.current) {
      try {
        playbackAudioRef.current.pause();
        playbackAudioRef.current.currentTime = 0;
        playbackAudioRef.current.loop = false;
      } catch {
        // no-op
      }
      playbackAudioRef.current = null;
    }
    window.dispatchEvent(new CustomEvent('audafact-performance-playback-stop'));
  }, [clearPlaybackTimers]);

  const playReferenceAudio = useCallback(async (performance: Performance, opts?: { loop?: boolean }) => {
    if (performance.audioBlob instanceof Blob) {
      const audio = new Audio(URL.createObjectURL(performance.audioBlob));
      playbackAudioRef.current = audio;
      audio.loop = !!opts?.loop;
      await audio.play();
      audio.onended = () => {
        if (!audio.loop && audio.src.startsWith('blob:')) URL.revokeObjectURL(audio.src);
      };
      return;
    }
    if (performance.fileKey) {
      const signedUrl = await getSignedUrl(performance.fileKey);
      const audio = new Audio(signedUrl);
      playbackAudioRef.current = audio;
      audio.loop = !!opts?.loop;
      await audio.play();
    }
  }, []);

  const runPerformancePlaybackPass = useCallback(
    (
      performance: Performance,
      opts: {
        loop: boolean;
        /** Play master mix while dispatching events (usually false to avoid double audio) */
        referenceAudioWithEvents: boolean;
        trackIdFilter: string | null;
        audioContext: AudioContext | null;
        abortToken: { cancelled: boolean };
      }
    ) => {
      const hasEvents = performance.events.length > 0;
      const hasAudio = !!(performance.audioBlob || performance.fileKey);

      if (!hasEvents && hasAudio) {
        void (async () => {
          try {
            await playReferenceAudio(performance, { loop: opts.loop });
            const el = playbackAudioRef.current;
            if (el && !opts.loop) {
              el.onended = () => {
                if (opts.abortToken.cancelled) return;
                setPlayingPerformanceId(null);
                setEngagedTrackIds([]);
                setIsPerformanceLoopEnabled(false);
              };
            }
          } catch (e) {
            console.warn('Reference-only playback failed:', e);
          }
        })();
        return;
      }

      if (opts.referenceAudioWithEvents && hasAudio) {
        void playReferenceAudio(performance, { loop: opts.loop });
      }

      const cycleLen = performance.cycleLengthMs ?? performance.duration;
      const sorted = [...performance.events].sort((a, b) => a.timestamp - b.timestamp);
      const filtered = opts.trackIdFilter
        ? sorted.filter((e) => e.trackId === opts.trackIdFilter)
        : sorted;
      const lastTs = filtered.length ? Math.max(...filtered.map((e) => e.timestamp)) : 0;
      const passDurationMs =
        opts.loop && cycleLen > 0
          ? cycleLen
          : Math.max(performance.duration, lastTs, 1);

      const schedulePass = () => {
        if (opts.abortToken.cancelled) return;
        playbackScheduleCancelRef.current?.();
        const { cancelScheduled } = schedulePerformanceEventsPass({
          events: filtered,
          engagedTrackIds: engagedTrackIdsRef.current,
          trackIdFilter: null,
          loop: opts.loop,
          cycleLengthMs: opts.loop ? cycleLen : undefined,
          passDurationMs,
          audioContext: opts.audioContext,
          onFire: (event) => {
            window.dispatchEvent(new CustomEvent('audafact-performance-playback-event', { detail: event }));
          },
          onPassComplete: () => {
            if (opts.abortToken.cancelled) return;
            if (opts.loop) {
              if (playbackAudioRef.current && opts.referenceAudioWithEvents) {
                try {
                  playbackAudioRef.current.currentTime = 0;
                } catch {
                  // no-op
                }
              }
              schedulePass();
            } else {
              setPlayingPerformanceId(null);
              setEngagedTrackIds([]);
              setIsPerformanceLoopEnabled(false);
            }
          },
          abortToken: opts.abortToken,
        });
        playbackScheduleCancelRef.current = cancelScheduled;
      };

      schedulePass();
    },
    [playReferenceAudio]
  );

  const startPerformancePlayback = useCallback(
    async (
      performanceId: string,
      options?: {
        loop?: boolean;
        audioContext?: AudioContext | null;
        referenceAudio?: boolean;
        referenceOnly?: boolean;
        trackIdFilter?: string | null;
      }
    ) => {
      const performance = performances.find((item) => item.id === performanceId);
      if (!performance) return;

      stopPerformancePlayback();
      const loop = !!options?.loop;
      const referenceOnly = !!options?.referenceOnly;
      const referenceAudioWithEvents = !!options?.referenceAudio;
      const trackIdFilter = options?.trackIdFilter ?? null;
      const audioContext = options?.audioContext ?? studioAudioContextRef.current ?? null;

      const engaged =
        trackIdFilter != null && trackIdFilter !== ''
          ? new Set<string>([trackIdFilter])
          : new Set(performance.tracks.length ? performance.tracks : [...new Set(performance.events.map((e) => e.trackId))]);
      engagedTrackIdsRef.current = engaged;
      setEngagedTrackIds([...engaged]);

      setPlayingPerformanceId(performance.id);
      setIsPerformanceLoopEnabled(loop);

      const abortToken = { cancelled: false };
      playbackAbortRef.current = abortToken;

      if (referenceOnly) {
        const hasAudio = !!(performance.audioBlob || performance.fileKey);
        if (!hasAudio) return;
        await playReferenceAudio(performance, { loop });
        return;
      }

      runPerformancePlaybackPass(performance, {
        loop,
        referenceAudioWithEvents,
        trackIdFilter,
        audioContext,
        abortToken,
      });
    },
    [performances, runPerformancePlaybackPass, stopPerformancePlayback, playReferenceAudio]
  );

  const startReferenceOnlyPlayback = useCallback(
    async (performanceId: string, options?: { loop?: boolean }) => {
      await startPerformancePlayback(performanceId, { referenceOnly: true, loop: !!options?.loop });
    },
    [startPerformancePlayback]
  );

  const startLanePlayback = useCallback(
    async (performanceId: string, trackId: string, options?: { loop?: boolean }) => {
      await startPerformancePlayback(performanceId, {
        trackIdFilter: trackId,
        loop: options?.loop ?? true,
        referenceAudio: false,
        referenceOnly: false,
      });
    },
    [startPerformancePlayback]
  );

  const setTrackEngaged = useCallback((trackId: string, engaged: boolean) => {
    setEngagedTrackIds(prev => {
      if (engaged) {
        return prev.includes(trackId) ? prev : [...prev, trackId];
      }
      return prev.filter(id => id !== trackId);
    });
  }, []);

  const exportSharedSessionBundle = useCallback((sessionId: string, options?: { performanceId?: string }) => {
    const session = savedSessions.find((s) => s.id === sessionId);
    if (!session) return;

    const performance =
      (options?.performanceId
        ? performances.find((p) => p.id === options.performanceId)
        : performances[0]) ?? null;
    const bundle = {
      version: 1,
      exportedAt: new Date().toISOString(),
      session,
      performance: performance ? {
        id: performance.id,
        startTime: performance.startTime,
        duration: performance.duration,
        tracks: performance.tracks,
        events: performance.events,
        eventSchemaVersion: performance.eventSchemaVersion ?? PERFORMANCE_EVENT_SCHEMA_VERSION,
        fileKey: performance.fileKey,
      } : null,
    };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audafact_shared_session_${sessionId}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [savedSessions, performances]);

  const importSharedSessionBundle = useCallback((bundle: unknown) => {
    if (!bundle || typeof bundle !== 'object') return null;
    const parsed = bundle as {
      session?: RecordingSession;
      performance?: {
        id?: string;
        startTime?: number;
        duration?: number;
        tracks?: string[];
        events?: unknown;
        eventSchemaVersion?: number;
        fileKey?: string;
      } | null;
    };

    let importedSessionId: string | undefined;
    let importedPerformanceId: string | undefined;

    if (parsed.session && typeof parsed.session === 'object') {
      const sessionId = parsed.session.id || `shared_session_${Date.now()}`;
      importedSessionId = sessionId;
      setSavedSessions(prev => {
        const exists = prev.some(s => s.id === sessionId);
        if (exists) return prev;
        return [{ ...parsed.session!, id: sessionId }, ...prev];
      });
    }

    if (parsed.performance && typeof parsed.performance === 'object') {
      const performanceId = parsed.performance.id || `shared_performance_${Date.now()}`;
      importedPerformanceId = performanceId;
      const events = parsePerformanceEvents(parsed.performance.events);
      setPerformances(prev => {
        if (prev.some(p => p.id === performanceId)) return prev;
        return [{
          id: performanceId,
          startTime: parsed.performance?.startTime ?? Date.now(),
          duration: parsed.performance?.duration ?? 0,
          tracks: parsed.performance?.tracks ?? Array.from(new Set(events.map(event => event.trackId))),
          events,
          fileKey: parsed.performance?.fileKey,
          eventSchemaVersion: parsed.performance?.eventSchemaVersion ?? PERFORMANCE_EVENT_SCHEMA_VERSION,
        }, ...prev];
      });
    }

    return { sessionId: importedSessionId, performanceId: importedPerformanceId };
  }, []);

  const clearPendingExport = useCallback(() => {
    setPendingExport(null);
  }, []);

  const clearPendingSession = useCallback(() => {
    setPendingSession(null);
  }, []);

  const discardPerformance = useCallback((performanceId: string) => {
    setPerformances(prev => prev.filter(p => p.id !== performanceId));
  }, []);

  useEffect(() => {
    return () => {
      stopPerformancePlayback();
    };
  }, [stopPerformancePlayback]);

  const value: RecordingContextValue = {
    // Performance recording
    isRecordingPerformance,
    currentPerformance,
    performances,
    startPerformanceRecording,
    stopPerformanceRecording,
    addRecordingEvent,
    getRecordingDestination,
    registerStudioAudioContext,
    unarmedRecordingTrackIds,
    toggleRecordingArmForTrack,
    clearRecordingArmExclusions,
    startPerformancePlayback,
    startReferenceOnlyPlayback,
    startLanePlayback,
    stopPerformancePlayback,
    playingPerformanceId,
    engagedTrackIds,
    setTrackEngaged,
    isPerformanceLoopEnabled,
    isOverdubEnabled,
    setOverdubEnabled: setIsOverdubEnabled,
    recordEventsEnabled,
    setRecordEventsEnabled,
    recordMixEnabled,
    setRecordMixEnabled,
    mixRecordingHasPlayback,
    signalMixRecordingPlayback,

    // Audio recording
    isRecordingAudio,
    currentAudioRecording,
    audioRecordings,
    startAudioRecording,
    stopAudioRecording,
    
    // Sessions
    savedSessions,
    saveCurrentState,
    
    // Management
    clearAll,
    exportPerformance,
    exportByFileKey,
    savePerformanceName,
    updateRecordingName,
    exportSession,
    exportAudioRecording,
    deletePerformance,
    deleteSession,
    renameSession,
    deleteAudioRecording,
    pendingExport,
    clearPendingExport,
    pendingSession,
    clearPendingSession,
    discardPerformance,
    savedRecordings,
    refreshSavedRecordings,
    deleteSavedRecording,
    exportSharedSessionBundle,
    importSharedSessionBundle,
  };

  return (
    <RecordingContextInstance.Provider value={value}>
      {children}
    </RecordingContextInstance.Provider>
  );
};

export const useRecording = (): RecordingContextValue => {
  const context = useContext(RecordingContextInstance);
  if (!context) {
    throw new Error('useRecording must be used within a RecordingProvider');
  }
  return context;
}; 