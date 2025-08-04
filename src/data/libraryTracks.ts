import { LibraryTrack } from '../types/music';

// Import audio assets
import ronDrums from '../assets/audio/RON-drums.wav';
import secretsOfTheHeart from '../assets/audio/Secrets of the Heart.mp3';
import rhythmRevealed from '../assets/audio/The Rhythm Revealed(Drums).wav';
import unveiledDesires from '../assets/audio/Unveiled Desires.wav';

export const LIBRARY_TRACKS: LibraryTrack[] = [
  {
    id: 'ron-drums',
    name: 'RON Drums',
    artist: 'RON',
    genre: 'drum-n-bass',
    bpm: 140,
    key: 'Am',
    duration: 180,
    file: ronDrums,
    type: 'wav',
    size: '5.5MB',
    tags: ['drums', 'drum-n-bass', 'electronic'],
    previewUrl: '/previews/ron-drums-preview.mp3'
  },
  {
    id: 'secrets-of-the-heart',
    name: 'Secrets of the Heart',
    artist: 'Ambient Collective',
    genre: 'ambient',
    bpm: 120,
    key: 'Cm',
    duration: 240,
    file: secretsOfTheHeart,
    type: 'mp3',
    size: '775KB',
    tags: ['ambient', 'atmospheric', 'chill'],
    previewUrl: '/previews/secrets-preview.mp3'
  },
  {
    id: 'rhythm-revealed',
    name: 'The Rhythm Revealed (Drums)',
    artist: 'House Masters',
    genre: 'house',
    bpm: 128,
    key: 'Fm',
    duration: 200,
    file: rhythmRevealed,
    type: 'wav',
    size: '5.5MB',
    tags: ['house', 'drums', 'groove'],
    previewUrl: '/previews/rhythm-preview.mp3'
  },
  {
    id: 'unveiled-desires',
    name: 'Unveiled Desires',
    artist: 'Techno Collective',
    genre: 'techno',
    bpm: 135,
    key: 'Em',
    duration: 220,
    file: unveiledDesires,
    type: 'wav',
    size: '6.0MB',
    tags: ['techno', 'dark', 'industrial'],
    previewUrl: '/previews/unveiled-preview.mp3'
  },
  // Pro-only tracks
  {
    id: 'pro-exclusive-1',
    name: 'Pro Exclusive Track 1',
    artist: 'Premium Artist',
    genre: 'progressive-house',
    bpm: 128,
    key: 'Am',
    duration: 300,
    file: ronDrums, // Using existing file as placeholder
    type: 'wav',
    size: '8.2MB',
    tags: ['progressive', 'house', 'premium'],
    isProOnly: true,
    previewUrl: '/previews/pro-1-preview.mp3'
  },
  {
    id: 'pro-exclusive-2',
    name: 'Pro Exclusive Track 2',
    artist: 'Elite Producer',
    genre: 'deep-house',
    bpm: 125,
    key: 'Dm',
    duration: 280,
    file: secretsOfTheHeart, // Using existing file as placeholder
    type: 'mp3',
    size: '7.8MB',
    tags: ['deep', 'house', 'premium'],
    isProOnly: true,
    previewUrl: '/previews/pro-2-preview.mp3'
  }
];

export const getLibraryTrackById = (id: string): LibraryTrack | undefined => {
  return LIBRARY_TRACKS.find(track => track.id === id);
};

export const getLibraryTracksByGenre = (genre: string): LibraryTrack[] => {
  return LIBRARY_TRACKS.filter(track => track.genre === genre);
};

export const getAvailableGenres = (): string[] => {
  return [...new Set(LIBRARY_TRACKS.map(track => track.genre))];
}; 