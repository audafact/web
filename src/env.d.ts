interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_APP_ENV: string;
  readonly VITE_AUDIO_SAMPLE_RATE: string;
  readonly VITE_MAX_UPLOAD_SIZE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Audio file type declarations
declare module "*.mp3" {
  const src: string;
  export default src;
}

declare module "*.wav" {
  const src: string;
  export default src;
}
