import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useRecording } from '../context/RecordingContext';
import { StorageService } from '../services/storageService';
import { DatabaseService } from '../services/databaseService';
import { useAuth } from '../context/AuthContext';
import { useAccessControl } from '../hooks/useAccessControl';
import { useUser } from '../hooks/useUser';
import { useGuest } from '../context/GuestContext';
import { UpgradePrompt } from './UpgradePrompt';
import { UserTrack, type LibraryTrack } from '../types/music';
import {
  getSampleSuggestions,
  type SuggestionCandidate,
  type SuggestionReference,
} from '@/services/sampleSuggestionService';
import LibraryTrackItem from './LibraryTrackItem';
import { showSignupModal } from '../hooks/useSignupModal';
import { toPrettySize, normalizeLegacyUrlToKey } from '@/utils/media';
import { deleteByKey } from '@/lib/storage';
import { buildApiUrl, API_CONFIG } from '@/config/api';
import { CRISTIAN_SIGLER_DEMO_SIDE_PANEL_LABEL } from '@/config/demoLibrary';
import { supabase } from '@/services/supabase';
import { useSingleAudio } from '@/hooks/useSingleAudio';
import { ExportRecordingModal } from './ExportRecordingModal';
import { RenameRecordingModal } from './RenameRecordingModal';
import Tooltip from './Tooltip';

interface AudioAsset {
  id: string;
  name: string;
  fileKey: string;
  type: 'wav' | 'mp3' | 'm4a';
  size: string;
  duration?: number;
  fileUrl?: string;
  bpm?: number;
  key?: string;
  beats?: number[];
}

interface UploadButtonProps {
  user: any;
  guestUploadUsed: boolean;
  tierId?: 'guest' | 'free' | 'starter' | 'pro';
  canPerformAction: (action: "upload" | "save_session" | "record" | "add_library_track" | "download") => Promise<boolean>;
  getUpgradeMessage: (action: "upload" | "save_session" | "record" | "add_library_track" | "download") => string;
  showSignupModal: (action: string) => void;
  setShowUpgradePrompt: (state: { show: boolean; message: string; feature: string }) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
}

// Sub-menu item icons (stroke-based, inherit currentColor)
const IconLibrary = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
  </svg>
);
const IconUser = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);
type SidePanelAudioTab = 'my-tracks' | 'library' | 'demo-pack';

const IconBookmark = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
  </svg>
);
const IconShare = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
  </svg>
);

interface SidePanelSubMenuItemProps {
  label: string;
  icon?: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
  ariaLabel?: string;
  role?: 'tab';
  ariaSelected?: boolean;
  ariaControls?: string;
  id?: string;
}

const SidePanelSubMenuItem: React.FC<SidePanelSubMenuItemProps> = ({
  label,
  icon,
  isActive,
  onClick,
  ariaLabel,
  role = 'tab',
  ariaSelected,
  ariaControls,
  id,
}) => {
  return (
    <button
      type="button"
      role={role}
      aria-selected={ariaSelected}
      aria-controls={ariaControls}
      id={id}
      aria-label={ariaLabel ?? label}
      onClick={onClick}
      className={`
        w-full flex items-center gap-2 px-4 py-2.5 min-h-[44px] text-sm text-left rounded-md
        border-l-2 transition-colors duration-200
        focus:outline-none focus-visible:ring-2 focus-visible:ring-audafact-accent-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-audafact-surface-2
        ${isActive
          ? 'text-audafact-accent-cyan bg-audafact-surface-3 border-l-audafact-accent-cyan font-medium'
          : 'text-audafact-text-secondary border-l-transparent hover:text-audafact-text-primary hover:bg-audafact-surface-3 hover:border-l-audafact-divider'
        }
      `}
    >
      {icon && (
        <span className="flex-shrink-0 w-3.5 h-3.5 [&>svg]:w-full [&>svg]:h-full" aria-hidden>
          {icon}
        </span>
      )}
      <span>{label}</span>
    </button>
  );
};

const UploadButton: React.FC<UploadButtonProps> = ({
  user,
  guestUploadUsed,
  tierId,
  canPerformAction,
  getUpgradeMessage,
  showSignupModal,
  setShowUpgradePrompt,
  fileInputRef
}) => {
  const [canUpload, setCanUpload] = useState<boolean | null>(null);
  const [upgradeMessage, setUpgradeMessage] = useState<string>('');

  useEffect(() => {
    const checkUploadCapacity = async () => {
      if (!user) {
        setCanUpload(!guestUploadUsed); // Allow exactly 1 guest upload per session
        return;
      }
      
      const uploadAllowed = await canPerformAction('upload');
      setCanUpload(uploadAllowed);
      
      if (!uploadAllowed) {
        setUpgradeMessage(getUpgradeMessage('upload'));
      }
    };

    checkUploadCapacity();
  }, [user, canPerformAction, getUpgradeMessage, guestUploadUsed]);

  const handleClick = async () => {
    // Check if user is authenticated
    if (!user) {
      if (guestUploadUsed) {
        showSignupModal('upload');
        return;
      }

      fileInputRef.current?.click();
      return;
    }
    
    // Check upload limits for authenticated users
    const uploadAllowed = await canPerformAction('upload');
    if (!uploadAllowed) {
      setShowUpgradePrompt({
        show: true,
        message: getUpgradeMessage('upload'),
        feature: 'Track Upload'
      });
      return;
    }
    
    // For authenticated users with upload capacity, open file browser
    fileInputRef.current?.click();
  };

  // Keep free/starter "at limit" state clickable so it can open an upgrade CTA.
  const isAtUploadLimit = !!user && canUpload === false;
  const isDisabled = !user && guestUploadUsed;
  const tooltipText = isDisabled
    ? !user
      ? 'Create a free account to keep and manage your uploaded track'
      : upgradeMessage
    : 'Upload another track to your collection';

  return (
    <div className="pt-3 border-t border-audafact-divider">
      <button
        onClick={handleClick}
        disabled={isDisabled}
        className={`w-full px-3 py-2 text-sm border border-audafact-divider rounded-lg transition-colors duration-200 flex items-center justify-center gap-2 ${
          isDisabled 
            ? 'text-audafact-text-secondary opacity-50 cursor-not-allowed' 
            : 'text-audafact-text-secondary hover:text-audafact-accent-cyan hover:bg-audafact-surface-2'
        }`}
        title={tooltipText}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
        Upload Another Track
      </button>

      {isAtUploadLimit && (
        <div className="mt-2 rounded-lg border border-audafact-accent-cyan/30 bg-audafact-surface-2 p-2.5">
          <p className="text-xs audafact-text-secondary">
            {tierId === 'starter'
              ? 'You have reached your Starter upload limit. Upgrade to Pro for unlimited uploads, WAV export, and advanced performance modes.'
              : tierId === 'free'
                ? 'You have reached your Free upload limit. Upgrade to Starter or Pro to add more tracks and keep creating without interruption.'
                : (upgradeMessage || 'You reached your upload limit. Upgrade to keep building with more tracks.')}
          </p>
          <button
            type="button"
            onClick={() => setShowUpgradePrompt({
              show: true,
              message: tierId === 'starter'
                ? 'You have reached your Starter upload limit. Upgrade to Pro for unlimited uploads, WAV export, and advanced performance modes.'
                : tierId === 'free'
                  ? 'You have reached your Free upload limit. Upgrade to Starter or Pro to add more tracks and keep creating without interruption.'
                  : (upgradeMessage || 'You reached your upload limit. Upgrade to keep building with more tracks.'),
              feature: 'Track Upload'
            })}
            className="mt-2 text-xs font-medium text-audafact-accent-cyan hover:text-audafact-accent-cyan/80 transition-colors"
          >
            View plans
          </button>
        </div>
      )}
    </div>
  );
};



interface SidePanelProps {
  isOpen: boolean;
  onToggle: () => void;
  onUploadTrack: (file: File, trackType: 'preview' | 'loop' | 'cue') => void;
  onAddFromLibrary: (asset: AudioAsset, trackType: 'preview' | 'loop' | 'cue') => void;
  onAddUserTrack: (track: UserTrack, trackType: 'preview' | 'loop' | 'cue') => void;
  onUploadAnalysisUpdated?: (uploadId: string, data: { bpm?: number; key?: string; beats?: number[] }) => void;
  onRestoreSession?: (session: { events?: Array<{ data?: any }>; full_state?: any }) => Promise<void>;
  initialMode?: 'upload' | 'library';
  referenceForSuggestions?: SuggestionReference | null;
  suggestionReferenceTrackOptions?: { id: string; label: string }[];
  effectiveSuggestionReferenceTrackId?: string;
  onSuggestionReferenceTrackChange?: (trackId: string) => void;
}

const SidePanel: React.FC<SidePanelProps> = ({
  isOpen,
  onToggle,
  onUploadTrack,
  onAddFromLibrary,
  onAddUserTrack,
  onUploadAnalysisUpdated,
  onRestoreSession,
  initialMode,
  referenceForSuggestions = null,
  suggestionReferenceTrackOptions = [],
  effectiveSuggestionReferenceTrackId,
  onSuggestionReferenceTrackChange,
}) => {

  const { savedSessions, performances, exportSession, exportPerformance, exportByFileKey, savePerformanceName, updateRecordingName, deleteSession, renameSession, deletePerformance, pendingExport, clearPendingExport, pendingSession, clearPendingSession, discardPerformance, savedRecordings, deleteSavedRecording } = useRecording();
  const { user } = useAuth();
  const { canPerformAction, getUpgradeMessage, canAccessFeature } = useAccessControl();
  const {
    tier,
    libraryTracks: userLibraryTracks,
    demoCollectionTracks,
    demoCollectionLoading,
    loading: userLoading,
    libraryCatalogBanner,
  } = useUser();
  const { guestTracks, isLoading: guestTracksLoading } = useGuest();

  const guestLibraryTracks = useMemo<LibraryTrack[]>(() => {
    if (user) return [];
    return guestTracks.map((t) => ({
      id: t.id,
      name: t.name,
      genre: t.genre,
      bpm: t.bpm,
      duration: t.duration ?? 0,
      fileKey: t.file, // For guests: this is a direct URL (not an R2 object key)
      previewUrl: t.file,
      type: t.type,
      size: t.size,
      tags: [],
      isDemo: true,
    }));
  }, [user, guestTracks]);
  
  // Collapsible menu state - Tracks open by default, but Sessions/Recordings use saved preference
  const [expandedMenus, setExpandedMenus] = useState<{ [key: string]: boolean }>(() => {
    const saved = localStorage.getItem('sidePanelExpandedMenus');
    const defaultState = { 'audio-library': true, 'sessions': false, 'recordings': false };
    if (!saved) return defaultState;
    try {
      const parsed = JSON.parse(saved);
      // Always start with Tracks (audio-library) open - don't restore from localStorage
      return { ...parsed, 'audio-library': true };
    } catch {
      return defaultState;
    }
  });
  
  // Active submenu items - always start with none selected so Audafact Library content is hidden until user clicks
  const [activeAudioTab, setActiveAudioTab] = useState<SidePanelAudioTab | null>(
    null
  );
  const demoTabRestoredRef = useRef(false);
  
  const [activeSessionsTab, setActiveSessionsTab] = useState<'saved' | 'shared' | null>(() => {
    const savedTab = localStorage.getItem('sidePanelActiveSessionsTab');
    return (savedTab as 'saved' | 'shared' | null) || 'saved'; // Default to saved sessions
  });
  // When true, allow user to collapse the submenu without auto-selecting another
  const [allowEmptyAudioTab, setAllowEmptyAudioTab] = useState(true); // Start with Audafact Library tab closed
  const [allowEmptySessionsTab, setAllowEmptySessionsTab] = useState(false);

  // Suggested Matches collapsed states (persisted per source)
  const [suggestedLibraryMatchesExpanded, setSuggestedLibraryMatchesExpanded] = useState(() => {
    const saved = localStorage.getItem('sidePanelSuggestedMatchesLibraryExpanded');
    if (saved === 'false') return false;
    return true;
  });
  useEffect(() => {
    localStorage.setItem('sidePanelSuggestedMatchesLibraryExpanded', String(suggestedLibraryMatchesExpanded));
  }, [suggestedLibraryMatchesExpanded]);

  const [suggestedUploadsMatchesExpanded, setSuggestedUploadsMatchesExpanded] = useState(() => {
    const saved = localStorage.getItem('sidePanelSuggestedMatchesUploadsExpanded');
    if (saved === 'false') return false;
    return true;
  });
  useEffect(() => {
    localStorage.setItem('sidePanelSuggestedMatchesUploadsExpanded', String(suggestedUploadsMatchesExpanded));
  }, [suggestedUploadsMatchesExpanded]);

  const [userTracks, setUserTracks] = useState<UserTrack[]>([]);
  // Guest-only: allow exactly 1 local upload per session (no refresh persistence).
  const [guestUploadUsed, setGuestUploadUsed] = useState(false);
  const [isAtSessionLimit, setIsAtSessionLimit] = useState(false);
  const [isAtRecordingLimit, setIsAtRecordingLimit] = useState(false);
  const [isAtUploadLimit, setIsAtUploadLimit] = useState(false);

  useEffect(() => {
    // Reset guest-only state when a user signs in.
    if (user) {
      setGuestUploadUsed(false);
    }
  }, [user]);

  useEffect(() => {
    let mounted = true;
    const checkSessionCapacity = async () => {
      if (!user) {
        if (mounted) setIsAtSessionLimit(false);
        return;
      }
      const sessionAllowed = await canPerformAction('save_session');
      if (mounted) setIsAtSessionLimit(!sessionAllowed);
    };
    checkSessionCapacity();
    return () => {
      mounted = false;
    };
  }, [user?.id, savedSessions.length, canPerformAction]);

  useEffect(() => {
    let mounted = true;
    const checkRecordingCapacity = async () => {
      if (!user) {
        if (mounted) setIsAtRecordingLimit(false);
        return;
      }
      const recordAllowed = await canPerformAction('record');
      if (mounted) setIsAtRecordingLimit(!recordAllowed);
    };
    checkRecordingCapacity();
    return () => {
      mounted = false;
    };
  }, [user?.id, savedRecordings.length, canPerformAction]);

  useEffect(() => {
    let mounted = true;
    const checkUploadCapacity = async () => {
      if (!user) {
        if (mounted) setIsAtUploadLimit(false);
        return;
      }
      const uploadAllowed = await canPerformAction('upload');
      if (mounted) setIsAtUploadLimit(!uploadAllowed);
    };
    checkUploadCapacity();
    return () => {
      mounted = false;
    };
  }, [user?.id, userTracks.length, canPerformAction]);

  const [exportModalPerformance, setExportModalPerformance] = useState<{
    id: string;
    audioBlob?: Blob;
    duration: number;
    tracks: string[];
    events: unknown[];
    startTime: number;
  } | null>(null);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState<{
    show: boolean;
    message: string;
    feature: string;
  }>({ show: false, message: '', feature: '' });
  const [renameModalRecording, setRenameModalRecording] = useState<{ recordingId: string; currentName: string } | null>(null);
  const [renameModalSession, setRenameModalSession] = useState<{ sessionId: string; currentName: string } | null>(null);
  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null);
  const [downloadDropdownOpen, setDownloadDropdownOpen] = useState<string | null>(null);
  const [downloadDropdownPosition, setDownloadDropdownPosition] = useState({ top: 0, left: 0 });
  const downloadTriggerRef = useRef<HTMLButtonElement | null>(null);
  const downloadDropdownRef = useRef<HTMLDivElement | null>(null);

  const [matchToDropdownOpen, setMatchToDropdownOpen] = useState(false);
  const matchToDropdownRef = useRef<HTMLDivElement | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        downloadDropdownRef.current?.contains(target) ||
        downloadTriggerRef.current?.contains(target)
      ) {
        return;
      }
      setDownloadDropdownOpen(null);
      if (matchToDropdownRef.current && !matchToDropdownRef.current.contains(target)) {
        setMatchToDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const { isPlaying, isLoading, toggle, isCurrentKey } = useSingleAudio();
  const [currentPreviewTrackId, setCurrentPreviewTrackId] = useState<string | null>(null);

  useEffect(() => {
    if (!isPlaying) setCurrentPreviewTrackId(null);
  }, [isPlaying]);

  // Merge performances (in-memory) with savedRecordings (from DB) for display
  const mergedRecordings = useMemo(() => {
    const fromPerformance = performances.filter((p) => p.audioBlob || p.fileKey);
    const dbOnly = savedRecordings.filter(
      (r) => !performances.some((p) => p.databaseId === r.id)
    );
    const defaultLabel = (date: Date) =>
      `${date.toLocaleDateString()} at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    return [
      ...fromPerformance.map((p) => {
        const savedRec = p.databaseId ? savedRecordings.find((r) => r.id === p.databaseId) : null;
        const label = savedRec?.original_name || defaultLabel(new Date(p.startTime));
        return {
          type: 'performance' as const,
          id: p.id,
          dbId: p.databaseId,
          fileKey: p.fileKey,
          audioBlob: p.audioBlob,
          label,
          durationMs: p.duration,
          durationStr: `${Math.floor(p.duration / 60000)}:${((p.duration % 60000) / 1000).toFixed(0).padStart(2, '0')}`,
          eventsCount: p.events.length,
          tracksCount: p.tracks.length,
          performance: p
        };
      }),
      ...dbOnly
        .filter((r) => r.file_key)
        .map((r) => ({
          type: 'saved' as const,
          id: r.id,
          dbId: r.id,
          fileKey: r.file_key!,
          audioBlob: undefined as Blob | undefined,
          label: r.original_name || defaultLabel(new Date(r.created_at)),
          durationMs: (r.length || 0) * 1000,
          durationStr: `${Math.floor((r.length || 0) / 60)}:${((r.length || 0) % 60).toFixed(0).padStart(2, '0')}`,
          eventsCount: 0,
          tracksCount: 0,
          performance: null
        }))
    ];
  }, [performances, savedRecordings]);

  // Open export modal immediately when a recording completes
  useEffect(() => {
    if (pendingExport && user) {
      const perf = performances.find(p => p.id === pendingExport.performanceId);
      if (perf) {
        setExportModalPerformance(perf);
        setExpandedMenus(prev => ({ ...prev, recordings: true }));
      }
    }
  }, [pendingExport, performances, user]);

  // Open rename modal when a session is just saved (name the new session)
  useEffect(() => {
    if (pendingSession && user) {
      const session = savedSessions.find(s => s.id === pendingSession.sessionId);
      if (session) {
        setRenameModalSession({
          sessionId: session.id,
          currentName: session.session_name ?? `Studio Session ${new Date(session.startTime).toLocaleString()}`
        });
        setExpandedMenus(prev => ({ ...prev, sessions: true }));
      }
    }
  }, [pendingSession, savedSessions, user]);

  useEffect(() => {
    if (demoCollectionTracks.length === 0) {
      demoTabRestoredRef.current = false;
    }
  }, [demoCollectionTracks.length]);

  useEffect(() => {
    if (
      demoCollectionTracks.length === 0 ||
      demoTabRestoredRef.current
    ) {
      return;
    }
    const saved = localStorage.getItem('sidePanelActiveAudioTab');
    if (saved === 'demo-pack') {
      setActiveAudioTab('demo-pack');
      setAllowEmptyAudioTab(false);
      demoTabRestoredRef.current = true;
    }
  }, [demoCollectionTracks.length]);

  useEffect(() => {
    if (activeAudioTab === 'demo-pack' && demoCollectionTracks.length === 0) {
      setActiveAudioTab(null);
      setAllowEmptyAudioTab(true);
    }
  }, [activeAudioTab, demoCollectionTracks.length]);

  const suggestedLibraryMatches = useMemo(() => {
    const libraryPool = tier.id === 'guest' ? guestLibraryTracks : userLibraryTracks;
    if (!referenceForSuggestions || libraryPool.length === 0) return null;
    const ref = referenceForSuggestions;

    const hasKey = !!ref.key?.trim();
    const hasBpm = ref.bpm != null && ref.bpm >= 40 && ref.bpm <= 300;
    if (!hasKey && !hasBpm) return null;

    const libraryCandidates: SuggestionCandidate[] = libraryPool.map((t) => ({
      id: t.id,
      name: t.name,
      fileKey: t.fileKey,
      type: t.type,
      size: t.size,
      bpm: t.bpm,
      key: t.key ?? null,
      beats: t.beats,
    }));

    return getSampleSuggestions(libraryCandidates, ref);
  }, [referenceForSuggestions, tier.id, guestLibraryTracks, userLibraryTracks]);

  const suggestedUploadsMatches = useMemo(() => {
    if (!referenceForSuggestions || userTracks.length === 0) return null;
    const ref = referenceForSuggestions;

    const hasKey = !!ref.key?.trim();
    const hasBpm = ref.bpm != null && ref.bpm >= 40 && ref.bpm <= 300;
    if (!hasKey && !hasBpm) return null;

    const uploadCandidates: SuggestionCandidate[] = userTracks.map((t) => ({
      id: t.id,
      name: t.name,
      fileKey: t.fileKey,
      type: t.type, // MIME type (e.g. audio/mpeg) - Studio uses this when decoding
      size: t.size,
      bpm: t.bpm,
      key: t.key ?? null,
      beats: t.beats,
    }));

    return getSampleSuggestions(uploadCandidates, ref);
  }, [referenceForSuggestions, userTracks]);

  // Load user tracks from database on mount
  useEffect(() => {
    
    const loadUserTracks = async () => {
      if (!user) {

        setUserTracks([]);
        return;
      }

      try {

        const uploads = await DatabaseService.getUserUploads(user.id);
        const userTracksData = await Promise.all(
          uploads.map(async (upload) => {
            const fileKey =
              upload.file_key ??
              (upload.file_url ? normalizeLegacyUrlToKey(upload.file_url, { userIdHint: upload.user_id }) : ""); // adjust if you have user_id

            const hasAnalysis = (upload.bpm != null && upload.bpm > 0) || (upload.key != null && String(upload.key).trim() !== '') || (Array.isArray(upload.genres) && upload.genres.length > 0);
            return {
              id: upload.id,
              name: upload.title || `Track ${upload.id}`, // Ensure name is always a string
              file: null as File | null,            // only used pre-upload
              fileKey,                              // ← use this everywhere for signing/playing/deleting
              type: upload.content_type ?? "audio/mpeg",
              size: toPrettySize(upload.size_bytes),
              uploadedAt: new Date(upload.created_at).getTime(),
              bpm: upload.bpm ?? undefined,         // Use detected tempo from analysis, fallback to 120 in Studio
              key: upload.key ?? undefined,        // Detected musical key from audio analysis
              beats: Array.isArray(upload.beat_times) && upload.beat_times.length > 0 ? upload.beat_times : undefined,
              genres: Array.isArray(upload.genres) && upload.genres.length > 0 ? upload.genres : undefined,
              mood_themes: Array.isArray(upload.mood_themes) && upload.mood_themes.length > 0 ? upload.mood_themes : undefined,
              tags: Array.isArray(upload.tags) && upload.tags.length > 0 ? upload.tags : undefined,
              isAnalyzing: !hasAnalysis,
            } satisfies UserTrack;
          })
        );


        setUserTracks(userTracksData);
      } catch (error) {
        console.error('Error loading user tracks from database:', error);
        setUserTracks([]);
      }
    };

    loadUserTracks();
  }, [user?.id]); // Only depend on user.id, not the entire user object

  // Subscribe to uploads Realtime for tempo/key analysis results
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel('uploads-analysis')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'uploads',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as {
            id: string;
            bpm?: number | null;
            key?: string | null;
            beat_times?: number[] | null;
            genres?: string[] | null;
            mood_themes?: string[] | null;
            tags?: string[] | null;
          };
          const hasAnyUpdate =
            row.bpm != null ||
            (row.key != null && String(row.key).trim() !== '') ||
            (Array.isArray(row.beat_times) && row.beat_times.length > 0) ||
            (Array.isArray(row.genres) && row.genres.length > 0) ||
            (Array.isArray(row.mood_themes) && row.mood_themes.length > 0) ||
            (Array.isArray(row.tags) && row.tags.length > 0);
          if (!hasAnyUpdate) return;
          setUserTracks((prev) =>
            prev.map((t) =>
              t.id === row.id
                ? {
                    ...t,
                    bpm: row.bpm ?? t.bpm,
                    key: row.key ?? t.key,
                    beats: Array.isArray(row.beat_times) && row.beat_times.length > 0 ? row.beat_times : t.beats,
                    genres: Array.isArray(row.genres) && row.genres.length > 0 ? row.genres : t.genres,
                    mood_themes: Array.isArray(row.mood_themes) && row.mood_themes.length > 0 ? row.mood_themes : t.mood_themes,
                    tags: Array.isArray(row.tags) && row.tags.length > 0 ? row.tags : t.tags,
                    isAnalyzing: false,
                  }
                : t
            )
          );
          onUploadAnalysisUpdated?.(row.id, {
            bpm: row.bpm ?? undefined,
            key: row.key ?? undefined,
            beats: Array.isArray(row.beat_times) && row.beat_times.length > 0 ? row.beat_times : undefined
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, onUploadAnalysisUpdated]);

  // Polling fallback for analysis completion when Realtime doesn't deliver
  // (e.g. uploads table not in supabase_realtime publication)
  useEffect(() => {
    const analyzingIds = userTracks.filter((t) => t.isAnalyzing).map((t) => t.id);
    if (analyzingIds.length === 0 || !user?.id) return;

    const poll = async () => {
      const { data: rows } = await supabase
        .from('uploads')
        .select('id, bpm, key, beat_times, genres, mood_themes, tags')
        .in('id', analyzingIds);

      if (!rows || rows.length === 0) return;

      const completed = rows.filter(
        (row) =>
          row.bpm != null ||
          (row.key != null && String(row.key).trim() !== '') ||
          (Array.isArray(row.beat_times) && row.beat_times.length > 0) ||
          (Array.isArray(row.genres) && row.genres.length > 0) ||
          (Array.isArray(row.mood_themes) && row.mood_themes.length > 0) ||
          (Array.isArray(row.tags) && row.tags.length > 0)
      );
      if (completed.length === 0) return;

      setUserTracks((prev) =>
        prev.map((t) => {
          const row = completed.find((r) => r.id === t.id);
          if (!row)
            return t;
          return {
            ...t,
            bpm: row.bpm ?? t.bpm,
            key: row.key ?? t.key,
            beats: Array.isArray(row.beat_times) && row.beat_times.length > 0 ? row.beat_times : t.beats,
            genres: Array.isArray(row.genres) && row.genres.length > 0 ? row.genres : t.genres,
            mood_themes: Array.isArray(row.mood_themes) && row.mood_themes.length > 0 ? row.mood_themes : t.mood_themes,
            tags: Array.isArray(row.tags) && row.tags.length > 0 ? row.tags : t.tags,
            isAnalyzing: false,
          };
        })
      );
      for (const row of completed) {
        onUploadAnalysisUpdated?.(row.id, {
          bpm: row.bpm ?? undefined,
          key: row.key ?? undefined,
          beats: Array.isArray(row.beat_times) && row.beat_times.length > 0 ? row.beat_times : undefined,
        });
      }
    };

    poll();
    const interval = setInterval(poll, 4000);
    return () => clearInterval(interval);
  }, [user?.id, userTracks, onUploadAnalysisUpdated]);

  // Toggle menu function
  const toggleMenu = (menuKey: string) => {
    setExpandedMenus(prev => {
      const newState = { ...prev, [menuKey]: !prev[menuKey] };
      localStorage.setItem('sidePanelExpandedMenus', JSON.stringify(newState));
      return newState;
    });
    // Reset empty-allow for sessions only - keep allowEmptyAudioTab true so expanding Tracks doesn't auto-show Audafact Library
    if (menuKey === 'sessions') {
      setAllowEmptySessionsTab(false);
    }
  };

  // Handle submenu item selection
  const handleAudioTabSelect = (tab: SidePanelAudioTab) => {
    setActiveAudioTab(prev => {
      const next = prev === tab ? null : tab;
      // If collapsing (setting to null), allow empty so we don't auto-select the other tab
      setAllowEmptyAudioTab(next === null);
      // If selecting a tab, disable empty allowance
      if (next !== null) setAllowEmptyAudioTab(false);
      return next;
    });
  };

  const handleSessionsTabSelect = (tab: 'saved' | 'shared') => {
    setActiveSessionsTab(prev => {
      const next = prev === tab ? null : tab;
      setAllowEmptySessionsTab(next === null);
      if (next !== null) setAllowEmptySessionsTab(false);
      return next;
    });
  };



  // Auto-show library when opened in library mode or when tracks menu is expanded
  useEffect(() => {
    if (initialMode === 'library' && activeAudioTab !== 'library') {
      setActiveAudioTab('library');
      setExpandedMenus(prev => {
        const newState = { ...prev, 'audio-library': true };
        localStorage.setItem('sidePanelExpandedMenus', JSON.stringify(newState));
        return newState;
      });
    }
  }, [initialMode, activeAudioTab]);

  // Auto-select library tab when tracks menu is expanded and no tab is selected
  useEffect(() => {
    if (expandedMenus['audio-library'] && !activeAudioTab && !allowEmptyAudioTab) {
      setActiveAudioTab('library');
    }
  }, [expandedMenus['audio-library'], activeAudioTab, allowEmptyAudioTab]);

  // Auto-select saved sessions tab when sessions menu is expanded and no tab is selected
  useEffect(() => {
    if (expandedMenus['sessions'] && !activeSessionsTab && !allowEmptySessionsTab) {
      setActiveSessionsTab('saved');
    }
  }, [expandedMenus['sessions'], activeSessionsTab, allowEmptySessionsTab]);

  // Save tab preferences to localStorage whenever they change
  useEffect(() => {
    if (activeAudioTab) {
      localStorage.setItem('sidePanelActiveAudioTab', activeAudioTab);
    } else {
      localStorage.removeItem('sidePanelActiveAudioTab');
    }
  }, [activeAudioTab]);
  
  useEffect(() => {
    if (activeSessionsTab) {
      localStorage.setItem('sidePanelActiveSessionsTab', activeSessionsTab);
    } else {
      localStorage.removeItem('sidePanelActiveSessionsTab');
    }
  }, [activeSessionsTab]);

  // Audio assets are now loaded from the library service
  // The audioAssets array is no longer needed as we use libraryTracks from Supabase

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      console.error('No file selected');
      return;
    }

    // Check if user is authenticated
    if (!user) {
      if (guestUploadUsed) {
        showSignupModal('upload');
        // Reset the input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        return;
      }

      try {
        // Session-only guest upload: Studio replaces the current track and builds cue points.
        await onUploadTrack(file, 'cue');
        setGuestUploadUsed(true);
      } catch (error) {
        console.error('Guest upload failed:', error);
      } finally {
        // Reset the input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }

      // Only close the sidebar on mobile and tablets (full-width mode)
      if (window.innerWidth < 1024) {
        onToggle();
      }
      return;
    }

    // Check upload limits for authenticated users
    const canUpload = await canPerformAction('upload');
    if (!canUpload) {
      setShowUpgradePrompt({
        show: true,
        message: getUpgradeMessage('upload'),
        feature: 'Track Upload'
      });
      // Reset the input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

      try {
        // Upload file using refactored StorageService with R2 storage
        const uploadResult = await StorageService.uploadAudioFile(file, user.id, file.name);

        if (uploadResult.error) {
          console.error('Upload error:', uploadResult.error);
          throw uploadResult.error;
        }

        if (uploadResult.data) {
          // Create database record with hash-based metadata
          const uploadRecord = await DatabaseService.createHashBasedUpload(
            user.id,
            uploadResult.data.metadata.title || file.name,
            uploadResult.data.metadata.serverKey,
            uploadResult.data.metadata.fullHash,
            uploadResult.data.metadata.shortHash,
            uploadResult.data.metadata.sizeBytes,
            uploadResult.data.metadata.contentType,
            uploadResult.data.metadata.originalName || file.name,
            await getAudioDuration(file)
          );

          if (uploadRecord) {
            // Create user track object
            const userTrack: UserTrack = {
              id: uploadRecord.id,
              name: uploadResult.data.metadata.title || file.name,
              file,
              fileKey: uploadResult.data.metadata.serverKey,
              type: uploadResult.data.metadata.contentType,
              size: `${(uploadResult.data.metadata.sizeBytes / (1024 * 1024)).toFixed(1)}MB`,
              url: uploadResult.data.metadata.serverKey, // Use server key for R2 storage
              uploadedAt: Date.now(),
              isAnalyzing: true,
            };

            // Add to user tracks
            const updatedTracks = [...userTracks, userTrack];
            setUserTracks(updatedTracks);

            // Add to studio with fileKey for session restore (onAddUserTrack persists fileKey)
            onAddUserTrack(userTrack, 'preview');

            // Fire-and-forget: trigger audio analysis (tempo detection)
            (async () => {
              try {
                const { data: session } = await supabase.auth.getSession();
                const token = session?.session?.access_token;
                if (token) {
                  await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.TRIGGER_ANALYSIS), {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ uploadId: uploadRecord.id }),
                  });
                }
              } catch (err) {
                console.warn('Failed to trigger audio analysis:', err);
              }
            })();
            
            // Only close the sidebar on mobile and tablets (full-width mode)
            // On desktop (lg and above), keep the sidebar open
            if (window.innerWidth < 1024) {
              onToggle();
            }
          }
        }
      } catch (error) {
      console.error('Upload failed:', error);
      // You might want to show an error message to the user here
    }

    // Reset the input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getAudioDuration = (file: File): Promise<number> => {
    return new Promise((resolve) => {
      const audio = new Audio();
      const url = URL.createObjectURL(file);
      audio.preload = "metadata";

      const cleanup = () => URL.revokeObjectURL(url);
      audio.onloadedmetadata = () => { resolve(audio.duration || 0); cleanup(); };
      audio.onerror = () => { resolve(0); cleanup(); };
      audio.src = url;
    });
  };

  const handlePreviewPlay = async (asset: AudioAsset | UserTrack, isUserTrack: boolean) => {
    try {
      const assetId = (asset as any).id as string | undefined;
      if (assetId) setCurrentPreviewTrackId(assetId);

      const fileKey = (asset as any).fileKey as string | undefined;
      const directUrl =
        !isUserTrack
          ? ((asset as AudioAsset).fileUrl ?? fileKey)
          : undefined;

      // Guest library tracks use direct URLs (no signed R2 key), so play via an in-memory blob.
      const looksLikeUrl =
        !isUserTrack &&
        typeof directUrl === 'string' &&
        (directUrl.startsWith('/') || directUrl.startsWith('http'));

      if (looksLikeUrl && directUrl) {
        const res = await fetch(directUrl);
        if (!res.ok) {
          throw new Error(`Failed to fetch preview audio (${res.status})`);
        }
        const blob = await res.blob();
        toggle({ kind: 'blob', blob });
        return;
      }

      if (!fileKey) {
        console.error("Missing fileKey for asset", asset);
        return;
      }

      // Signed R2 key preview (authenticated/library items)
      toggle({ kind: "key", key: fileKey });

      // If you kept per-asset UI state like `setPlayingAssets`, you can still set it here:
      // setPlayingAssets(prev => ({ ...prev, [asset.id]: true }));
    } catch (err) {
      console.error("Failed to play preview:", err);
    }
  };

  const handleAddTrack = async (asset: AudioAsset | UserTrack, isUserTrack = false) => {
    if (isUserTrack) {
      const userTrack = asset as UserTrack;
      onAddUserTrack(userTrack, 'cue');
    } else {
      // Check library track limit for free users
      const canAddLibraryTrack = await canPerformAction('add_library_track');
      if (!canAddLibraryTrack) {
        setShowUpgradePrompt({
          show: true,
          message: getUpgradeMessage('add_library_track'),
          feature: 'Library Track'
        });
        return;
      }
      
      // No longer need to track individual user library usage
      
      const libraryAsset = asset as AudioAsset;
      onAddFromLibrary(libraryAsset, 'cue');
    }
    
    // Only close the sidebar on mobile and tablets (full-width mode)
    // On desktop (lg and above), keep the sidebar open
    if (window.innerWidth < 1024) {
      onToggle();
    }
  };

  const handleRemoveUserTrack = async (trackId: string) => {
    const trackToRemove = userTracks.find(track => track.id === trackId);
    if (!trackToRemove || !user) {
      return;
    }

    try {
      // Try to delete from storage, but continue even if it fails (e.g., file not found in dev)
      try {
        await deleteByKey(trackToRemove.fileKey);
      } catch (storageError) {
        console.warn('Failed to delete from storage (continuing anyway):', storageError);
      }
      
      // Delete from database
      const success = await DatabaseService.deleteUpload(trackId, user.id);
      
      if (success) {
        // Remove from local state
        const updatedTracks = userTracks.filter(track => track.id !== trackId);
        setUserTracks(updatedTracks);
      } else {
        console.error('Failed to delete track from database');
      }
    } catch (error) {
      console.error('Error deleting track:', error);
    }
  };



  return (
    <>
      {/* Mobile and Tablet overlay */}
      {isOpen && (
        <div 
          className="fixed top-16 left-0 right-0 bottom-0 bg-black bg-opacity-50 z-[50] lg:hidden"
          onClick={onToggle}
        />
      )}
      
      {/* Sidebar */}
      <div 
        data-sidepanel
        className={`fixed top-16 left-0 h-[calc(100vh-4rem)] bg-audafact-surface-1 border-r border-audafact-divider shadow-card transition-transform duration-300 ease-in-out z-[60] overflow-hidden flex flex-col ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } w-full lg:w-[400px]`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-audafact-divider">
          <h2 className="text-lg font-semibold audafact-heading">
            Stash
          </h2>
          <button
            onClick={onToggle}
            className="p-2 text-audafact-text-secondary hover:text-audafact-accent-cyan hover:bg-audafact-surface-2 rounded-lg transition-colors duration-200"
            data-testid="side-panel-toggle"
            title="Close panel"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Collapsible Menu Navigation */}
        <div className="flex-1 overflow-y-auto">
          {/* Audio Library Menu - Show for all users */}
          <div className="border-b border-audafact-divider">
            <button
              onClick={() => toggleMenu('audio-library')}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-audafact-text-primary hover:bg-audafact-surface-2 transition-colors duration-200"
            >
              <span>Tracks</span>
              <svg 
                className={`w-4 h-4 transition-transform duration-200 ${expandedMenus['audio-library'] ? 'rotate-90' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            
            {expandedMenus['audio-library'] && (
              <div className="bg-audafact-surface-2">
                <div role="tablist" aria-label="Tracks" className="flex flex-col gap-1 px-2 py-1.5">
                  <SidePanelSubMenuItem
                    label="Audafact Library"
                    icon={<IconLibrary />}
                    isActive={activeAudioTab === 'library'}
                    onClick={() => handleAudioTabSelect('library')}
                    role="tab"
                    ariaSelected={activeAudioTab === 'library'}
                    ariaControls="audafact-library-content"
                    id="audafact-library-tab"
                  />
                  <SidePanelSubMenuItem
                    label="My Tracks"
                    icon={<IconUser />}
                    isActive={activeAudioTab === 'my-tracks'}
                    onClick={() => handleAudioTabSelect('my-tracks')}
                    role="tab"
                    ariaSelected={activeAudioTab === 'my-tracks'}
                    ariaControls="my-tracks-content"
                    id="my-tracks-tab"
                  />
                  {demoCollectionTracks.length > 0 && (
                    <SidePanelSubMenuItem
                      label={CRISTIAN_SIGLER_DEMO_SIDE_PANEL_LABEL}
                      icon={<IconBookmark />}
                      isActive={activeAudioTab === 'demo-pack'}
                      onClick={() => handleAudioTabSelect('demo-pack')}
                      role="tab"
                      ariaSelected={activeAudioTab === 'demo-pack'}
                      ariaControls="cristian-sigler-demo-pack-content"
                      id="cristian-sigler-demo-pack-tab"
                    />
                  )}
                </div>
                
                {/* Enhanced Library Content */}
                {activeAudioTab === 'library' && (
                  <div id="audafact-library-content" role="tabpanel" aria-labelledby="audafact-library-tab" className="px-4 py-4 bg-audafact-surface-1 border-t border-audafact-divider">
                                          <div className="space-y-4">
                        {referenceForSuggestions != null && suggestedLibraryMatches != null && (
                          <div
                            className="rounded-lg border border-audafact-divider bg-audafact-surface-2/60 overflow-hidden"
                            aria-label="Suggested matches for current session"
                          >
                            <button
                              type="button"
                              onClick={() => setSuggestedLibraryMatchesExpanded((v) => !v)}
                              className="w-full flex items-center justify-between gap-2 p-3 text-left audafact-heading text-sm font-medium text-audafact-text-primary hover:bg-audafact-surface-2/80 transition-colors focus:outline-none focus:ring-1 focus:ring-audafact-accent-cyan focus:ring-inset"
                              aria-expanded={suggestedLibraryMatchesExpanded}
                              aria-controls="suggested-matches-content"
                              id="suggested-matches-heading"
                            >
                                  <span>
                                  Suggested Matches
                                {referenceForSuggestions?.referencePlaybackSpeed != null &&
                                  Math.abs(referenceForSuggestions.referencePlaybackSpeed - 1) >= 0.02 && (
                                    <span className="ml-1.5 font-normal text-audafact-text-secondary">
                                      (at {referenceForSuggestions.referencePlaybackSpeed.toFixed(2)}x)
                                    </span>
                                  )}
                              </span>
                              <svg
                                className={`w-4 h-4 flex-shrink-0 text-audafact-text-secondary transition-transform duration-200 ${suggestedLibraryMatchesExpanded ? 'rotate-180' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                aria-hidden
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                            {suggestedLibraryMatchesExpanded && (
                            <div id="suggested-matches-content" className="px-3 pb-3 pt-0" role="region" aria-labelledby="suggested-matches-heading">
                              {tier.id === 'guest' && (
                                <div className="text-xs audafact-text-secondary mb-3">
                                  Preview is available. Create a free account to add suggested samples.
                                </div>
                              )}
                            {suggestionReferenceTrackOptions.length > 1 &&
                             effectiveSuggestionReferenceTrackId &&
                             onSuggestionReferenceTrackChange && (
                              <div className="mb-3 flex items-center gap-2" ref={matchToDropdownRef}>
                                <span className="text-xs audafact-text-secondary whitespace-nowrap">
                                  Match to:
                                </span>
                                <div className="flex-1 min-w-0 relative">
                                  <button
                                    type="button"
                                    onClick={() => setMatchToDropdownOpen((v) => !v)}
                                    className="w-full flex items-center justify-between gap-2 text-xs bg-audafact-surface-2 border border-audafact-divider rounded-lg pl-3 pr-8 py-2 text-audafact-text-primary hover:border-audafact-divider hover:bg-audafact-surface-3 focus:outline-none focus:border-audafact-accent-cyan focus:ring-1 focus:ring-audafact-accent-cyan/30 transition-colors cursor-pointer text-left"
                                    aria-label="Choose which track to match suggestions to"
                                    aria-expanded={matchToDropdownOpen}
                                    aria-haspopup="listbox"
                                    id="suggestion-ref-track"
                                  >
                                    <span className="truncate">
                                      {(() => {
                                        const opt = suggestionReferenceTrackOptions.find((o) => o.id === effectiveSuggestionReferenceTrackId);
                                        return opt ? (opt.label.length > 28 ? `${opt.label.slice(0, 25)}…` : opt.label) : 'Select track';
                                      })()}
                                    </span>
                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-audafact-text-secondary pointer-events-none">
                                      <svg className={`w-4 h-4 transition-transform duration-200 ${matchToDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                      </svg>
                                    </span>
                                  </button>
                                  {matchToDropdownOpen && (
                                    <ul
                                      role="listbox"
                                      aria-labelledby="suggestion-ref-track"
                                      className="absolute z-50 left-0 right-0 mt-1 py-1 rounded-lg border border-audafact-divider bg-audafact-surface-2 shadow-lg max-h-48 overflow-y-auto"
                                    >
                                      {suggestionReferenceTrackOptions.map((opt) => (
                                        <li key={opt.id} role="option" aria-selected={opt.id === effectiveSuggestionReferenceTrackId}>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              onSuggestionReferenceTrackChange(opt.id);
                                              setMatchToDropdownOpen(false);
                                            }}
                                            className={`w-full text-left text-xs px-3 py-2 truncate block transition-colors ${
                                              opt.id === effectiveSuggestionReferenceTrackId
                                                ? 'bg-audafact-accent-cyan/20 text-audafact-accent-cyan'
                                                : 'text-audafact-text-primary hover:bg-audafact-surface-3'
                                            }`}
                                          >
                                            {opt.label.length > 28 ? `${opt.label.slice(0, 25)}…` : opt.label}
                                          </button>
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              </div>
                            )}
                            {suggestedLibraryMatches.length > 0 ? (
                              <ul className="space-y-2">
                                {suggestedLibraryMatches.map(({ track, adjustmentLine, suggestedSpeedReason }) => {
                                  const bpmOk =
                                    typeof track.bpm === 'number' &&
                                    track.bpm >= 40 &&
                                    track.bpm <= 300;
                                  const secondary = [
                                    bpmOk ? `${track.bpm} BPM` : null,
                                    track.key || null,
                                  ]
                                    .filter(Boolean)
                                    .join(' • ');
                                  return (
                                    <li
                                      key={`suggest-${track.id}`}
                                      className="flex gap-2 items-start rounded-md border border-audafact-divider/60 bg-audafact-surface-1/80 p-2"
                                    >
                                      <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium text-audafact-text-primary truncate">
                                          {track.name}
                                        </div>
                                        {secondary ? (
                                          <div className="text-xs audafact-text-secondary mt-0.5">
                                            {secondary}
                                          </div>
                                        ) : null}
                                        <div className="text-xs text-audafact-accent-cyan/90 mt-0.5 leading-snug">
                                          {adjustmentLine}
                                        </div>
                                        {suggestedSpeedReason ? (
                                          <div className="text-xs audafact-text-secondary mt-1 italic">
                                            {suggestedSpeedReason}
                                          </div>
                                        ) : null}
                                      </div>
                                      <div className="flex flex-shrink-0 gap-1 items-center">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handlePreviewPlay(
                                              {
                                                id: track.id,
                                                name: track.name,
                                                fileKey: track.fileKey,
                                                type: track.type,
                                                size: track.size,
                                                bpm: track.bpm,
                                              },
                                              false
                                            )
                                          }
                                          className={`p-2 rounded-md border border-audafact-divider text-audafact-text-secondary hover:text-audafact-accent-cyan hover:bg-audafact-surface-2 ${
                                            isPlaying && currentPreviewTrackId === track.id
                                              ? 'text-audafact-accent-cyan'
                                              : ''
                                          }`}
                                          title={
                                            isPlaying && currentPreviewTrackId === track.id
                                              ? 'Stop preview'
                                              : 'Preview'
                                          }
                                          aria-label={`Preview ${track.name}`}
                                        >
                                          {isPlaying && currentPreviewTrackId === track.id ? (
                                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                              <rect x="6" y="4" width="4" height="16" />
                                              <rect x="14" y="4" width="4" height="16" />
                                            </svg>
                                          ) : (
                                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                              <path d="M8 5v14l11-7z" />
                                            </svg>
                                          )}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (tier.id === 'guest') {
                                              showSignupModal('add_library_track');
                                              return;
                                            }
                                            handleAddTrack(
                                              {
                                                id: track.id,
                                                name: track.name,
                                                fileKey: track.fileKey,
                                                type: track.type,
                                                size: track.size,
                                                bpm: track.bpm,
                                                key: track.key ?? undefined,
                                              },
                                              false
                                            );
                                          }}
                                          className="p-2 rounded-md border border-audafact-divider text-audafact-text-primary hover:bg-audafact-accent-cyan/15 font-bold text-lg leading-none min-w-[2.25rem]"
                                          title={
                                            tier.id === 'guest'
                                              ? 'Sign up to add'
                                              : 'Add to studio'
                                          }
                                          aria-label={`Add ${track.name} to studio`}
                                        >
                                          {tier.id === 'guest' ? '🔒' : '+'}
                                        </button>
                                      </div>
                                    </li>
                                  );
                                })}
                              </ul>
                            ) : null}
                            </div>
                            )}
                          </div>
                        )}

                        <div className="flex items-center justify-between">
                          <h3 className="text-md font-medium audafact-heading">Track Library</h3>
                        </div>

                        {/* Rotation Info for Free Users - Hidden for now */}
                        {/* <RotationInfo className="mb-4" /> */}

                        {/* Search and Filter */}
                        <div className="space-y-3">
                        <input
                          type="text"
                          placeholder="Search tracks..."
                          className="w-full px-3 py-2 bg-audafact-surface-2 border border-audafact-divider rounded-lg text-audafact-text-primary placeholder-audafact-text-secondary focus:outline-none focus:border-audafact-accent-cyan"
                        />
                        
                        <div className="text-sm audafact-text-secondary bg-audafact-surface-2 border border-audafact-accent-cyan/30 p-3 rounded-lg space-y-2">
                          <p className="text-audafact-text-primary/95">{libraryCatalogBanner}</p>
                          {tier.id === 'guest' ? (
                            <div
                              role="status"
                              className="space-y-2 rounded-lg border-2 border-audafact-accent-cyan bg-audafact-accent-cyan/15 px-3 py-2.5 text-sm font-semibold text-audafact-text-primary shadow-sm ring-1 ring-audafact-accent-cyan/20"
                            >
                              <p className="text-audafact-text-primary/95">
                                Preview some of the copyright free samples available to flip below.
                              </p>
                              <p className="leading-normal text-audafact-text-primary">
                                <button
                                  type="button"
                                  onClick={() => showSignupModal('add_library_track')}
                                  className="relative top-[-1px] m-0 inline-block cursor-pointer border-0 bg-transparent p-0 text-left align-middle text-sm font-semibold italic leading-normal text-audafact-accent-cyan underline decoration-2 underline-offset-2 hover:text-audafact-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-audafact-accent-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-audafact-surface-2"
                                >
                                  Create a free account
                                </button>{' '}
                                to dig into more samples and discover hidden gems.
                              </p>
                            </div>
                          ) : (
                            <p>
                              <strong className="text-audafact-text-primary">Add tracks:</strong> Drag any track into
                              the studio, or use the + button. Use the Add button in the bar above or swipe down to add
                              more.
                            </p>
                          )}
                        </div>
                        
                        {/* Enhanced Library Tracks */}
                        <div className="space-y-3">
                          {(tier.id === 'guest' ? guestTracksLoading : userLoading) ? (
                            <div className="text-center py-4">
                              <div className="loading-spinner mx-auto"></div>
                              <p className="text-sm audafact-text-secondary mt-2">Loading tracks...</p>
                            </div>
                          ) : (tier.id === 'guest' ? guestLibraryTracks.length === 0 : userLibraryTracks.length === 0) ? (
                            <div className="text-center py-4">
                              {tier.id === 'guest' ? (
                                <p className="text-sm audafact-text-secondary">
                                  Create a free account to unlock the full Audafact library of royalty-free tracks.
                                </p>
                              ) : (
                                <p className="text-sm audafact-text-secondary">No tracks available</p>
                              )}
                            </div>
                          ) : (
                            (tier.id === 'guest' ? guestLibraryTracks : userLibraryTracks).map((track) => (
                              <LibraryTrackItem
                                key={track.id}
                                track={track}
                                onPreview={() => handlePreviewPlay(track, false)}
                                isPreviewing={isPlaying && currentPreviewTrackId === track.id}
                                onAddToStudio={() => handleAddTrack({
                                  id: track.id,
                                  name: track.name,
                                  fileKey: track.fileKey,
                                  type: track.type,
                                  size: track.size,
                                  bpm: track.bpm,
                                  key: track.key ?? undefined
                                }, false)}
                                canAddToStudio={tier.id !== 'guest'}
                                isProOnly={track.isProOnly || false}
                              />
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeAudioTab === 'demo-pack' && demoCollectionTracks.length > 0 && (
                  <div
                    id="cristian-sigler-demo-pack-content"
                    role="tabpanel"
                    aria-labelledby="cristian-sigler-demo-pack-tab"
                    className="px-4 py-4 bg-audafact-surface-1 border-t border-audafact-divider"
                  >
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-md font-medium audafact-heading">
                          {CRISTIAN_SIGLER_DEMO_SIDE_PANEL_LABEL}
                        </h3>
                      </div>
                      <div className="space-y-3">
                        {demoCollectionLoading ? (
                          <div className="text-center py-4">
                            <div className="loading-spinner mx-auto" />
                            <p className="text-sm audafact-text-secondary mt-2">
                              Loading tracks...
                            </p>
                          </div>
                        ) : (
                          demoCollectionTracks.map((track) => (
                            <LibraryTrackItem
                              key={track.id}
                              track={track}
                              onPreview={() => handlePreviewPlay(track, false)}
                              isPreviewing={
                                isPlaying && currentPreviewTrackId === track.id
                              }
                              onAddToStudio={() =>
                                handleAddTrack(
                                  {
                                    id: track.id,
                                    name: track.name,
                                    fileKey: track.fileKey,
                                    type: track.type,
                                    size: track.size,
                                    bpm: track.bpm,
                                    key: track.key ?? undefined,
                                  },
                                  false
                                )
                              }
                              canAddToStudio={tier.id !== 'guest'}
                              isProOnly={track.isProOnly || false}
                            />
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}
                
                {/* My Tracks Content - Show for all users */}
                {activeAudioTab === 'my-tracks' && (
                  <div id="my-tracks-content" role="tabpanel" aria-labelledby="my-tracks-tab" className="px-4 py-4 bg-audafact-surface-1 border-t border-audafact-divider">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-md font-medium audafact-heading">
                          {user ? 'My Uploaded Tracks' : 'Upload Tracks'}
                        </h3>
                        {user && isAtUploadLimit && (tier.id === 'free' || tier.id === 'starter') && (
                          <button
                            type="button"
                            onClick={() => setShowUpgradePrompt({
                              show: true,
                              message: tier.id === 'starter'
                                ? 'You have reached your Starter upload limit. Upgrade to Pro for unlimited uploads, WAV export, and advanced performance modes.'
                                : 'You have reached your Free upload limit. Upgrade to Starter or Pro to add more tracks and keep creating without interruption.',
                              feature: 'Track Upload'
                            })}
                            className="text-xs font-medium text-audafact-accent-cyan hover:text-audafact-accent-cyan/80"
                          >
                            At limit • Upgrade
                          </button>
                        )}
                      </div>

                      {!user ? (
                        // Guest user view
                        <div className="text-center py-8 flex-1 flex flex-col justify-center">
                          <div className="text-audafact-text-secondary mb-4">
                            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                          </div>
                          <p className="audafact-text-secondary mb-4">Upload your own track</p>

                          {guestUploadUsed ? (
                            <>
                              <div className="bg-audafact-surface-2 border border-audafact-divider rounded-lg p-4 mb-4 text-left">
                                <p className="text-sm audafact-text-secondary">
                                  This session-only upload will be available while you keep this tab open (refresh will clear it).
                                  Create a free account to keep and manage your uploaded tracks.
                                </p>
                              </div>
                              <button
                                onClick={() => showSignupModal('upload')}
                                className="audafact-button-primary"
                              >
                                Create free account to keep it
                              </button>
                            </>
                          ) : (
                            <>
                              <p className="text-sm audafact-text-secondary mb-4">
                                1 upload per session. Create a free account to keep and manage your upload.
                              </p>
                              <button
                                onClick={() => fileInputRef.current?.click()}
                                className="audafact-button-primary"
                              >
                                Upload Track
                              </button>
                            </>
                          )}
                        </div>
                      ) : userTracks.length === 0 ? (
                        // Authenticated user with no tracks
                        <div className="text-center py-8 flex-1 flex flex-col justify-center">
                          <div className="text-audafact-text-secondary mb-4">
                            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                          </div>
                          <p className="audafact-text-secondary mb-4">No tracks uploaded yet</p>
                            <button
                              onClick={() => {
                                // Check if user is authenticated
                                if (!user) {
                                  showSignupModal('upload');
                                  return;
                                }
                                // For authenticated users, open file browser
                                fileInputRef.current?.click();
                              }}
                              className="audafact-button-primary"
                            >
                              Upload Your First Track
                            </button>
                        </div>
                      ) : user ? (
                        <div className="space-y-3">
                          {referenceForSuggestions != null && suggestedUploadsMatches != null && (
                            <div
                              className="rounded-lg border border-audafact-divider bg-audafact-surface-2/60 overflow-hidden"
                              aria-label="Suggested matches for uploads"
                            >
                              <button
                                type="button"
                                onClick={() => setSuggestedUploadsMatchesExpanded((v) => !v)}
                                className="w-full flex items-center justify-between gap-2 p-3 text-left audafact-heading text-sm font-medium text-audafact-text-primary hover:bg-audafact-surface-2/80 transition-colors focus:outline-none focus:ring-1 focus:ring-audafact-accent-cyan focus:ring-inset"
                                aria-expanded={suggestedUploadsMatchesExpanded}
                                aria-controls="suggested-matches-uploads-content"
                                id="suggested-matches-uploads-heading"
                              >
                                  <span>
                                  Suggested Matches
                                  {referenceForSuggestions?.referencePlaybackSpeed != null &&
                                    Math.abs(referenceForSuggestions.referencePlaybackSpeed - 1) >= 0.02 && (
                                      <span className="ml-1.5 font-normal text-audafact-text-secondary">
                                        (at {referenceForSuggestions.referencePlaybackSpeed.toFixed(2)}x)
                                      </span>
                                    )}
                                </span>
                                <svg
                                  className={`w-4 h-4 flex-shrink-0 text-audafact-text-secondary transition-transform duration-200 ${suggestedUploadsMatchesExpanded ? 'rotate-180' : ''}`}
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                  aria-hidden
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>

                              {suggestedUploadsMatchesExpanded && (
                                <div
                                  id="suggested-matches-uploads-content"
                                  className="px-3 pb-3 pt-0"
                                  role="region"
                                  aria-labelledby="suggested-matches-uploads-heading"
                                >
                                  {suggestionReferenceTrackOptions.length > 1 &&
                                    effectiveSuggestionReferenceTrackId &&
                                    onSuggestionReferenceTrackChange && (
                                      <div className="mb-3 flex items-center gap-2" ref={matchToDropdownRef}>
                                        <span className="text-xs audafact-text-secondary whitespace-nowrap">
                                          Match to:
                                        </span>
                                        <div className="flex-1 min-w-0 relative">
                                          <button
                                            type="button"
                                            onClick={() => setMatchToDropdownOpen((v) => !v)}
                                            className="w-full flex items-center justify-between gap-2 text-xs bg-audafact-surface-2 border border-audafact-divider rounded-lg pl-3 pr-8 py-2 text-audafact-text-primary hover:border-audafact-divider hover:bg-audafact-surface-3 focus:outline-none focus:border-audafact-accent-cyan focus:ring-1 focus:ring-audafact-accent-cyan/30 transition-colors cursor-pointer text-left"
                                            aria-label="Choose which track to match suggestions to (uploads)"
                                            aria-expanded={matchToDropdownOpen}
                                            aria-haspopup="listbox"
                                            id="suggestion-ref-track-uploads"
                                          >
                                            <span className="truncate">
                                              {(() => {
                                                const opt = suggestionReferenceTrackOptions.find((o) => o.id === effectiveSuggestionReferenceTrackId);
                                                return opt ? (opt.label.length > 28 ? `${opt.label.slice(0, 25)}…` : opt.label) : 'Select track';
                                              })()}
                                            </span>
                                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-audafact-text-secondary pointer-events-none">
                                              <svg
                                                className={`w-4 h-4 transition-transform duration-200 ${matchToDropdownOpen ? 'rotate-180' : ''}`}
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                                aria-hidden
                                              >
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                              </svg>
                                            </span>
                                          </button>

                                          {matchToDropdownOpen && (
                                            <ul
                                              role="listbox"
                                              aria-labelledby="suggestion-ref-track-uploads"
                                              className="absolute z-50 left-0 right-0 mt-1 py-1 rounded-lg border border-audafact-divider bg-audafact-surface-2 shadow-lg max-h-48 overflow-y-auto"
                                            >
                                              {suggestionReferenceTrackOptions.map((opt) => (
                                                <li key={opt.id} role="option" aria-selected={opt.id === effectiveSuggestionReferenceTrackId}>
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      onSuggestionReferenceTrackChange(opt.id);
                                                      setMatchToDropdownOpen(false);
                                                    }}
                                                    className={`w-full text-left text-xs px-3 py-2 truncate block transition-colors ${
                                                      opt.id === effectiveSuggestionReferenceTrackId
                                                        ? 'bg-audafact-accent-cyan/20 text-audafact-accent-cyan'
                                                        : 'text-audafact-text-primary hover:bg-audafact-surface-3'
                                                    }`}
                                                  >
                                                    {opt.label.length > 28 ? `${opt.label.slice(0, 25)}…` : opt.label}
                                                  </button>
                                                </li>
                                              ))}
                                            </ul>
                                          )}
                                        </div>
                                      </div>
                                    )}

                                  {suggestedUploadsMatches.length > 0 ? (
                                    <ul className="space-y-2">
                                      {suggestedUploadsMatches.map(({ track, adjustmentLine, suggestedSpeedReason }) => {
                                        const bpmOk =
                                          typeof track.bpm === 'number' &&
                                          track.bpm >= 40 &&
                                          track.bpm <= 300;
                                        const secondary = [
                                          bpmOk ? `${track.bpm} BPM` : null,
                                          track.key || null,
                                        ]
                                          .filter(Boolean)
                                          .join(' • ');

                                        return (
                                          <li
                                            key={`upload-suggest-${track.id}`}
                                            className="flex gap-2 items-start rounded-md border border-audafact-divider/60 bg-audafact-surface-1/80 p-2"
                                          >
                                            <div className="flex-1 min-w-0">
                                              <div className="text-sm font-medium text-audafact-text-primary truncate">
                                                {track.name}
                                              </div>
                                              {secondary ? (
                                                <div className="text-xs audafact-text-secondary mt-0.5">
                                                  {secondary}
                                                </div>
                                              ) : null}
                                              <div className="text-xs text-audafact-accent-cyan/90 mt-0.5 leading-snug">
                                                {adjustmentLine}
                                              </div>
                                              {suggestedSpeedReason ? (
                                                <div className="text-xs audafact-text-secondary mt-1 italic">
                                                  {suggestedSpeedReason}
                                                </div>
                                              ) : null}
                                            </div>
                                            <div className="flex flex-shrink-0 gap-1 items-center">
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  handlePreviewPlay(
                                                    {
                                                      id: track.id,
                                                      name: track.name,
                                                      fileKey: track.fileKey,
                                                      type: track.type,
                                                      size: track.size,
                                                      bpm: track.bpm,
                                                      file: null,
                                                      uploadedAt: Date.now(),
                                                    },
                                                    true
                                                  )
                                                }
                                                className={`p-2 rounded-md border border-audafact-divider text-audafact-text-secondary hover:text-audafact-accent-cyan hover:bg-audafact-surface-2 ${
                                                  isPlaying && isCurrentKey(track.fileKey)
                                                    ? 'text-audafact-accent-cyan'
                                                    : ''
                                                }`}
                                                title={isPlaying && isCurrentKey(track.fileKey) ? 'Stop preview' : 'Preview'}
                                                aria-label={`Preview ${track.name}`}
                                              >
                                                {isPlaying && isCurrentKey(track.fileKey) ? (
                                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                                    <rect x="6" y="4" width="4" height="16" />
                                                    <rect x="14" y="4" width="4" height="16" />
                                                  </svg>
                                                ) : (
                                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                                    <path d="M8 5v14l11-7z" />
                                                  </svg>
                                                )}
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  handleAddTrack(
                                                    {
                                                      id: track.id,
                                                      name: track.name,
                                                      fileKey: track.fileKey,
                                                      type: track.type,
                                                      size: track.size,
                                                      bpm: track.bpm,
                                                      key: track.key ?? undefined,
                                                      file: null,
                                                      uploadedAt: Date.now(),
                                                    },
                                                    true
                                                  )
                                                }
                                                className="p-2 rounded-md border border-audafact-divider text-audafact-text-primary hover:bg-audafact-accent-cyan/15 font-bold text-lg leading-none min-w-[2.25rem]"
                                                title="Add to studio"
                                                aria-label={`Add ${track.name} to studio`}
                                              >
                                                {tier.id === 'guest' ? '🔒' : '+'}
                                              </button>
                                            </div>
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  ) : null}
                                </div>
                              )}
                            </div>
                          )}

                          {userTracks.map((track) => {
                            const isThisUserTrackPlaying = isPlaying && isCurrentKey(track.fileKey);
                            const isThisUserTrackLoading = isLoading && isCurrentKey(track.fileKey);

                            return (
                              <div
                                key={track.id}
                                draggable
                                onDragStart={(e) => {
                                  e.dataTransfer.setData('text/plain', track.id);
                                  e.dataTransfer.setData('application/json', JSON.stringify({
                                    type: 'user-track',
                                    name: track.name,
                                    id: track.id,
                                    fileKey: track.fileKey,
                                    fileType: track.type,
                                    bpm: track.bpm,
                                    key: track.key ?? undefined,
                                    beats: track.beats
                                  }));
                                  e.dataTransfer.effectAllowed = 'copy';
                                }}
                                className="p-3 border border-audafact-divider rounded-lg hover:bg-audafact-surface-2 transition-colors duration-200 audafact-card"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3 flex-1 min-w-0">
                                    {/* Play/Pause Button */}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handlePreviewPlay(track, true); // single-audio hook handles toggle
                                      }}
                                      className="flex-shrink-0 p-2 text-audafact-text-secondary hover:text-audafact-accent-cyan hover:bg-audafact-surface-2 rounded transition-colors duration-200"
                                      title={isThisUserTrackLoading ? "Loading..." : isThisUserTrackPlaying ? "Pause Preview" : "Play Preview"}
                                      disabled={isThisUserTrackLoading}
                                    >
                                      {isThisUserTrackLoading ? (
                                        <div className="loading-spinner w-4 h-4"></div>
                                      ) : (
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          {isThisUserTrackPlaying ? (
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
                                          ) : (
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347c-.75.412-1.667-.13-1.667-.986V5.653Z" />
                                          )}
                                        </svg>
                                      )}
                                    </button>
                                    {/* Track Info */}
                                    <div className="flex-1 min-w-0">
                                      <h4 className="font-medium audafact-text-primary truncate max-w-[200px]" title={track.name}>{track.name}</h4>
                                      {track.isAnalyzing ? (
                                        <p className="text-xs audafact-text-secondary mt-0.5">Analyzing…</p>
                                      ) : (
                                        (track.bpm != null || track.key || (track.genres?.length ?? 0) > 0) && (
                                          <p className="text-xs audafact-text-secondary mt-0.5 truncate max-w-[200px]">
                                            {[
                                              track.bpm != null ? `${track.bpm} BPM` : null,
                                              track.key || null,
                                              track.genres?.slice(0, 3).join(', ') || null
                                            ].filter(Boolean).join(' • ') || '—'}
                                          </p>
                                        )
                                      )}
                                      <p className="text-sm audafact-text-secondary truncate max-w-[200px]">
                                        {track.type ? track.type.split('/')[1]?.toUpperCase() || 'AUDIO' : 'AUDIO'} • {track.size}
                                      </p>
                                    </div>
                                  </div>

                                  {/* Action Buttons */}
                                  <div className="flex items-center gap-1">
                                    {/* Add Track Button */}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleAddTrack(track, true);
                                      }}
                                      className="flex-shrink-0 p-2 text-audafact-text-secondary hover:text-audafact-accent-cyan hover:bg-audafact-surface-2 rounded transition-colors duration-200"
                                      title="Add to Studio"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                      </svg>
                                    </button>

                                    {/* Remove Track Button */}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleRemoveUserTrack(track.id);
                                      }}
                                      className="flex-shrink-0 p-2 text-audafact-text-secondary hover:text-audafact-alert-red hover:bg-audafact-surface-2 rounded transition-colors duration-200"
                                      title="Remove Track"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          
                          {/* Upload Button - Less prominent when tracks exist */}
                          <UploadButton
                            user={user}
                            guestUploadUsed={guestUploadUsed}
                            tierId={tier.id}
                            canPerformAction={canPerformAction}
                            getUpgradeMessage={getUpgradeMessage}
                            showSignupModal={showSignupModal}
                            setShowUpgradePrompt={setShowUpgradePrompt}
                            fileInputRef={fileInputRef}
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sessions Menu - visible to guests but gated */}
          <div className="border-b border-audafact-divider">
              <button
                onClick={() => {
                  if (!user) {
                    showSignupModal('save_session');
                    return;
                  }
                  toggleMenu('sessions');
                }}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-audafact-text-primary hover:bg-audafact-surface-2 transition-colors duration-200"
              >
                <span>
                  Sessions
                  {!user && <span className="ml-2 text-xs audafact-text-secondary">(Unlock: save sessions)</span>}
                  {user && (tier.id === 'free' || tier.id === 'starter') && isAtSessionLimit && (
                    <span className="ml-2 text-xs audafact-text-secondary">(At limit — upgrade)</span>
                  )}
                </span>
                <svg 
                  className={`w-4 h-4 transition-transform duration-200 ${expandedMenus['sessions'] ? 'rotate-90' : ''}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              
              {user && expandedMenus['sessions'] && (
              <div className="bg-audafact-surface-2">
                <div role="tablist" aria-label="Sessions" className="flex flex-col gap-1 px-2 py-1.5">
                  <SidePanelSubMenuItem
                    label="Saved Sessions"
                    icon={<IconBookmark />}
                    isActive={activeSessionsTab === 'saved'}
                    onClick={() => handleSessionsTabSelect('saved')}
                    role="tab"
                    ariaSelected={activeSessionsTab === 'saved'}
                    ariaControls="saved-sessions-content"
                    id="saved-sessions-tab"
                  />
                  <SidePanelSubMenuItem
                    label="Shared Sessions"
                    icon={<IconShare />}
                    isActive={activeSessionsTab === 'shared'}
                    onClick={() => handleSessionsTabSelect('shared')}
                    role="tab"
                    ariaSelected={activeSessionsTab === 'shared'}
                    ariaControls="shared-sessions-content"
                    id="shared-sessions-tab"
                  />
                </div>
            
                {/* Saved Sessions Content */}
                {activeSessionsTab === 'saved' && (
                  <div id="saved-sessions-content" role="tabpanel" aria-labelledby="saved-sessions-tab" className="px-4 py-4 bg-audafact-surface-1 border-t border-audafact-divider">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-md font-medium audafact-heading">Saved Sessions</h3>
                        <span className="text-xs audafact-text-secondary">
                          {savedSessions.length} sessions
                          {isAtSessionLimit && (tier.id === 'free' || tier.id === 'starter') && (
                            <button
                              type="button"
                              onClick={() => setShowUpgradePrompt({
                                show: true,
                                message: tier.id === 'starter'
                                  ? 'You have reached your Starter session limit. Upgrade to Pro for unlimited sessions, WAV export, and advanced performance modes.'
                                  : 'You have reached your Free session limit. Upgrade to Starter or Pro to save more sessions and keep your workflow organized.',
                                feature: 'Saved Sessions'
                              })}
                              className="ml-1.5 text-audafact-accent-cyan hover:text-audafact-accent-cyan/80 font-medium"
                            >
                              • Upgrade
                            </button>
                          )}
                        </span>
                      </div>
                      {isAtSessionLimit && (
                        <div className="rounded-lg border border-audafact-accent-cyan/30 bg-audafact-surface-2 p-2.5">
                          <p className="text-xs audafact-text-secondary">
                            {tier.id === 'starter'
                              ? 'You have reached your Starter session limit. Upgrade to Pro for unlimited sessions, WAV export, and advanced performance modes.'
                              : tier.id === 'free'
                                ? 'You have reached your Free session limit. Upgrade to Starter or Pro to save more sessions and keep your workflow organized.'
                                : 'You reached your session limit. Upgrade to keep saving more sessions.'}
                          </p>
                          <button
                            type="button"
                            onClick={() => setShowUpgradePrompt({
                              show: true,
                              message: tier.id === 'starter'
                                ? 'You have reached your Starter session limit. Upgrade to Pro for unlimited sessions, WAV export, and advanced performance modes.'
                                : tier.id === 'free'
                                  ? 'You have reached your Free session limit. Upgrade to Starter or Pro to save more sessions and keep your workflow organized.'
                                  : getUpgradeMessage('save_session'),
                              feature: 'Saved Sessions'
                            })}
                            className="mt-2 text-xs font-medium text-audafact-accent-cyan hover:text-audafact-accent-cyan/80 transition-colors"
                          >
                            View plans
                          </button>
                        </div>
                      )}

                      {savedSessions.length === 0 ? (
                        <div className="text-center py-8 flex-1 flex flex-col justify-center">
                          <div className="text-audafact-text-secondary mb-4">
                            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                            </svg>
                          </div>
                          <p className="audafact-text-secondary mb-4">No sessions saved yet</p>
                          <p className="text-xs audafact-text-secondary">Use "Record" "Save" to store current studio state</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {savedSessions.map((session) => {
                            const isStateSnapshot = session.id.startsWith('session_');
                            const isRecording = session.id.startsWith('recording_');
                            const sessionWithFullState = session as { events?: Array<{ data?: any }>; full_state?: any };
                            const hasRestorableData = (sessionWithFullState.events?.[0]?.data?.tracks?.length > 0) || (sessionWithFullState.full_state?.tracks?.length > 0);

                            return (
                              <div
                                key={session.id}
                                className="p-3 border border-audafact-divider rounded-lg hover:bg-audafact-surface-2 transition-colors duration-200 audafact-card"
                              >
                                <div className="flex items-start justify-between mb-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <h4 className="font-medium audafact-text-primary text-sm truncate">
                                        {session.session_name ?? (new Date(session.startTime).toLocaleDateString() + ' at ' + new Date(session.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))}
                                      </h4>
                                      {isStateSnapshot && (
                                        <span className="px-2 py-0.5 text-xs bg-audafact-accent-cyan text-audafact-bg-primary rounded-full">
                                          State
                                        </span>
                                      )}
                                      {isRecording && (
                                        <span className="px-2 py-0.5 text-xs bg-audafact-alert-red text-audafact-text-primary rounded-full">
                                          Recording
                                        </span>
                                      )}
                                    </div>
                                    {isRecording && (
                                      <p className="text-xs audafact-text-secondary">
                                        Duration: {Math.floor(session.duration / 60000)}:{((session.duration % 60000) / 1000).toFixed(0).padStart(2, '0')}
                                      </p>
                                    )}
                                    <p className="text-xs audafact-text-secondary">
                                      {session.tracks.length} track{session.tracks.length !== 1 ? 's' : ''}
                                    </p>
                                  </div>
                                    <div className="flex items-center gap-1 ml-2">
                                    <Tooltip content="Rename Session" position="top" delay={150}>
                                      <button
                                        onClick={() => setRenameModalSession({ sessionId: session.id, currentName: session.session_name ?? (new Date(session.startTime).toLocaleDateString() + ' at ' + new Date(session.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })) })}
                                        className="p-1 text-audafact-text-secondary hover:text-audafact-accent-cyan hover:bg-audafact-surface-2 rounded transition-colors duration-200"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                        </svg>
                                      </button>
                                    </Tooltip>
                                    {onRestoreSession && (
                                      <Tooltip content={hasRestorableData ? 'Load Session' : 'Legacy session - cannot load'} position="top" delay={150}>
                                        <button
                                          onClick={async () => {
                                            if (!hasRestorableData) return;
                                            setLoadingSessionId(session.id);
                                            try {
                                              await onRestoreSession(sessionWithFullState);
                                            } finally {
                                              setLoadingSessionId(null);
                                            }
                                          }}
                                          disabled={!hasRestorableData}
                                          className={`p-1 rounded transition-colors duration-200 flex items-center justify-center min-w-[1.5rem] ${
                                            hasRestorableData
                                              ? 'text-audafact-text-secondary hover:text-audafact-accent-cyan hover:bg-audafact-surface-2'
                                              : 'text-audafact-text-secondary opacity-50 cursor-not-allowed'
                                          }`}
                                        >
                                          {loadingSessionId === session.id ? (
                                            <span className="animate-spin block w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
                                          ) : (
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                            </svg>
                                          )}
                                        </button>
                                      </Tooltip>
                                    )}
                                    <Tooltip content="Delete Session" position="top" delay={150}>
                                      <button
                                        onClick={async () => await deleteSession(session.id)}
                                        className="p-1 text-audafact-text-secondary hover:text-audafact-alert-red hover:bg-audafact-surface-2 rounded transition-colors duration-200"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                      </button>
                                    </Tooltip>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                 
                {/* Shared Sessions Content */}
                {activeSessionsTab === 'shared' && (
                  <div id="shared-sessions-content" role="tabpanel" aria-labelledby="shared-sessions-tab" className="px-4 py-4 bg-audafact-surface-1 border-t border-audafact-divider">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-md font-medium audafact-heading">Shared Sessions</h3>
                      </div>

                      <div className="text-center py-8 flex-1 flex flex-col justify-center">
                        <div className="text-audafact-text-secondary mb-4">
                          <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                          </svg>
                        </div>
                        <p className="audafact-text-secondary mb-4">Shared sessions coming soon</p>
                        <p className="text-xs audafact-text-secondary">Discover and import sessions shared by the community</p>
                      </div>
                    </div>
                  </div>
              )}
            </div>
          )}
          </div>
          {/* Recordings Menu - visible to guests but gated */}
          <div className="border-b border-audafact-divider">
            <button
              onClick={() => {
                if (!user) {
                  showSignupModal('record');
                  return;
                }
                toggleMenu('recordings');
              }}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-audafact-text-primary hover:bg-audafact-surface-2 transition-colors duration-200"
            >
              <span>
                Recordings
                {!user && <span className="ml-2 text-xs audafact-text-secondary">(Unlock: record & export)</span>}
                {user && (tier.id === 'free' || tier.id === 'starter') && isAtRecordingLimit && (
                  <span className="ml-2 text-xs audafact-text-secondary">(At limit — upgrade)</span>
                )}
              </span>
                <svg 
                  className={`w-4 h-4 transition-transform duration-200 ${expandedMenus['recordings'] ? 'rotate-90' : ''}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
            </button>
              {user && expandedMenus['recordings'] && (
                  <div className="bg-audafact-surface-2">
                    <div className="px-4 py-4 bg-audafact-surface-1 border-t border-audafact-divider">
                        <div className="flex items-center justify-between">
                          <h3 className="text-md font-medium audafact-heading">Recordings</h3>
                          <span className="text-xs audafact-text-secondary">
                            {mergedRecordings.length} recordings
                            {isAtRecordingLimit && (tier.id === 'free' || tier.id === 'starter') && (
                              <button
                                type="button"
                                onClick={() => setShowUpgradePrompt({
                                  show: true,
                                  message: tier.id === 'starter'
                                    ? 'You have reached your Starter recording limit. Upgrade to Pro for unlimited recordings, WAV export, and advanced performance modes.'
                                    : 'You have reached your Free recording limit. Upgrade to Starter or Pro to save more recordings and keep creating.',
                                  feature: 'Recordings'
                                })}
                                className="ml-1.5 text-audafact-accent-cyan hover:text-audafact-accent-cyan/80 font-medium"
                              >
                                • Upgrade
                              </button>
                            )}
                          </span>
                        </div>
                        {isAtRecordingLimit && (
                          <div className="mt-3 rounded-lg border border-audafact-accent-cyan/30 bg-audafact-surface-2 p-2.5">
                            <p className="text-xs audafact-text-secondary">
                              {tier.id === 'starter'
                                ? 'You have reached your Starter recording limit. Upgrade to Pro for unlimited recordings, WAV export, and advanced performance modes.'
                                : tier.id === 'free'
                                  ? 'You have reached your Free recording limit. Upgrade to Starter or Pro to save more recordings and keep creating.'
                                  : 'You reached your recording limit. Upgrade to keep saving more recordings.'}
                            </p>
                            <button
                              type="button"
                              onClick={() => setShowUpgradePrompt({
                                show: true,
                                message: tier.id === 'starter'
                                  ? 'You have reached your Starter recording limit. Upgrade to Pro for unlimited recordings, WAV export, and advanced performance modes.'
                                  : tier.id === 'free'
                                    ? 'You have reached your Free recording limit. Upgrade to Starter or Pro to save more recordings and keep creating.'
                                    : getUpgradeMessage('record'),
                                feature: 'Recordings'
                              })}
                              className="mt-2 text-xs font-medium text-audafact-accent-cyan hover:text-audafact-accent-cyan/80 transition-colors"
                            >
                              View plans
                            </button>
                          </div>
                        )}
                        {mergedRecordings.length === 0 ? (
                          <div className="text-center py-8 flex-1 flex flex-col justify-center">
                            <div className="text-audafact-text-secondary mb-4">
                              <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                              </svg>
                            </div>
                            <p className="audafact-text-secondary mb-4">No recordings captured yet</p>
                            <p className="text-xs audafact-text-secondary">Use "Record" to capture your edits and flips</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {mergedRecordings.map((item) => {
                              const canPlay = !!(item.audioBlob instanceof Blob ? item.audioBlob : item.fileKey);
                              const playSrc = item.audioBlob instanceof Blob
                                ? { kind: 'blob' as const, blob: item.audioBlob }
                                : item.fileKey
                                  ? { kind: 'key' as const, key: item.fileKey }
                                  : null;
                              const isThisPlaying = !!(canPlay && item.fileKey && isCurrentKey(item.fileKey));
                              const isThisLoading = !!(canPlay && item.fileKey && isLoading && isCurrentKey(item.fileKey));
                              return (
                                <div
                                  key={`${item.type}-${item.id}`}
                                  draggable={!!item.fileKey}
                                  onDragStart={item.fileKey ? (e) => {
                                    e.dataTransfer.setData('text/plain', item.dbId || item.id);
                                    e.dataTransfer.setData('application/json', JSON.stringify({
                                      type: 'recording',
                                      name: item.label,
                                      id: item.dbId || item.id,
                                      fileKey: item.fileKey,
                                      fileType: 'audio/wav'
                                    }));
                                    e.dataTransfer.effectAllowed = 'copy';
                                  } : undefined}
                                  className={`p-3 border border-audafact-divider rounded-lg hover:bg-audafact-surface-2 transition-colors duration-200 audafact-card ${item.fileKey ? 'cursor-grab active:cursor-grabbing' : ''}`}
                                >
                                  <div className="flex items-center gap-2 gap-y-1.5 flex-wrap">
                                    <h4 className="font-medium audafact-text-primary text-sm min-w-0 truncate flex-1" title={item.label}>
                                      {item.label}
                                    </h4>
                                    <div className="flex items-center gap-0.5 flex-shrink-0 ml-auto">
                                      {canPlay && playSrc && (
                                        <Tooltip content={isThisPlaying ? "Pause" : "Play"} position="top" delay={150}>
                                          <button
                                            onClick={() => toggle(playSrc)}
                                            className="p-1.5 text-audafact-text-secondary hover:text-audafact-accent-green hover:bg-audafact-surface-2 rounded transition-colors duration-200"
                                            disabled={isThisLoading}
                                          >
                                            {isThisLoading ? (
                                              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                              </svg>
                                            ) : isThisPlaying ? (
                                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                                              </svg>
                                            ) : (
                                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3l14 9-14 9V3z" />
                                              </svg>
                                            )}
                                          </button>
                                        </Tooltip>
                                      )}
                                      {item.fileKey && (
                                        <Tooltip content="Add to Studio" position="top" delay={150}>
                                          <button
                                            onClick={() => {
                                              const fileKey = item.fileKey;
                                              if (!fileKey) return;
                                              const userTrack: UserTrack = {
                                                id: item.dbId || item.id,
                                                name: item.label,
                                                file: null,
                                                fileKey,
                                                type: 'audio/wav',
                                                size: '-',
                                                uploadedAt: Date.now()
                                              };
                                              onAddUserTrack(userTrack, 'cue');
                                            }}
                                            className="p-1.5 text-audafact-text-secondary hover:text-audafact-accent-cyan hover:bg-audafact-surface-2 rounded transition-colors duration-200"
                                          >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                            </svg>
                                          </button>
                                        </Tooltip>
                                      )}
                                      {canAccessFeature('download') && (item.fileKey || (item.audioBlob instanceof Blob)) && (
                                        <Tooltip content="Download" position="top" delay={150}>
                                          <div className="relative">
                                            <button
                                              ref={(el) => {
                                                if (downloadDropdownOpen === item.id) downloadTriggerRef.current = el;
                                              }}
                                              onClick={(e) => {
                                                if (downloadDropdownOpen === item.id) {
                                                  setDownloadDropdownOpen(null);
                                                  return;
                                                }
                                                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                                setDownloadDropdownPosition({ top: rect.bottom + 4, left: Math.max(8, rect.right - 140) });
                                                setDownloadDropdownOpen(item.id);
                                              }}
                                              className="p-1.5 text-audafact-text-secondary hover:text-audafact-accent-cyan hover:bg-audafact-surface-2 rounded transition-colors duration-200"
                                            >
                                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                              </svg>
                                            </button>
                                          </div>
                                        </Tooltip>
                                      )}
                                      {item.dbId && (
                                        <Tooltip content="Rename" position="top" delay={150}>
                                          <button
                                            onClick={() => setRenameModalRecording({ recordingId: item.dbId!, currentName: item.label })}
                                            className="p-1.5 text-audafact-text-secondary hover:text-audafact-accent-cyan hover:bg-audafact-surface-2 rounded transition-colors duration-200"
                                          >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                            </svg>
                                          </button>
                                        </Tooltip>
                                      )}
                                      <Tooltip content="Delete" position="top" delay={150}>
                                        <button
                                          onClick={async () => {
                                            if (item.type === 'performance') {
                                              await deletePerformance(item.id, item.fileKey ? { fileKey: item.fileKey } : undefined);
                                            } else {
                                              await deleteSavedRecording(item.id, item.fileKey ? { fileKey: item.fileKey } : undefined);
                                            }
                                          }}
                                          className="p-1.5 text-audafact-text-secondary hover:text-audafact-alert-red hover:bg-audafact-surface-2 rounded transition-colors duration-200"
                                        >
                                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                          </svg>
                                        </button>
                                      </Tooltip>
                                    </div>
                                  </div>
                                  <p className="text-[11px] audafact-text-secondary mt-1">
                                    {item.durationStr} • {item.eventsCount} events • {item.tracksCount} track{item.tracksCount !== 1 ? 's' : ''}
                                    {item.audioBlob && ' • Audio'}
                                  </p>
                                  {downloadDropdownOpen === item.id && createPortal(
                                    <div
                                      ref={downloadDropdownRef}
                                      className="fixed py-1 min-w-[140px] bg-audafact-surface-2 border border-audafact-divider rounded-lg shadow-lg z-[70]"
                                      style={{ top: downloadDropdownPosition.top, left: downloadDropdownPosition.left }}
                                    >
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          const allowed = await canPerformAction('download_mp3');
                                          if (!allowed) {
                                            setShowUpgradePrompt({ show: true, message: getUpgradeMessage('download_mp3'), feature: 'Export' });
                                            setDownloadDropdownOpen(null);
                                            return;
                                          }
                                          const base = item.label.replace(/\.(mp3|wav)$/i, '') || `audafact_recording_${new Date().toISOString().slice(0, 16).replace('T', '_')}`;
                                          const filename = `${base}.mp3`;
                                          if (item.performance?.audioBlob instanceof Blob) {
                                            exportPerformance(item.id, { filename, format: 'mp3' });
                                          } else {
                                            await exportByFileKey(item.fileKey!, filename, 'mp3', item.dbId ?? undefined);
                                          }
                                          setDownloadDropdownOpen(null);
                                        }}
                                        className="w-full px-3 py-2 text-left text-sm audafact-text-primary hover:bg-audafact-surface-1"
                                        title="Download as MP3"
                                      >
                                        MP3
                                      </button>
                                      {tier.id === 'pro' ? (
                                        <button
                                          type="button"
                                          onClick={async () => {
                                            const allowed = await canPerformAction('download_wav');
                                            if (!allowed) {
                                              setShowUpgradePrompt({ show: true, message: getUpgradeMessage('download_wav'), feature: 'WAV Export' });
                                              setDownloadDropdownOpen(null);
                                              return;
                                            }
                                            const base = item.label.replace(/\.(mp3|wav)$/i, '') || `audafact_recording_${new Date().toISOString().slice(0, 16).replace('T', '_')}`;
                                            const filename = `${base}.wav`;
                                            if (item.performance?.audioBlob instanceof Blob) {
                                              exportPerformance(item.id, { filename, format: 'wav' });
                                            } else {
                                              await exportByFileKey(item.fileKey!, filename, 'wav', item.dbId ?? undefined);
                                            }
                                            setDownloadDropdownOpen(null);
                                          }}
                                          className="w-full px-3 py-2 text-left text-sm audafact-text-primary hover:bg-audafact-surface-1"
                                          title="Download as WAV"
                                        >
                                          WAV
                                        </button>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setShowUpgradePrompt({ show: true, message: getUpgradeMessage('download_wav'), feature: 'WAV Export' });
                                            setDownloadDropdownOpen(null);
                                          }}
                                          className="w-full px-3 py-2 text-left text-sm audafact-text-secondary hover:bg-audafact-surface-1 flex items-center justify-between gap-2"
                                          title="Download as WAV (Pro)"
                                        >
                                          WAV
                                          <span className="text-xs font-medium px-2 py-0.5 rounded bg-audafact-accent-cyan/20 text-audafact-accent-cyan">Pro</span>
                                        </button>
                                      )}
                                    </div>,
                                    document.body
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                    </div>
                  </div>
              )}
            </div>
        </div>
      </div>
      
      {/* Hidden file input for upload functionality */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        onChange={handleFileSelect}
        className="hidden"
      />
      
      {/* Export Recording Modal */}
      <ExportRecordingModal
        performance={exportModalPerformance}
        isOpen={!!exportModalPerformance}
        onClose={() => {
          clearPendingExport();
          setExportModalPerformance(null);
        }}
        onCancel={() => {
          if (pendingExport && exportModalPerformance && pendingExport.performanceId === exportModalPerformance.id && !pendingExport.canSave) {
            discardPerformance(pendingExport.performanceId);
          }
          clearPendingExport();
          setExportModalPerformance(null);
        }}
        onSave={async (filename) => {
          if (!exportModalPerformance) return;
          await savePerformanceName(exportModalPerformance.id, filename);
          clearPendingExport();
          setExportModalPerformance(null);
        }}
        onExport={async (filename, format) => {
          if (!exportModalPerformance) return;
          const action = format === 'wav' ? 'download_wav' : 'download_mp3';
          const allowed = await canPerformAction(action);
          if (!allowed) {
            setShowUpgradePrompt({
              show: true,
              message: getUpgradeMessage(action),
              feature: format === 'wav' ? 'WAV Export' : 'Export'
            });
            setExportModalPerformance(null);
            return;
          }
          exportPerformance(exportModalPerformance.id, { filename, format });
          if (pendingExport && pendingExport.performanceId === exportModalPerformance.id && !pendingExport.canSave) {
            discardPerformance(exportModalPerformance.id);
          }
          clearPendingExport();
          setExportModalPerformance(null);
        }}
        onSaveAndExport={async (filename, format) => {
          if (!exportModalPerformance) return;
          const action = format === 'wav' ? 'download_wav' : 'download_mp3';
          const allowed = await canPerformAction(action);
          if (!allowed) {
            setShowUpgradePrompt({
              show: true,
              message: getUpgradeMessage(action),
              feature: format === 'wav' ? 'WAV Export' : 'Export'
            });
            setExportModalPerformance(null);
            return;
          }
          await savePerformanceName(exportModalPerformance.id, filename);
          exportPerformance(exportModalPerformance.id, { filename, format });
          if (pendingExport && pendingExport.performanceId === exportModalPerformance.id && !pendingExport.canSave) {
            discardPerformance(exportModalPerformance.id);
          }
          clearPendingExport();
          setExportModalPerformance(null);
        }}
        allowedFormats={tier.id === 'pro' ? ['mp3', 'wav'] : ['mp3']}
        canSave={!pendingExport || !exportModalPerformance || pendingExport.performanceId !== exportModalPerformance.id
          ? true
          : pendingExport.canSave}
        onUpgradeWav={tier.id !== 'pro' ? () => {
          setShowUpgradePrompt({
            show: true,
            message: getUpgradeMessage('download_wav'),
            feature: 'WAV Export'
          });
        } : undefined}
        onUpgradeSave={tier.id !== 'pro' ? () => {
          setShowUpgradePrompt({
            show: true,
            message: getUpgradeMessage('record'),
            feature: 'Save Recording'
          });
        } : undefined}
      />

      {/* Rename Recording Modal */}
      <RenameRecordingModal
        isOpen={!!renameModalRecording}
        onClose={() => setRenameModalRecording(null)}
        currentName={renameModalRecording?.currentName ?? ''}
        onSave={async (newName) => {
          if (!renameModalRecording) return;
          await updateRecordingName(renameModalRecording.recordingId, newName);
        }}
      />

      {/* Rename Session Modal (used for naming new sessions and renaming existing) */}
      <RenameRecordingModal
        isOpen={!!renameModalSession}
        onClose={() => {
          setRenameModalSession(null);
          clearPendingSession();
        }}
        currentName={renameModalSession?.currentName ?? ''}
        onSave={async (newName) => {
          if (!renameModalSession) return;
          await renameSession(renameModalSession.sessionId, newName);
          clearPendingSession();
          setRenameModalSession(null);
        }}
        isSession
        isNewSession={!!pendingSession}
      />

      {/* Upgrade Prompt Modal */}
      {showUpgradePrompt.show && (
        <UpgradePrompt
          message={showUpgradePrompt.message}
          feature={showUpgradePrompt.feature}
          onClose={() => setShowUpgradePrompt({ show: false, message: '', feature: '' })}
        />
      )}
    </>
  );
};

export default SidePanel; 