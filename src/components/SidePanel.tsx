import React, { useState, useRef, useEffect } from 'react';
import { useRecording } from '../context/RecordingContext';
import { StorageService } from '../services/storageService';
import { DatabaseService } from '../services/databaseService';
import { useAuth } from '../context/AuthContext';
import { useAccessControl } from '../hooks/useAccessControl';
import { useUserTier } from '../hooks/useUserTier';
import { usePreviewAudio } from '../hooks/usePreviewAudio';
import { trackEvent } from '../services/analyticsService';
import { UpgradePrompt } from './UpgradePrompt';
import { LibraryService } from '../services/libraryService';
import { LibraryTrack } from '../types/music';
import LibraryTrackItem from './LibraryTrackItem';
import FeatureGate from './FeatureGate';
import { showSignupModal } from '../hooks/useSignupModal';

interface AudioAsset {
  id: string;
  name: string;
  file: string;
  type: 'wav' | 'mp3';
  size: string;
  duration?: number;
}

interface UserTrack {
  id: string;
  name: string;
  file: File | null;
  type: string;
  size: string;
  url: string;
  uploadedAt: number;
}

interface SidePanelProps {
  isOpen: boolean;
  onToggle: () => void;
  onUploadTrack: (file: File, trackType: 'preview' | 'loop' | 'cue') => void;
  onAddFromLibrary: (asset: AudioAsset, trackType: 'preview' | 'loop' | 'cue') => void;
  onAddUserTrack: (track: UserTrack, trackType: 'preview' | 'loop' | 'cue') => void;
  isLoading: boolean;
  initialMode?: 'upload' | 'library';
}

const SidePanel: React.FC<SidePanelProps> = ({
  isOpen,
  onToggle,
  onUploadTrack,
  onAddFromLibrary,
  onAddUserTrack,
  isLoading,
  initialMode
}) => {
  const { savedSessions, performances, exportSession, exportPerformance, deleteSession, deletePerformance } = useRecording();
  const { user } = useAuth();
  const { canPerformAction, getUpgradeMessage, canAccessFeature } = useAccessControl();
  const { tier } = useUserTier();
  const { togglePreview, isPreviewing } = usePreviewAudio();
  
  // Collapsible menu state
  const [expandedMenus, setExpandedMenus] = useState<{ [key: string]: boolean }>(() => {
    const saved = localStorage.getItem('sidePanelExpandedMenus');
    const defaultState = { 'audio-library': false, 'sessions': false };
    
    return saved ? JSON.parse(saved) : defaultState;
  });
  
  // Active submenu items (null means no submenu item is selected)
  const [activeAudioTab, setActiveAudioTab] = useState<'my-tracks' | 'library' | null>(() => {
    const savedTab = localStorage.getItem('sidePanelActiveAudioTab');
    return (savedTab as 'my-tracks' | 'library' | null) || null;
  });
  
  const [activeSessionsTab, setActiveSessionsTab] = useState<'saved' | 'shared' | null>(() => {
    const savedTab = localStorage.getItem('sidePanelActiveSessionsTab');
    return (savedTab as 'saved' | 'shared' | null) || null;
  });
  
  const [activeRepoTab, setActiveRepoTab] = useState<'recordings' | 'performances' | null>(() => {
    const savedTab = localStorage.getItem('sidePanelActiveRepoTab');
    return (savedTab as 'recordings' | 'performances' | null) || null;
  });
  const [previewAudios, setPreviewAudios] = useState<{ [key: string]: HTMLAudioElement }>({});
  const [playingAssets, setPlayingAssets] = useState<{ [key: string]: boolean }>({});
  const [userTracks, setUserTracks] = useState<UserTrack[]>([]);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState<{
    show: boolean;
    message: string;
    feature: string;
  }>({ show: false, message: '', feature: '' });
  const [libraryTracks, setLibraryTracks] = useState<LibraryTrack[]>([]);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load library tracks when library tab is opened
  useEffect(() => {
    if (activeAudioTab === 'library' && libraryTracks.length === 0) {
      loadLibraryTracks();
    }
  }, [activeAudioTab]);

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
            // Get file info from storage to get actual size and type
            let fileSize = '0MB';
            let fileType = 'audio/mpeg';
            
            try {
              const fileInfo = await StorageService.getAudioFileInfo('user-uploads', upload.file_url);
              if (fileInfo) {
                fileSize = StorageService.formatFileSize(fileInfo.size);
                fileType = fileInfo.type;
              }
            } catch (error) {
              console.error('Error getting file info for:', upload.file_url, error);
            }
            
            return {
              id: upload.id,
              name: upload.title,
              file: null as File | null,
              type: fileType,
              size: fileSize,
              url: upload.file_url, // This is now the file path
              uploadedAt: new Date(upload.created_at).getTime()
            };
          })
        );
        
        setUserTracks(userTracksData);
      } catch (error) {
        console.error('Error loading user tracks from database:', error);
        setUserTracks([]);
      }
    };

    loadUserTracks();
  }, [user]);

  const loadLibraryTracks = async () => {
    setIsLoadingLibrary(true);
    try {
      const tracks = await LibraryService.getLibraryTracks(tier.id);
      setLibraryTracks(tracks);
    } catch (error) {
      console.error('Error loading library tracks:', error);
    } finally {
      setIsLoadingLibrary(false);
    }
  };

  // Toggle menu function
  const toggleMenu = (menuKey: string) => {
    setExpandedMenus(prev => {
      const newState = { ...prev, [menuKey]: !prev[menuKey] };
      localStorage.setItem('sidePanelExpandedMenus', JSON.stringify(newState));
      return newState;
    });
  };

  // Handle submenu item selection
  const handleAudioTabSelect = (tab: 'my-tracks' | 'library') => {
    setActiveAudioTab(prev => prev === tab ? null : tab);
  };

  const handleSessionsTabSelect = (tab: 'saved' | 'shared') => {
    setActiveSessionsTab(prev => prev === tab ? null : tab);
  };

  const handleRepoTabSelect = (tab: 'recordings' | 'performances') => {
    setActiveRepoTab(prev => prev === tab ? null : tab);
  };

  // Auto-show library when opened in library mode
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
  
  useEffect(() => {
    if (activeRepoTab) {
      localStorage.setItem('sidePanelActiveRepoTab', activeRepoTab);
    } else {
      localStorage.removeItem('sidePanelActiveRepoTab');
    }
  }, [activeRepoTab]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      Object.values(previewAudios).forEach(audio => {
        if (audio) {
          audio.pause();
          audio.currentTime = 0;
        }
      });
    };
  }, [previewAudios]);

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
      // Upload file to Supabase storage
      const uploadResult = await StorageService.uploadAudioFile(file, user.id, file.name);

      if (uploadResult.error) {
        console.error('Upload error:', uploadResult.error);
        throw uploadResult.error;
      }

      if (uploadResult.data) {
        // Create database record - store the file path, not the URL
        const uploadRecord = await DatabaseService.createUpload({
          user_id: user.id,
          file_url: uploadResult.data.name, // Store the file path, not the URL
          title: file.name,
          duration: await getAudioDuration(file)
        });

        if (uploadRecord) {
          // Create user track object
          const userTrack: UserTrack = {
            id: uploadRecord.id,
            name: file.name,
            file: file,
            type: file.type,
            size: `${(file.size / (1024 * 1024)).toFixed(1)}MB`,
            url: uploadResult.data.name, // Store the file path, not the URL
            uploadedAt: Date.now()
          };

          // Add to user tracks
          const updatedTracks = [...userTracks, userTrack];
          setUserTracks(updatedTracks);

          // Default to preview mode for uploaded files
          onUploadTrack(file, 'preview');
          
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
      
      audio.addEventListener('loadedmetadata', () => {
        resolve(audio.duration);
        URL.revokeObjectURL(url);
      });
      
      audio.addEventListener('error', () => {
        resolve(0);
        URL.revokeObjectURL(url);
      });
      
      audio.src = url;
    });
  };

  const handlePreviewPlay = async (asset: AudioAsset | UserTrack, isUserTrack = false) => {
    const assetId = asset.id;
    
    // Stop any currently playing audio
    Object.entries(previewAudios).forEach(([id, audio]) => {
      if (id !== assetId && audio) {
        audio.pause();
        audio.currentTime = 0;
        setPlayingAssets(prev => ({ ...prev, [id]: false }));
      }
    });

    // If this asset is already playing, stop it
    if (playingAssets[assetId]) {
      const audio = previewAudios[assetId];
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
        setPlayingAssets(prev => ({ ...prev, [assetId]: false }));
      }
      return;
    }

    // Create new audio element
    let audioSource: string;
    if (isUserTrack) {
      // Generate signed URL for user tracks
      try {
        audioSource = await StorageService.getSignedUrl('user-uploads', (asset as UserTrack).url);
      } catch (error) {
        console.error('Failed to generate signed URL:', error);
        return;
      }
    } else {
      audioSource = (asset as AudioAsset).file;
    }
    
    const audio = new Audio(audioSource);
    
    audio.addEventListener('ended', () => {
      setPlayingAssets(prev => ({ ...prev, [assetId]: false }));
    });
    audio.addEventListener('pause', () => {
      setPlayingAssets(prev => ({ ...prev, [assetId]: false }));
    });
    audio.addEventListener('error', (e) => {
      console.error('Audio error:', e);
      console.error('Audio error details:', audio.error);
    });
    
    audio.play().then(() => {
      setPlayingAssets(prev => ({ ...prev, [assetId]: true }));
      setPreviewAudios(prev => ({ ...prev, [assetId]: audio }));
    }).catch(error => {
      console.error('Failed to play preview:', error);
    });
  };

  const handleAddTrack = async (asset: AudioAsset | UserTrack, isUserTrack = false) => {
    if (isUserTrack) {
      const userTrack = asset as UserTrack;
      onAddUserTrack(userTrack, 'preview');
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
      
      const libraryAsset = asset as AudioAsset;
      onAddFromLibrary(libraryAsset, 'preview');
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
      // Delete from storage first
      const storageResult = await StorageService.deleteFile('user-uploads', trackToRemove.url);
      if (storageResult.error) {
        console.error('Failed to delete file from storage:', storageResult.error);
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
          className="fixed top-15 left-0 right-0 bottom-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onToggle}
        />
      )}
      
      {/* Sidebar */}
      <div 
        data-sidepanel
        className={`fixed top-16 left-0 h-[calc(100vh-4rem)] bg-audafact-surface-1 border-r border-audafact-divider shadow-card transition-transform duration-300 ease-in-out z-50 overflow-hidden flex flex-col ${
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
                <button
                        onClick={() => handleAudioTabSelect('library')}
                        className={`w-full px-8 py-2 text-xs text-left transition-colors duration-200 ${
                          activeAudioTab === 'library'
                            ? 'text-audafact-accent-cyan bg-audafact-surface-3'
                            : 'text-audafact-text-secondary hover:text-audafact-text-primary hover:bg-audafact-surface-3'
                  }`}
                >
                  Audafact Library
                </button>
                
                {/* Enhanced Library Content */}
                {activeAudioTab === 'library' && (
                  <div className="px-4 py-4 bg-audafact-surface-1 border-t border-audafact-divider">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-md font-medium audafact-heading">Track Library</h3>
                      </div>

                      {/* Search and Filter */}
                      <div className="space-y-3">
                        <input
                          type="text"
                          placeholder="Search tracks..."
                          className="w-full px-3 py-2 bg-audafact-surface-2 border border-audafact-divider rounded-lg text-audafact-text-primary placeholder-audafact-text-secondary focus:outline-none focus:border-audafact-accent-cyan"
                        />
                        
                        <div className="text-sm audafact-text-secondary bg-audafact-surface-2 p-2 rounded">
                          Preview tracks and add them to your studio. Guest users can preview but need to sign up to add tracks.
                        </div>
                        
                        {/* Enhanced Library Tracks */}
                        <div className="space-y-3">
                          {isLoadingLibrary ? (
                            <div className="text-center py-4">
                              <div className="loading-spinner mx-auto"></div>
                              <p className="text-sm audafact-text-secondary mt-2">Loading tracks...</p>
                            </div>
                          ) : libraryTracks.length === 0 ? (
                            <div className="text-center py-4">
                              <p className="text-sm audafact-text-secondary">No tracks available</p>
                            </div>
                          ) : (
                            libraryTracks.map((track) => (
                              <LibraryTrackItem
                                key={track.id}
                                track={track}
                                isPreviewing={isPreviewing(track.id)}
                                onPreview={() => togglePreview(track)}
                                onAddToStudio={() => handleAddTrack({
                                  id: track.id,
                                  name: track.name,
                                  file: track.file,
                                  type: track.type,
                                  size: track.size
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
                
                {/* My Tracks - Show for all users */}
                <button
                  onClick={() => handleAudioTabSelect('my-tracks')}
                  className={`w-full px-8 py-2 text-xs text-left transition-colors duration-200 ${
                    activeAudioTab === 'my-tracks'
                      ? 'text-audafact-accent-cyan bg-audafact-surface-3'
                      : 'text-audafact-text-secondary hover:text-audafact-text-primary hover:bg-audafact-surface-3'
                  }`}
                >
                  My Tracks
                </button>
                
                {/* My Tracks Content - Show for all users */}
                {activeAudioTab === 'my-tracks' && (
                  <div className="px-4 py-4 bg-audafact-surface-1 border-t border-audafact-divider">
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
                          {userTracks.map((track) => (
                            <div
                              key={track.id}
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.setData('text/plain', track.id);
                                e.dataTransfer.setData('application/json', JSON.stringify({
                                  type: 'user-track',
                                  name: track.name,
                                  id: track.id
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
                                      handlePreviewPlay(track, true);
                                    }}
                                    className="flex-shrink-0 p-2 text-audafact-text-secondary hover:text-audafact-accent-cyan hover:bg-audafact-surface-2 rounded transition-colors duration-200"
                                    title={playingAssets[track.id] ? 'Pause Preview' : 'Play Preview'}
                                  >
                                    {playingAssets[track.id] ? (
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                    ) : (
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347c-.75.412-1.667-.13-1.667-.986V5.653Z" />
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
                          ))}
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
            </div>
          )}
            
            {expandedMenus['sessions'] && user && (
              <div className="bg-audafact-surface-2">
                <button
                  onClick={() => handleSessionsTabSelect('saved')}
                  className={`w-full px-8 py-2 text-xs text-left transition-colors duration-200 ${
                    activeSessionsTab === 'saved'
                      ? 'text-audafact-accent-cyan bg-audafact-surface-3'
                      : 'text-audafact-text-secondary hover:text-audafact-text-primary hover:bg-audafact-surface-3'
                  }`}
                >
                  Saved Sessions
                </button>
            
                {/* Saved Sessions Content */}
                {activeSessionsTab === 'saved' && (
                  <div className="px-4 py-4 bg-audafact-surface-1 border-t border-audafact-divider">
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
                          <p className="text-xs audafact-text-secondary">Use "Record" to capture performances or "Save" to store current studio state</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {savedSessions.map((session) => {
                            const isStateSnapshot = session.id.startsWith('session_');
                            const isRecording = session.id.startsWith('recording_');
                            
                            return (
                              <div
                                key={session.id}
                                className="p-3 border border-audafact-divider rounded-lg hover:bg-audafact-surface-2 transition-colors duration-200 audafact-card"
                              >
                                <div className="flex items-start justify-between mb-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <h4 className="font-medium audafact-text-primary text-sm">
                                        {new Date(session.startTime).toLocaleDateString()} at {new Date(session.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
                                      {isStateSnapshot ? 'Studio snapshot' : `${session.events.length} events`} • {session.tracks.length} tracks
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-1 ml-2">
                                    {canAccessFeature('download') && (
                                      <button
                                        onClick={async () => {
                                          const canDownload = await canPerformAction('download');
                                          if (!canDownload) {
                                            setShowUpgradePrompt({
                                              show: true,
                                              message: getUpgradeMessage('download'),
                                              feature: 'Download'
                                            });
                                            return;
                                          }
                                          exportSession(session.id);
                                        }}
                                        className="p-1 text-audafact-text-secondary hover:text-audafact-accent-cyan hover:bg-audafact-surface-2 rounded transition-colors duration-200"
                                        title="Export Session"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                      </button>
                                    )}
                                    <button
                                      onClick={() => deleteSession(session.id)}
                                      className="p-1 text-audafact-text-secondary hover:text-audafact-alert-red hover:bg-audafact-surface-2 rounded transition-colors duration-200"
                                      title="Delete Session"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                    </button>
                                  </div>
                                </div>
                              
                                {session.events.length > 0 && (
                                  <details className="mt-2">
                                    <summary className="text-xs audafact-text-secondary cursor-pointer hover:text-audafact-text-primary">
                                      View Events ({session.events.length})
                                    </summary>
                                    <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                                      {session.events.slice(0, 5).map((event, index) => (
                                        <div key={index} className="text-xs bg-audafact-surface-3 p-2 rounded">
                                          <div className="flex justify-between">
                                            <span className="font-mono text-audafact-accent-cyan">
                                              {Math.floor(event.timestamp / 1000)}:{((event.timestamp % 1000) / 10).toFixed(0).padStart(2, '0')}
                                            </span>
                                            <span className="text-audafact-alert-red">{event.type}</span>
                                          </div>
                                          <div className="text-audafact-text-secondary">
                                            Track: {event.trackId.substring(0, 8)}...
                                          </div>
                                        </div>
                                      ))}
                                      {session.events.length > 5 && (
                                        <div className="text-xs text-center audafact-text-secondary py-1">
                                          ...and {session.events.length - 5} more events
                                        </div>
                                      )}
                                    </div>
                                  </details>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                 
                <button
                  onClick={() => handleSessionsTabSelect('shared')}
                  className={`w-full px-8 py-2 text-xs text-left transition-colors duration-200 ${
                    activeSessionsTab === 'shared'
                      ? 'text-audafact-accent-cyan bg-audafact-surface-3'
                      : 'text-audafact-text-secondary hover:text-audafact-text-primary hover:bg-audafact-surface-3'
                  }`}
                >
                  Shared Sessions
                </button>
                 
                {/* Shared Sessions Content */}
                {activeSessionsTab === 'shared' && (
                  <div className="px-4 py-4 bg-audafact-surface-1 border-t border-audafact-divider">
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
          {/* Repo Menu - Only show for authenticated users */}
          {user && (
            <div className="border-b border-audafact-divider">
              <button
                onClick={() => toggleMenu('repo')}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-audafact-text-primary hover:bg-audafact-surface-2 transition-colors duration-200"
              >
                <span>Repo</span>
                <svg 
                  className={`w-4 h-4 transition-transform duration-200 ${expandedMenus['repo'] ? 'rotate-90' : ''}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              {expandedMenus['repo'] && (
                  <div className="bg-audafact-surface-2">
                    
                    
                    <button
                      onClick={() => handleRepoTabSelect('performances')}
                      className={`w-full px-8 py-2 text-xs text-left transition-colors duration-200 ${
                        activeRepoTab === 'performances'
                          ? 'text-audafact-accent-cyan bg-audafact-surface-3'
                          : 'text-audafact-text-secondary hover:text-audafact-text-primary hover:bg-audafact-surface-3'
                      }`}
                    >
                      Performances
                    </button>
                    {activeRepoTab === 'performances' && (
                      <div className="px-4 py-4 bg-audafact-surface-1 border-t border-audafact-divider">
                        <div className="flex items-center justify-between">
                          <h3 className="text-md font-medium audafact-heading">Performance Recordings</h3>
                          <span className="text-xs audafact-text-secondary">{performances.length} performances</span>
                        </div>
                        
                        {performances.length === 0 ? (
                          <div className="text-center py-8 flex-1 flex flex-col justify-center">
                            <div className="text-audafact-text-secondary mb-4">
                              <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                              </svg>
                            </div>
                            <p className="audafact-text-secondary mb-4">No performances recorded yet</p>
                            <p className="text-xs audafact-text-secondary">Use "Record" to capture your studio performances</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {performances.map((performance) => (
                              <div
                                key={performance.id}
                                className="p-3 border border-audafact-divider rounded-lg hover:bg-audafact-surface-2 transition-colors duration-200 audafact-card"
                              >
                                <div className="flex items-start justify-between mb-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <h4 className="font-medium audafact-text-primary text-sm">
                                        {new Date(performance.startTime).toLocaleDateString()} at {new Date(performance.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </h4>
                                      <span className="px-2 py-0.5 text-xs bg-audafact-alert-red text-audafact-text-primary rounded-full">
                                        Performance
                                      </span>
                                    </div>
                                    <p className="text-xs audafact-text-secondary">
                                      Duration: {Math.floor(performance.duration / 60000)}:{((performance.duration % 60000) / 1000).toFixed(0).padStart(2, '0')}
                                    </p>
                                    <p className="text-xs audafact-text-secondary">
                                      {performance.events.length} events • {performance.tracks.length} tracks
                                      {performance.audioBlob && ' • Audio recorded'}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-1 ml-2">
                                    {performance.audioBlob && (
                                      <button
                                        onClick={() => {
                                          try {
                                            const url = URL.createObjectURL(performance.audioBlob!);
                                            const audio = new Audio(url);
                                            
                                            audio.onerror = (e) => {
                                              console.error('Audio playback error:', e);
                                              alert('Failed to play audio. The format may not be supported.');
                                            };
                                            
                                            audio.onloadeddata = () => {
                                              // Audio loaded successfully
                                            };
                                            
                                            audio.play().catch(error => {
                                              console.error('Audio play failed:', error);
                                              alert('Failed to play audio. Please check browser audio permissions.');
                                            });
                                          } catch (error) {
                                            console.error('Audio playback setup failed:', error);
                                            alert('Failed to setup audio playback.');
                                          }
                                        }}
                                        className="p-1 text-audafact-text-secondary hover:text-audafact-accent-green hover:bg-audafact-surface-2 rounded transition-colors duration-200"
                                        title="Play Audio"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3l14 9-14 9V3z" />
                                        </svg>
                                      </button>
                                    )}
                                    {canAccessFeature('download') && (
                                      <button
                                        onClick={async () => {
                                          const canDownload = await canPerformAction('download');
                                          if (!canDownload) {
                                            setShowUpgradePrompt({
                                              show: true,
                                              message: getUpgradeMessage('download'),
                                              feature: 'Download'
                                            });
                                            return;
                                          }
                                          exportPerformance(performance.id);
                                        }}
                                        className="p-1 text-audafact-text-secondary hover:text-audafact-accent-cyan hover:bg-audafact-surface-2 rounded transition-colors duration-200"
                                        title="Export Performance"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                      </button>
                                    )}
                                    <button
                                      onClick={() => deletePerformance(performance.id)}
                                      className="p-1 text-audafact-text-secondary hover:text-audafact-alert-red hover:bg-audafact-surface-2 rounded transition-colors duration-200"
                                      title="Delete Performance"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
        </div>
      <div>
        {/* Hidden file input for upload functionality */}
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>
      
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