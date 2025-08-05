// Post-signup types and interfaces for PRD 09

export interface PostSignupAction {
  id: string;
  type: 'upload' | 'save_session' | 'add_library_track' | 'edit_cues' | 'record' | 'download';
  timestamp: number;
  context: Record<string, any>;
  priority: 'high' | 'medium' | 'low';
  expiresAt?: number;
}

export interface IntentCache {
  actions: PostSignupAction[];
  sessionId: string;
  lastUpdated: number;
  userTier: string;
}

export interface DemoSessionState {
  currentTrack: any | null;
  playbackPosition: number;
  cuePoints: any[];
  loopRegions: any[];
  mode: 'preview' | 'loop' | 'cue';
  volume: number;
  tempo: number;
  timestamp: number;
}

export interface SuccessMessage {
  id: string;
  title: string;
  message: string;
  icon: string;
  duration: number;
  actions?: SuccessMessageAction[];
}

export interface SuccessMessageAction {
  label: string;
  action: () => void;
  variant: 'primary' | 'secondary';
}

export interface ActionExecutor {
  execute(action: PostSignupAction): Promise<void>;
  canExecute(action: PostSignupAction, userTier: string): boolean;
  getSuccessMessage(action: PostSignupAction): string;
}

export interface SignupSuccessHandler {
  handleSignupSuccess(user: any, trigger?: string): Promise<void>;
  handleTierUpgrade(user: any, newTier: string): Promise<void>;
}

// Constants
export const INTENT_CACHE_KEY = 'post_signup_intent';
export const INTENT_EXPIRY_HOURS = 24;
export const DEMO_SESSION_KEY = 'demo_session_state';

// Success message configurations
export const SUCCESS_MESSAGES: Record<string, SuccessMessage> = {
  signup_completed: {
    id: 'signup_completed',
    title: 'Welcome to Audafact!',
    message: 'Your account has been created successfully.',
    icon: '🎉',
    duration: 5000,
    actions: [
      {
        label: 'Start Creating',
        action: () => {
          // Will be set by the component
          console.log('Start Creating action');
        },
        variant: 'primary'
      }
    ]
  },
  
  session_restored: {
    id: 'session_restored',
    title: 'Session Restored',
    message: 'Your previous session has been loaded.',
    icon: '💾',
    duration: 4000
  },
  
  feature_unlocked: {
    id: 'feature_unlocked',
    title: 'Feature Unlocked!',
    message: 'You now have access to this feature.',
    icon: '🔓',
    duration: 3000
  },
  
  tier_upgraded: {
    id: 'tier_upgraded',
    title: 'Pro Creator Activated!',
    message: 'Welcome to the Pro Creator tier.',
    icon: '🚀',
    duration: 5000,
    actions: [
      {
        label: 'Explore Pro Features',
        action: () => {
          // Will be set by the component
          console.log('Explore Pro Features action');
        },
        variant: 'primary'
      }
    ]
  }
}; 