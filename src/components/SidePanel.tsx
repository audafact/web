import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useRecording } from '../context/RecordingContext';
import { StorageService } from '../services/storageService';
import { DatabaseService } from '../services/databaseService';
import { useAuth } from '../context/AuthContext';
import { useAccessControl } from '../hooks/useAccessControl';
import { useUser } from '../hooks/useUser';
import { UpgradePrompt } from './UpgradePrompt';
import { UserTrack } from '../types/music';
import LibraryTrackItem from './LibraryTrackItem';
import { showSignupModal } from '../hooks/useSignupModal';
import { toPrettySize, normalizeLegacyUrlToKey } from '@/utils/media';
import { deleteByKey } from '@/lib/storage';
import { buildApiUrl, API_CONFIG } from '@/config/api';
import { supabase } from '@/services/supabase';
import { useSingleAudio } from '@/hooks/useSingleAudio';
import { ExportRecordingModal } from './ExportRecordingModal';
import { RenameRecordingModal } from './RenameRecordingModal';
import Tooltip from './Tooltip';

interface AudioAsset {
  id: string;
  name: string;
  fileKey: string;
  type: 'wav' | 'mp3';
  size: string;
  duration?: number;
  fileUrl?: string;
  bpm?: number;
}

interface UploadButtonProps {
  user: any;
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
        setCanUpload(true); // Guest users can attempt upload (will show signup)
        return;
      }
      
      const uploadAllowed = await canPerformAction('upload');
      setCanUpload(uploadAllowed);
      
      if (!uploadAllowed) {
        setUpgradeMessage(getUpgradeMessage('upload'));
      }
    };

    checkUploadCapacity();
  }, [user, canPerformAction, getUpgradeMessage]);

  const handleClick = async () => {
    // Check if user is authenticated
    if (!user) {
      showSignupModal('upload');
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

  const isDisabled = user && canUpload === false;
  const tooltipText = isDisabled ? upgradeMessage : 'Upload another track to your collection';

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
    </div>
  );
};



interface SidePanelProps {
  isOpen: boolean;
  onToggle: () => void;
  onUploadTrack: (file: File, trackType: 'preview' | 'loop' | 'cue') => void;
  onAddFromLibrary: (asset: AudioAsset, trackType: 'preview' | 'loop' | 'cue') => void;
  onAddUserTrack: (track: UserTrack, trackType: 'preview' | 'loop' | 'cue') => void;
  onRestoreSession?: (session: { events?: Array<{ data?: any }>; full_state?: any }) => Promise<void>;
  initialMode?: 'upload' | 'library';
}

const SidePanel: React.FC<SidePanelProps> = ({
  isOpen,
  onToggle,
  onUploadTrack,
  onAddFromLibrary,
  onAddUserTrack,
  onRestoreSession,
  initialMode
}) => {

  const { savedSessions, performances, exportSession, exportPerformance, exportByFileKey, savePerformanceName, updateRecordingName, deleteSession, renameSession, deletePerformance, pendingExport, clearPendingExport, pendingSession, clearPendingSession, discardPerformance, savedRecordings, deleteSavedRecording } = useRecording();
  const { user } = useAuth();
  const { canPerformAction, getUpgradeMessage, canAccessFeature } = useAccessControl();
  const { tier, libraryTracks: userLibraryTracks, loading: userLoading } = useUser();
  
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
  const [activeAudioTab, setActiveAudioTab] = useState<'my-tracks' | 'library' | null>(null);
  
  const [activeSessionsTab, setActiveSessionsTab] = useState<'saved' | 'shared' | null>(() => {
    const savedTab = localStorage.getItem('sidePanelActiveSessionsTab');
    return (savedTab as 'saved' | 'shared' | null) || 'saved'; // Default to saved sessions
  });
  // When true, allow user to collapse the submenu without auto-selecting another
  const [allowEmptyAudioTab, setAllowEmptyAudioTab] = useState(true); // Start with Audafact Library tab closed
  const [allowEmptySessionsTab, setAllowEmptySessionsTab] = useState(false);
  


  const [userTracks, setUserTracks] = useState<UserTrack[]>([]);
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
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const { isPlaying, isLoading, toggle, isCurrentKey } = useSingleAudio();

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
  const handleAudioTabSelect = (tab: 'my-tracks' | 'library') => {
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
      showSignupModal('upload');
      // Reset the input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
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
              uploadedAt: Date.now()
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
      const key = isUserTrack
        ? (asset as UserTrack).fileKey
        : (asset as AudioAsset).fileKey;

      if (!key) {
        console.error("Missing fileKey for asset", asset);
        return;
      }

      // One-line toggle: signs the key and plays, or stops if same track is currently playing
      toggle({ kind: "key", key });

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
                </div>
                
                {/* Enhanced Library Content */}
                {activeAudioTab === 'library' && (
                  <div id="audafact-library-content" role="tabpanel" aria-labelledby="audafact-library-tab" className="px-4 py-4 bg-audafact-surface-1 border-t border-audafact-divider">
                                          <div className="space-y-4">
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
                        
                        <div className="text-sm audafact-text-secondary bg-audafact-surface-2 border border-audafact-accent-cyan/30 p-3 rounded-lg">
                          <strong className="text-audafact-text-primary">Add tracks:</strong> Drag any track into the studio, or use the + button. Use the Add button in the bar above or swipe down to add more. Guest users can preview but need to sign up to add tracks.
                        </div>
                        
                        {/* Enhanced Library Tracks */}
                        <div className="space-y-3">
                          {userLoading ? (
                            <div className="text-center py-4">
                              <div className="loading-spinner mx-auto"></div>
                              <p className="text-sm audafact-text-secondary mt-2">Loading tracks...</p>
                            </div>
                          ) : userLibraryTracks.length === 0 ? (
                            <div className="text-center py-4">
                              <p className="text-sm audafact-text-secondary">No tracks available</p>
                            </div>
                          ) : (
                            userLibraryTracks.map((track) => (
                              <LibraryTrackItem
                                key={track.id}
                                track={track}
                                onPreview={() => handlePreviewPlay(track, false)}
                                isPreviewing={isPlaying && isCurrentKey(track.fileKey)}
                                onAddToStudio={() => handleAddTrack({
                                  id: track.id,
                                  name: track.name,
                                  fileKey: track.fileKey,
                                  type: track.type,
                                  size: track.size,
                                  bpm: track.bpm
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
                
                {/* My Tracks Content - Show for all users */}
                {activeAudioTab === 'my-tracks' && (
                  <div id="my-tracks-content" role="tabpanel" aria-labelledby="my-tracks-tab" className="px-4 py-4 bg-audafact-surface-1 border-t border-audafact-divider">
                    <div className="space-y-4">
                      <div className="flex items-center justify-center">
                        <h3 className="text-md font-medium audafact-heading">
                          {user ? 'My Uploaded Tracks' : 'Upload Tracks'}
                        </h3>
                      </div>

                      {!user ? (
                        // Guest user view
                        <div className="text-center py-8 flex-1 flex flex-col justify-center">
                          <div className="text-audafact-text-secondary mb-4">
                            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                          </div>
                          <p className="audafact-text-secondary mb-4">Upload your own tracks</p>
                          <p className="text-sm audafact-text-secondary mb-4">Sign up to upload and manage your audio files</p>
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
                              Upload Track
                            </button>
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
                                    fileType: track.type
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

          {/* Sessions Menu - Only show for authenticated users */}
          {user && (
            <div className="border-b border-audafact-divider">
              <button
                onClick={() => toggleMenu('sessions')}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-audafact-text-primary hover:bg-audafact-surface-2 transition-colors duration-200"
              >
                <span>Sessions</span>
                <svg 
                  className={`w-4 h-4 transition-transform duration-200 ${expandedMenus['sessions'] ? 'rotate-90' : ''}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              
              {expandedMenus['sessions'] && (
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
                        <span className="text-xs audafact-text-secondary">{savedSessions.length} sessions</span>
                      </div>

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
          )}
          {/* Recordings Menu - Only show for authenticated users */}
          {user && (
            <div className="border-b border-audafact-divider">
              <button
                onClick={() => toggleMenu('recordings')}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-audafact-text-primary hover:bg-audafact-surface-2 transition-colors duration-200"
              >
                <span>Recordings</span>
                <svg 
                  className={`w-4 h-4 transition-transform duration-200 ${expandedMenus['recordings'] ? 'rotate-90' : ''}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              {expandedMenus['recordings'] && (
                  <div className="bg-audafact-surface-2">
                    <div className="px-4 py-4 bg-audafact-surface-1 border-t border-audafact-divider">
                        <div className="flex items-center justify-between">
                          <h3 className="text-md font-medium audafact-heading">Recordings</h3>
                          <span className="text-xs audafact-text-secondary">{mergedRecordings.length} recordings</span>
                        </div>
                        
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
                              const isThisPlaying = canPlay && item.fileKey && isCurrentKey(item.fileKey);
                              const isThisLoading = canPlay && item.fileKey && isLoading && isCurrentKey(item.fileKey);
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
                                              const userTrack: UserTrack = {
                                                id: item.dbId || item.id,
                                                name: item.label,
                                                file: null,
                                                fileKey: item.fileKey,
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
                                      {canAccessFeature('download') && item.fileKey && (
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
            )}
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
          if (exportModalPerformance.databaseId) {
            await savePerformanceName(exportModalPerformance.id, filename);
          }
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