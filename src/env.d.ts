interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  /** Override local worker URL when not using default http://localhost:8787/api */
  readonly VITE_DEV_WORKER_API_URL?: string;
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_APP_ENV: string;
  readonly VITE_AUDIO_SAMPLE_RATE: string;
  readonly VITE_MAX_UPLOAD_SIZE: string;
  readonly VITE_STRIPE_MODE: string;
  readonly VITE_STRIPE_TEST_PRODUCT_MONTHLY: string;
  readonly VITE_STRIPE_TEST_PRODUCT_YEARLY: string;
  readonly VITE_STRIPE_TEST_PRODUCT_EARLY_ADOPTER: string;
  readonly VITE_STRIPE_TEST_PRICE_STARTER_MONTHLY?: string;
  readonly VITE_STRIPE_LIVE_PRICE_STARTER_MONTHLY?: string;
  readonly VITE_STRIPE_TEST_PRICE_MONTHLY: string;
  readonly VITE_STRIPE_TEST_PRICE_YEARLY: string;
  readonly VITE_STRIPE_TEST_PRICE_EARLY_ADOPTER: string;
  readonly VITE_STRIPE_LIVE_PRODUCT_MONTHLY: string;
  readonly VITE_STRIPE_LIVE_PRODUCT_YEARLY: string;
  readonly VITE_STRIPE_LIVE_PRODUCT_EARLY_ADOPTER: string;
  readonly VITE_STRIPE_LIVE_PRICE_MONTHLY: string;
  readonly VITE_STRIPE_LIVE_PRICE_YEARLY: string;
  readonly VITE_STRIPE_LIVE_PRICE_EARLY_ADOPTER: string;
  readonly VITE_TURNSTILE_SITE_KEY: string;
  readonly VITE_HOST_EXPERIENCE?: "app" | "marketing";
  /** Optional; if unset, OAuth uses `window.location.origin`/auth/callback */
  readonly VITE_AUTH_REDIRECT_URL?: string;
  /** When "true", production builds keep console.* (Terser). Pair with staging debug. */
  readonly VITE_KEEP_CONSOLE?: string;
  /** When "true", log [Audafact API base] and sign-file/stream URL resolution in the browser. */
  readonly VITE_DEBUG_API_BASE?: string;
  readonly MODE: string;
  readonly PROD: boolean;
  readonly DEV: boolean;
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
