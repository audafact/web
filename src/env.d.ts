interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_APP_ENV: string;
  readonly VITE_AUDIO_SAMPLE_RATE: string;
  readonly VITE_MAX_UPLOAD_SIZE: string;
  readonly VITE_STRIPE_MODE: string;
  readonly VITE_STRIPE_TEST_PRODUCT_MONTHLY: string;
  readonly VITE_STRIPE_TEST_PRODUCT_YEARLY: string;
  readonly VITE_STRIPE_TEST_PRODUCT_EARLY_ADOPTER: string;
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
  readonly VITE_EMAILJS_SERVICE_ID: string;
  readonly VITE_EMAILJS_TEMPLATE_ID: string;
  readonly VITE_EMAILJS_PUBLIC_KEY: string;
  readonly MODE: string;
  readonly PROD: boolean;
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
