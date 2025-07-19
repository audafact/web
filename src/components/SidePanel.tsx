import { useState, useRef, useEffect } from 'react';

// Import all available audio assets
import secretsOfTheHeart from '../assets/audio/Secrets of the Heart.mp3';
import ronDrums from '../assets/audio/RON-drums.wav';
import rhythmRevealed from '../assets/audio/The Rhythm Revealed(Drums).wav';
import unveiledDesires from '../assets/audio/Unveiled Desires.wav';

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
  file: File;
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
  const [activeTab, setActiveTab] = useState<'my-tracks' | 'library'>('my-tracks');
  const [previewAudios, setPreviewAudios] = useState<{ [key: string]: HTMLAudioElement }>({});
  const [playingAssets, setPlayingAssets] = useState<{ [key: string]: boolean }>({});
  const [userTracks, setUserTracks] = useState<UserTrack[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load user tracks from localStorage on mount
  useEffect(() => {
    const savedTracks = localStorage.getItem('userTracks');
    if (savedTracks) {
      try {
        const tracks = JSON.parse(savedTracks);
        // Restore tracks from base64 data
        const restoredTracks = tracks.map((track: any) => {
          if (track.fileData) {
            // Convert base64 back to File object
            const byteString = atob(track.fileData.split(',')[1]);
            const mimeString = track.fileData.split(',')[0].split(':')[1].split(';')[0];
            const ab = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(ab);
            for (let i = 0; i < byteString.length; i++) {
              ia[i] = byteString.charCodeAt(i);
            }
            const file = new File([ab], track.name, { type: mimeString });
            const url = URL.createObjectURL(file);
            
            return {
              ...track,
              file: file,
              url: url
            };
          }
          return null;
        }).filter(Boolean);
        
        setUserTracks(restoredTracks);
      } catch (error) {
        console.error('Error loading user tracks:', error);
        setUserTracks([]);
      }
    }
  }, []);

  // Auto-show library when opened in library mode
  useEffect(() => {
    if (initialMode === 'library' && activeTab !== 'library') {
      setActiveTab('library');
    }
  }, [initialMode, activeTab]);

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

  // Define available audio assets
  const audioAssets: AudioAsset[] = [
    {
      id: 'ron-drums',
      name: 'RON Drums',
      file: ronDrums,
      type: 'wav',
      size: '5.5MB'
    },
    {
      id: 'secrets-of-the-heart',
      name: 'Secrets of the Heart',
      file: secretsOfTheHeart,
      type: 'mp3',
      size: '775KB'
    },
    {
      id: 'rhythm-revealed',
      name: 'The Rhythm Revealed (Drums)',
      file: rhythmRevealed,
      type: 'wav',
      size: '5.5MB'
    },
    {
      id: 'unveiled-desires',
      name: 'Unveiled Desires',
      file: unveiledDesires,
      type: 'wav',
      size: '6.0MB'
    }
  ];

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Create a URL for the file
      const url = URL.createObjectURL(file);
      
      // Convert file to base64 for localStorage storage
      const reader = new FileReader();
      reader.onload = () => {
        const base64Data = reader.result as string;
        
        // Create user track object
        const userTrack: UserTrack = {
          id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: file.name,
          file: file,
          type: file.type,
          size: `${(file.size / (1024 * 1024)).toFixed(1)}MB`,
          url: url,
          uploadedAt: Date.now()
        };

        // Add to user tracks
        const updatedTracks = [...userTracks, userTrack];
        setUserTracks(updatedTracks);
        
        // Save to localStorage with base64 data
        localStorage.setItem('userTracks', JSON.stringify(updatedTracks.map(track => ({
          ...track,
          fileData: track.id === userTrack.id ? base64Data : null,
          file: null // Don't store File object in localStorage
        }))));

        // Default to preview mode for uploaded files
        onUploadTrack(file, 'preview');
      };
      
      reader.readAsDataURL(file);
      
      // Reset the input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handlePreviewPlay = (asset: AudioAsset | UserTrack, isUserTrack = false) => {
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
    const audioSource = isUserTrack ? (asset as UserTrack).url : (asset as AudioAsset).file;
    const audio = new Audio(audioSource);
    
    audio.addEventListener('ended', () => {
      setPlayingAssets(prev => ({ ...prev, [assetId]: false }));
    });
    audio.addEventListener('pause', () => {
      setPlayingAssets(prev => ({ ...prev, [assetId]: false }));
    });
    
    audio.play().then(() => {
      setPlayingAssets(prev => ({ ...prev, [assetId]: true }));
      setPreviewAudios(prev => ({ ...prev, [assetId]: audio }));
    }).catch(error => {
      console.error('Failed to play preview:', error);
    });
  };

  const handleAddTrack = (asset: AudioAsset | UserTrack, isUserTrack = false) => {
    if (isUserTrack) {
      const userTrack = asset as UserTrack;
      onAddUserTrack(userTrack, 'preview');
    } else {
      const libraryAsset = asset as AudioAsset;
      onAddFromLibrary(libraryAsset, 'preview');
    }
    // Close the sidebar after adding a track
    onToggle();
  };

  const handleRemoveUserTrack = (trackId: string) => {
    const trackToRemove = userTracks.find(track => track.id === trackId);
    if (trackToRemove) {
      // Revoke the object URL to free memory
      URL.revokeObjectURL(trackToRemove.url);
    }
    
    const updatedTracks = userTracks.filter(track => track.id !== trackId);
    setUserTracks(updatedTracks);
    
    // Update localStorage - we need to preserve the fileData for remaining tracks
    const savedTracks = localStorage.getItem('userTracks');
    if (savedTracks) {
      try {
        const allTracks = JSON.parse(savedTracks);
        const remainingTracks = allTracks.filter((track: any) => track.id !== trackId);
        localStorage.setItem('userTracks', JSON.stringify(remainingTracks));
      } catch (error) {
        console.error('Error updating localStorage:', error);
      }
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={onToggle}
        />
      )}
      
      {/* Sidebar */}
      <div className={`fixed top-0 left-0 h-full bg-white border-r border-gray-200 shadow-lg transition-transform duration-300 ease-in-out z-50 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`} style={{ width: '100vw', maxWidth: '400px' }}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Audio Library
          </h2>
          <button
            onClick={onToggle}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('my-tracks')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'my-tracks'
                ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            My Tracks
          </button>
          <button
            onClick={() => setActiveTab('library')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'library'
                ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            TrackStitch Library
          </button>
        </div>

        {/* Content */}
        <div className="p-4 h-full overflow-y-auto">
          {activeTab === 'my-tracks' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-md font-medium text-gray-900">My Uploaded Tracks</h3>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
                >
                  Upload Track
                </button>
              </div>

              {userTracks.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-gray-400 mb-4">
                    <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <p className="text-gray-600 mb-4">No tracks uploaded yet</p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
                  >
                    Upload Your First Track
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {userTracks.map((track) => (
                    <div
                      key={track.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', track.id);
                        e.dataTransfer.effectAllowed = 'copy';
                      }}
                      className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {/* Play/Pause Button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePreviewPlay(track, true);
                            }}
                            className="flex-shrink-0 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
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
                            <h4 className="font-medium text-gray-900 truncate">{track.name}</h4>
                            <p className="text-sm text-gray-500">
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
                            className="flex-shrink-0 p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
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
                            className="flex-shrink-0 p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
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
              )}
            </div>
          )}

          {activeTab === 'library' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-md font-medium text-gray-900">Available Tracks</h3>
              </div>

              <div className="space-y-3">
                <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                  Click the play button to preview, or drag tracks to the drop zone. Click the + icon to add tracks (defaults to preview mode).
                </div>
                {audioAssets.map((asset) => (
                  <div
                    key={asset.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', asset.id);
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                    className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {/* Play/Pause Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePreviewPlay(asset, false);
                          }}
                          className="flex-shrink-0 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                          title={playingAssets[asset.id] ? 'Pause Preview' : 'Play Preview'}
                        >
                          {playingAssets[asset.id] ? (
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
                          <h4 className="font-medium text-gray-900 truncate">{asset.name}</h4>
                          <p className="text-sm text-gray-500">{asset.type.toUpperCase()} • {asset.size}</p>
                        </div>
                      </div>

                      {/* Add Track Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddTrack(asset, false);
                        }}
                        className="flex-shrink-0 p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                        title="Add to Studio (Preview Mode)"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Hidden file input for upload functionality */}
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>
    </>
  );
};

export default SidePanel; 