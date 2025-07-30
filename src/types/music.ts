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
  file_url: string;
  title: string;
  duration?: number;
  created_at: string;
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
  session_id: string;
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
