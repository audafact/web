export interface TimeSignature {
  numerator: number;
  denominator: number;
}

export interface Measure {
  time: number;
  number: number;
}

// Database Types
export interface User {
  id: string;
  access_tier: 'free' | 'pro' | 'enterprise';
  stripe_customer_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Upload {
  id: string;
  user_id: string;
  file_key: string | null;
  file_url: string | null;
  title: string;
  duration?: number;
  created_at: string;
  // New fields for hash-based storage
  full_hash?: string;
  short_hash?: string;
  server_key?: string;
  size_bytes?: number;
  content_type?: string;
  original_name?: string;
}

export interface Session {
  id: string;
  user_id: string;
  session_name: string;
  track_ids: string[];
  cuepoints: any[];
  loop_regions: any[];
  mode: 'loop' | 'chop';
  created_at: string;
  updated_at: string;
}

export interface Recording {
  id: string;
  user_id: string;
  session_id?: string; // Optional - recordings can exist without sessions
  recording_url: string;
  length?: number;
  notes?: string;
  created_at: string;
}

// Storage Types
export interface StorageFile {
  name: string;
  bucket_id: string;
  owner: string;
  id: string;
  updated_at: string;
  created_at: string;
  last_accessed_at: string;
  metadata: Record<string, any>;
}



export interface UploadResponse {
  data: StorageFile | null;
  error: any;
}

export interface DownloadResponse {
  data: Blob | null;
  error: any;
}

// Audio File Types
export interface AudioFile {
  id: string;
  name: string;
  url: string;
  duration: number;
  size: number;
  type: string;
  uploaded_at: string;
}

// Feature Gating Types (PRD 2)
export interface FeatureAccess {
  canUpload: boolean;
  canSaveSession: boolean;
  canRecord: boolean;
  canDownload: boolean;
  canEditCues: boolean;
  canEditLoops: boolean;
  canBrowseLibrary: boolean;
  canAccessProTracks: boolean;
}

export interface UsageLimits {
  maxUploads: number;
  maxSessions: number;
  maxRecordings: number;
  maxLibraryTracks: number;
}

export interface UserTier {
  id: 'guest' | 'free' | 'pro';
  name: string;
  features: FeatureAccess;
  limits: UsageLimits;
}

export interface FeatureGateConfig {
  gateType: 'modal' | 'tooltip' | 'disabled' | 'hidden';
  message: string;
  ctaText: string;
  upgradeRequired: boolean;
}

export interface FeatureGateProps {
  feature: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  gateType?: 'modal' | 'tooltip' | 'disabled' | 'hidden';
  onGateTrigger?: (feature: string) => void;
}

// Library Panel Types for PRD 04
export interface LibraryTrack {
  id: string;
  name: string;
  artist?: string;
  genre: string;
  bpm: number;
  key?: string;
  duration: number;
  fileKey: string;
  previewKey?: string;
  type: "wav" | "mp3";
  size: string;
  tags: string[];
  isProOnly?: boolean;
  previewUrl?: string;
}

export interface LibraryPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  onAddToStudio: (track: LibraryTrack) => void;
  onPreviewTrack: (track: LibraryTrack) => void;
  isLoading: boolean;
}

export interface LibraryTrackItemProps {
  track: LibraryTrack;
  isPreviewing: boolean;
  onPreview: () => void;
  onAddToStudio: () => void;
  canAddToStudio: boolean;
  isProOnly: boolean;
}
