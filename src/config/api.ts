// API Configuration
const getBaseUrl = () => {
  // Check for explicit environment variable first
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }

  // For local development, always use proxy
  const mode = import.meta.env.MODE;

  if (mode === "development") {
    return "http://localhost:5173/api/staging";
  }

  if (mode === "staging") {
    return "http://localhost:5173/api/staging";
  }

  return "https://audafact-api.david-g-cortinas.workers.dev/api";
};

export const API_CONFIG = {
  // Base URL for the API service
  BASE_URL: getBaseUrl(),

  // Endpoints (relative to BASE_URL)
  ENDPOINTS: {
    SIGN_UPLOAD: "/sign-upload",
    ANALYTICS: "/analytics",
    TRIGGER_ANALYSIS: "/trigger-analysis",
  },

  // Timeouts
  TIMEOUTS: {
    UPLOAD: 30000, // 30 seconds for upload operations
    REQUEST: 10000, // 10 seconds for general requests
  },
} as const;

// Helper function to build full API URLs
export const buildApiUrl = (endpoint: string): string => {
  return `${API_CONFIG.BASE_URL}${endpoint}`;
};
