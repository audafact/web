// API Configuration
export const API_CONFIG = {
  // Base URL for the API service
  BASE_URL:
    import.meta.env.VITE_API_BASE_URL ||
    (import.meta.env.MODE === "staging"
      ? "http://localhost:5173/api/staging" // Use proxy for staging
      : "https://audafact-api.david-g-cortinas.workers.dev"),

  // Endpoints
  ENDPOINTS: {
    SIGN_UPLOAD: "/api/sign-upload",
    ANALYTICS: "/api/analytics",
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
