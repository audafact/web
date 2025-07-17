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

interface SidePanelProps {
  isOpen: boolean;
  onToggle: () => void;
  onUploadTrack: (file: File, trackType: 'loop' | 'cue') => void;
  onAddFromLibrary: (asset: AudioAsset, trackType: 'loop' | 'cue') => void;
  isLoading: boolean;
  initialMode?: 'upload' | 'library';
}

const SidePanel: React.FC<SidePanelProps> = ({
  isOpen,
  onToggle,
  onUploadTrack,
  onAddFromLibrary,
  isLoading,
  initialMode
}) => {
  const [showLibrary, setShowLibrary] = useState(initialMode === 'library');
  const [previewAudios, setPreviewAudios] = useState<{ [key: string]: HTMLAudioElement }>({});
  const [playingAssets, setPlayingAssets] = useState<{ [key: string]: boolean }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-show library when opened in library mode
  useEffect(() => {
    if (initialMode === 'library' && !showLibrary) {
      setShowLibrary(true);
    }
  }, [initialMode, showLibrary]);

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

  const handleUploadClick = () => {
    setShowLibrary(false);
    fileInputRef.current?.click();
  };

  const handleLibraryClick = () => {
    setShowLibrary(true);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Default to cue mode for uploaded files
      onUploadTrack(file, 'cue');
      // Reset the input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handlePreviewPlay = (asset: AudioAsset) => {
    // Stop any currently playing audio
    Object.entries(previewAudios).forEach(([id, audio]) => {
      if (id !== asset.id && audio) {
        audio.pause();
        audio.currentTime = 0;
        setPlayingAssets(prev => ({ ...prev, [id]: false }));
      }
    });

    // If this asset is already playing, stop it
    if (playingAssets[asset.id]) {
      const audio = previewAudios[asset.id];
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
        setPlayingAssets(prev => ({ ...prev, [asset.id]: false }));
      }
      return;
    }

    // Create new audio element
    const audio = new Audio(asset.file);
    audio.addEventListener('ended', () => {
      setPlayingAssets(prev => ({ ...prev, [asset.id]: false }));
    });
    audio.addEventListener('pause', () => {
      setPlayingAssets(prev => ({ ...prev, [asset.id]: false }));
    });
    
    audio.play().then(() => {
      setPlayingAssets(prev => ({ ...prev, [asset.id]: true }));
      setPreviewAudios(prev => ({ ...prev, [asset.id]: audio }));
    }).catch(error => {
      console.error('Failed to play preview:', error);
    });
  };

  const handleAddTrack = (asset: AudioAsset) => {
    // Default to cue mode when adding from library
    onAddFromLibrary(asset, 'cue');
  };

  return (
    <div className={`fixed top-0 left-0 h-full bg-white border-r border-gray-200 shadow-lg transition-transform duration-300 ease-in-out z-50 ${
      isOpen ? 'translate-x-0' : '-translate-x-full'
    }`} style={{ width: '400px' }}>
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

      {/* Content */}
      <div className="p-4 h-full overflow-y-auto">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-md font-medium text-gray-900">Available Tracks</h3>
          </div>

          <div className="space-y-3">
            <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
              Click the play button to preview, or drag tracks to the drop zone. Click the + icon to add tracks (defaults to cue mode).
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
                        handlePreviewPlay(asset);
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
                      handleAddTrack(asset);
                    }}
                    className="flex-shrink-0 p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                    title="Add to Studio (Cue Mode)"
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
  );
};

export default SidePanel; 