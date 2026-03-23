// Analytics service for tracking user interactions and conversion events

export interface AnalyticsEvent {
  event: string;
  userId?: string;
  sessionId: string;
  timestamp: number;
  properties: Record<string, any>;
  userTier: "guest" | "free" | "pro";
  version: string;
  platform: "web" | "mobile";
}

export interface TrackingEvents {
  // Demo engagement
  demo_track_loaded: { trackId: string; genre: string; bpm: number };
  demo_mode_switched: { fromMode: string; toMode: string };
  demo_cue_triggered: { cueIndex: number; trackId: string };
  demo_next_track: { fromTrackId: string; toTrackId: string };
  demo_session_started: { timestamp: number };
  demo_session_ended: { duration: number; actions: string[] };

  // Feature gate interactions
  feature_gate_clicked: { feature: string; userTier: string; gateType: string };
  tooltip_shown: { feature: string; tooltipText?: string; userTier: string };
  mobile_gate_tapped: {
    feature: string;
    screenSize: "mobile" | "tablet";
    userTier: string;
  };
  signup_modal_shown: { trigger: string; userTier: string };
  signup_modal_dismissed: { trigger: string; userTier: string };

  // Conversion events
  signup_completed: {
    method: "email" | "google";
    trigger?: string;
    upgradeRequired: boolean;
  };
  signup_error: { trigger: string; error: string };
  post_signup_action: { action: string; userTier: string };
  upgrade_clicked: { feature: string; currentTier: string };
  upgrade_completed: { plan: string; amount: number };

  // Library interactions
  library_panel_opened: { userTier: string };
  library_track_previewed: {
    trackId: string;
    genre: string;
    bpm: number;
    userTier: string;
  };
  library_track_added: { trackId: string; genre: string; userTier: string };
  library_search_performed: {
    searchTerm: string;
    resultsCount: number;
    userTier: string;
  };
  library_genre_filtered: {
    genre: string;
    resultsCount: number;
    userTier: string;
  };

  // Studio actions
  track_uploaded: {
    fileName: string;
    fileSize: number;
    fileType: string;
    userTier: string;
  };
  session_saved: {
    sessionName?: string;
    userTier: string;
    isModified: boolean;
  };
  recording_started: { userTier: string };
  recording_stopped: { userTier: string };
  recording_downloaded: { fileName?: string; format: string; userTier: string };

  // Creative Metrics (Studio only - excludes /demo)
  sampler_opened: { userTier: string };
  session_started: { userTier: string };
  sampler_ready: { trackId?: string; loadTime?: number; userTier: string };
  track_loaded: { trackId: string; trackIndex?: number; source?: string; userTier: string };
  first_creative_action: { action: string; timeSinceReadyMs: number; userTier: string };
  cue_added: { trackId: string; cueIndex: number; userTier: string };
  loop_created: { trackId: string; start: number; end: number; userTier: string };
  track_added: { trackId: string; trackIndex: number; mode?: string; source?: string; userTier: string };
  parameter_changed: { trackId: string; parameterType: string; userTier: string };
  record_started: { userTier: string };
  record_stopped: { userTier: string };
  cue_triggered: { cueIndex: number; trackId: string; userTier: string };
  audio_exported: { fileName?: string; format: string; userTier: string };
  user_returned: { returnSource?: string; userTier: string };
  creative_action_after_return: { action: string; userTier: string };

  // Performance metrics
  demo_load_time: { loadTime: number; userTier: string };
  feature_gate_response_time: {
    feature: string;
    responseTime: number;
    userTier: string;
  };
  signup_flow_completion_time: { duration: number; method: string };
  performance_metric: { metric: string; value: number; userTier: string };

  // Error tracking
  error_occurred: {
    error: string;
    context: string;
    userTier: string;
    stack?: string;
    url?: string;
    userAgent?: string;
  };
  feature_error: { feature: string; error: string; userTier: string };

  // Funnel tracking
  funnel_progress: {
    stage: string;
    stageIndex: number;
    properties: any;
    previousStages: string[];
    completedStages: string[];
  };
  funnel_completed: {
    userId: string;
    completedStages: string[];
    completionTime: number;
  };
}

// Funnel stage definition
export interface FunnelStage {
  name: string;
  event: string;
  filters?: Record<string, any>;
  required?: boolean;
}

export const FUNNEL_STAGES: FunnelStage[] = [
  { name: "Demo Started", event: "demo_track_loaded", required: true },
  { name: "Feature Interaction", event: "demo_mode_switched" },
  { name: "Gate Clicked", event: "feature_gate_clicked", required: true },
  { name: "Signup Modal Shown", event: "signup_modal_shown", required: true },
  { name: "Signup Completed", event: "signup_completed", required: true },
  { name: "Upgrade Clicked", event: "upgrade_clicked" },
  { name: "Upgrade Completed", event: "upgrade_completed", required: true },
];

/** Creative actions that count toward creation metrics (excludes cue_triggered, play/pause) */
export const CREATIVE_EVENTS = new Set<string>([
  "cue_added",
  "loop_created",
  "track_added",
  "parameter_changed",
  "record_started",
]);

/** Interaction events (tracked but not counted toward creation metrics) */
export const INTERACTION_EVENTS = new Set<string>(["cue_triggered"]);

/** Creative funnel stages for sampler flow */
export const CREATIVE_FUNNEL_STAGES = [
  { name: "Sampler Opened", event: "sampler_opened" },
  { name: "Track Loaded", event: "track_loaded" },
  { name: "Sampler Ready", event: "sampler_ready" },
  { name: "First Creative Action", event: "first_creative_action" },
] as const;

export class AnalyticsService {
  private static instance: AnalyticsService;
  private events: AnalyticsEvent[] = [];
  private isOnline: boolean = navigator.onLine;
  private sessionId: string;
  private userId?: string;
  private userTier: string = "guest";
  private retryQueue: AnalyticsEvent[] = [];
  private userProgress: Map<string, Set<string>> = new Map();
  private performanceMetrics: Map<string, number[]> = new Map();
  /** For TTFC: timestamp when sampler_ready fired this session */
  private samplerReadyTimestamp: number | null = null;
  /** Whether we've emitted first_creative_action this session */
  private hasEmittedFirstCreativeAction = false;

  private constructor() {
    this.sessionId = this.generateSessionId();
    this.setupOnlineOfflineHandling();
    this.setupGlobalErrorHandling();
    this.loadRetryQueue();
    this.trackPageLoadTime();
  }

  static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService();
    }
    return AnalyticsService.instance;
  }

  // For testing purposes
  static resetInstance() {
    AnalyticsService.instance = undefined as any;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private setupOnlineOfflineHandling() {
    // Update isOnline to current state
    this.isOnline = navigator.onLine;

    window.addEventListener("online", () => {
      this.isOnline = true;
      this.processRetryQueue();
    });

    window.addEventListener("offline", () => {
      this.isOnline = false;
    });
  }

  private setupGlobalErrorHandling() {
    window.addEventListener("error", (event) => {
      this.trackError(event.error, "global_error");
    });

    window.addEventListener("unhandledrejection", (event) => {
      this.trackError(new Error(event.reason), "unhandled_promise");
    });
  }

  private trackPageLoadTime() {
    const startTime = performance.now();

    window.addEventListener("load", () => {
      const loadTime = performance.now() - startTime;
      this.trackMetric("page_load_time", loadTime);
    });
  }

  setUser(userId: string, userTier: string) {
    this.userId = userId;
    this.userTier = userTier;
  }

  track<K extends keyof TrackingEvents>(
    event: K,
    properties: TrackingEvents[K]
  ) {
    const now = Date.now();

    // Creative metrics: capture sampler_ready for TTFC
    if (event === "sampler_ready") {
      this.samplerReadyTimestamp = now;
    }

    // Creative metrics: emit first_creative_action on first creative action this session
    if (
      CREATIVE_EVENTS.has(event as string) &&
      !this.hasEmittedFirstCreativeAction &&
      this.samplerReadyTimestamp !== null
    ) {
      const timeSinceReadyMs = now - this.samplerReadyTimestamp;
      this.hasEmittedFirstCreativeAction = true;
      const firstActionData: AnalyticsEvent = {
        event: "first_creative_action",
        userId: this.userId,
        sessionId: this.sessionId,
        timestamp: now,
        properties: {
          action: event,
          timeSinceReadyMs,
          userTier: (properties as any).userTier ?? this.userTier,
        },
        userTier: this.userTier as "guest" | "free" | "pro",
        version: "1.0.0",
        platform: "web",
      };
      this.events.push(firstActionData);
      if (this.isOnline) {
        this.sendEvent(firstActionData);
      } else {
        this.storeForRetry(firstActionData);
      }
    }

    const eventData: AnalyticsEvent = {
      event,
      userId: this.userId,
      sessionId: this.sessionId,
      timestamp: now,
      properties,
      userTier: this.userTier as "guest" | "free" | "pro",
      version: "1.0.0",
      platform: "web",
    };

    // Store locally
    this.events.push(eventData);

    // Track funnel progress for relevant events
    this.trackFunnelProgress(event, properties);

    // Send immediately if online
    if (this.isOnline) {
      this.sendEvent(eventData);
    } else {
      // Store for retry
      this.storeForRetry(eventData);
    }

    // Keep only last 100 events in memory
    if (this.events.length > 100) {
      this.events = this.events.slice(-100);
    }

    // Log for development
    console.log(`Analytics: ${event}`, eventData);
  }

  private trackFunnelProgress(event: string, properties: any) {
    const stage = FUNNEL_STAGES.find((s) => s.event === event);
    if (!stage) return;

    const stageIndex = FUNNEL_STAGES.findIndex((s) => s.name === stage.name);
    const userId = this.userId || "anonymous";

    // Track user progress
    if (!this.userProgress.has(userId)) {
      this.userProgress.set(userId, new Set());
    }

    this.userProgress.get(userId)!.add(stage.name);

    // Track funnel progress as a separate event
    this.track("funnel_progress", {
      stage: stage.name,
      stageIndex,
      properties,
      previousStages: FUNNEL_STAGES.slice(0, stageIndex).map((s) => s.name),
      completedStages: Array.from(this.userProgress.get(userId) || []),
    });

    // Check if user completed the funnel
    this.checkFunnelCompletion(userId, stage.name);
  }

  private checkFunnelCompletion(userId: string, currentStage: string) {
    const userStages = this.userProgress.get(userId);
    if (!userStages) return;

    const requiredStages = FUNNEL_STAGES.filter((stage) => stage.required).map(
      (stage) => stage.name
    );

    const hasCompletedRequired = requiredStages.every((stage) =>
      userStages.has(stage)
    );

    if (hasCompletedRequired) {
      // Track funnel completion as a separate event
      this.track("funnel_completed", {
        userId,
        completedStages: Array.from(userStages),
        completionTime: this.calculateFunnelTime(userId),
      });
    }
  }

  private calculateFunnelTime(userId: string): number {
    // Implementation would track timestamps for each stage
    // and calculate total time from first to last stage
    // For now, return a placeholder
    return 0;
  }

  trackMetric(name: string, value: number) {
    if (!this.performanceMetrics.has(name)) {
      this.performanceMetrics.set(name, []);
    }

    this.performanceMetrics.get(name)!.push(value);

    // Keep only last 100 values
    if (this.performanceMetrics.get(name)!.length > 100) {
      this.performanceMetrics.set(
        name,
        this.performanceMetrics.get(name)!.slice(-100)
      );
    }

    // Send to analytics
    this.track("performance_metric", {
      metric: name,
      value,
      userTier: this.userTier,
    });
  }

  trackError(error: Error, context: string) {
    this.track("error_occurred", {
      error: error.message,
      stack: error.stack,
      context,
      userTier: this.userTier,
      url: window.location.href,
      userAgent: navigator.userAgent,
    });
  }

  trackFeatureError(feature: string, error: Error) {
    this.track("feature_error", {
      feature,
      error: error.message,
      userTier: this.userTier,
    });
  }

  trackFeatureResponseTime(feature: string) {
    const startTime = performance.now();

    return () => {
      const responseTime = performance.now() - startTime;
      this.track("feature_gate_response_time", {
        feature,
        responseTime,
        userTier: this.userTier,
      });
    };
  }

  private async sendEvent(eventData: AnalyticsEvent) {
    try {
      // Get the current JWT token for authentication
      const token = await this.getAuthToken();

      // Prepare headers - only include Authorization if we have a token
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      // Use the Cloudflare Worker URL for analytics
      const { API_CONFIG } = await import("../config/api");
      const response = await fetch(
        `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.ANALYTICS}`,
        {
          method: "POST",
          headers,
          body: JSON.stringify(eventData),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Analytics request failed: ${response.status} - ${errorText}`
        );
      }

      // Clear from retry queue if it was a retry
      this.removeFromRetryQueue(eventData);
    } catch (error) {
      console.error("Failed to send analytics event:", error);
      this.storeForRetry(eventData);

      // Track analytics errors for monitoring
      this.trackAnalyticsError(error as Error, eventData);
    }
  }

  private async getAuthToken(): Promise<string | null> {
    try {
      // Get token from Supabase client (same approach as other services)
      const {
        data: { session },
      } = await import("../services/supabase").then((m) =>
        m.supabase.auth.getSession()
      );
      return session?.access_token || null;
    } catch (error) {
      console.warn("Could not get auth token for analytics:", error);
      return null;
    }
  }

  private removeFromRetryQueue(eventData: AnalyticsEvent) {
    this.retryQueue = this.retryQueue.filter(
      (event) =>
        event.sessionId !== eventData.sessionId ||
        event.timestamp !== eventData.timestamp ||
        event.event !== eventData.event
    );
    this.saveRetryQueue();
  }

  private trackAnalyticsError(error: Error, eventData: AnalyticsEvent) {
    // Store analytics errors locally for debugging
    const errorLog = {
      timestamp: Date.now(),
      error: error.message,
      eventData: {
        event: eventData.event,
        sessionId: eventData.sessionId,
        userId: eventData.userId,
        userTier: eventData.userTier,
      },
    };

    try {
      const existingErrors = JSON.parse(
        localStorage.getItem("analytics_errors") || "[]"
      );
      existingErrors.push(errorLog);

      // Keep only last 50 errors
      if (existingErrors.length > 50) {
        existingErrors.splice(0, existingErrors.length - 50);
      }

      localStorage.setItem("analytics_errors", JSON.stringify(existingErrors));
    } catch (storageError) {
      console.warn("Could not store analytics error:", storageError);
    }
  }

  private storeForRetry(eventData: AnalyticsEvent) {
    this.retryQueue.push(eventData);
    this.saveRetryQueue();
  }

  private saveRetryQueue() {
    try {
      localStorage.setItem(
        "analytics_retry_queue",
        JSON.stringify(this.retryQueue)
      );
    } catch (error) {
      console.error("Failed to save retry queue:", error);
    }
  }

  private loadRetryQueue() {
    try {
      const stored = localStorage.getItem("analytics_retry_queue");
      if (stored) {
        this.retryQueue = JSON.parse(stored);
      }
    } catch (error) {
      console.error("Failed to load analytics retry queue:", error);
    }
  }

  private async processRetryQueue() {
    if (this.retryQueue.length === 0) return;

    const eventsToRetry = [...this.retryQueue];
    this.retryQueue = [];

    for (const eventData of eventsToRetry) {
      await this.sendEvent(eventData);
    }

    this.saveRetryQueue();
  }

  getEvents(): AnalyticsEvent[] {
    return [...this.events];
  }

  getSessionId(): string {
    return this.sessionId;
  }

  getRetryQueueLength(): number {
    return this.retryQueue.length;
  }

  getFunnelConversionRate(): Record<string, number> {
    const rates: Record<string, number> = {};
    const totalUsers = this.userProgress.size;

    FUNNEL_STAGES.forEach((stage) => {
      const usersAtStage = Array.from(this.userProgress.values()).filter(
        (stages) => stages.has(stage.name)
      ).length;

      rates[stage.name] =
        totalUsers > 0 ? (usersAtStage / totalUsers) * 100 : 0;
    });

    return rates;
  }

  getAverageMetric(name: string): number {
    const values = this.performanceMetrics.get(name);
    if (!values || values.length === 0) return 0;

    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  // For testing purposes
  getUserProgress(): Map<string, Set<string>> {
    return this.userProgress;
  }

  // For testing purposes
  setUserProgress(progress: Map<string, Set<string>>) {
    this.userProgress = progress;
  }

  clearEvents() {
    this.events = [];
  }

  getAnalyticsErrors(): any[] {
    try {
      return JSON.parse(localStorage.getItem("analytics_errors") || "[]");
    } catch (error) {
      console.warn("Could not retrieve analytics errors:", error);
      return [];
    }
  }

  clearAnalyticsErrors() {
    try {
      localStorage.removeItem("analytics_errors");
    } catch (error) {
      console.warn("Could not clear analytics errors:", error);
    }
  }

  // Health check method
  getHealthStatus() {
    return {
      isOnline: this.isOnline,
      retryQueueLength: this.retryQueue.length,
      eventsInMemory: this.events.length,
      sessionId: this.sessionId,
      userId: this.userId,
      userTier: this.userTier,
      analyticsErrors: this.getAnalyticsErrors().length,
    };
  }
}

// Global analytics instance
export const analytics = AnalyticsService.getInstance();

// Convenience function for tracking events
export const trackEvent = <K extends keyof TrackingEvents>(
  event: K,
  properties: TrackingEvents[K]
) => {
  analytics.track(event, properties);
};

// Convenience function for tracking errors
export const trackError = (error: Error, context: string) => {
  analytics.trackError(error, context);
};

// Convenience function for tracking feature errors
export const trackFeatureError = (feature: string, error: Error) => {
  analytics.trackFeatureError(feature, error);
};

// Convenience function for tracking metrics
export const trackMetric = (name: string, value: number) => {
  analytics.trackMetric(name, value);
};
