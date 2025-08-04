# 🔄 PRD 9: Post-Signup Experience Continuity

## 📋 Overview

**Scope:** Post-signup redirect and state resumption, LocalStorage-based intent caching, UI updates for tier change

**Dependencies:** PRD 1, 2, 3, 5 (gate trigger → signup → resume)  
**Parallelizable:** No (requires coordination)  
**Estimated Timeline:** 1 week

---

## 🎯 Objectives

- Maintain user context and intent through the signup flow
- Provide seamless post-signup experience with immediate feature access
- Handle tier changes and UI updates gracefully
- Preserve demo session state for returning users

---

## 🏗️ Technical Requirements

### 9.1 Intent Caching System

#### Post-Signup Action Schema
```typescript
interface PostSignupAction {
  id: string;
  type: 'upload' | 'save_session' | 'add_library_track' | 'edit_cues' | 'record' | 'download';
  timestamp: number;
  context: Record<string, any>;
  priority: 'high' | 'medium' | 'low';
  expiresAt?: number;
}

interface IntentCache {
  actions: PostSignupAction[];
  sessionId: string;
  lastUpdated: number;
  userTier: string;
}

const INTENT_CACHE_KEY = 'post_signup_intent';
const INTENT_EXPIRY_HOURS = 24;
```

#### Intent Management Service
```typescript
class IntentManagementService {
  private static instance: IntentManagementService;
  
  private constructor() {}
  
  static getInstance(): IntentManagementService {
    if (!IntentManagementService.instance) {
      IntentManagementService.instance = new IntentManagementService();
    }
    return IntentManagementService.instance;
  }
  
  cacheIntent(action: PostSignupAction): void {
    try {
      const existing = this.getIntentCache();
      const updatedActions = [
        ...existing.actions.filter(a => a.id !== action.id),
        action
      ].sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });
      
      const cache: IntentCache = {
        actions: updatedActions,
        sessionId: this.getSessionId(),
        lastUpdated: Date.now(),
        userTier: 'guest' // Will be updated after signup
      };
      
      localStorage.setItem(INTENT_CACHE_KEY, JSON.stringify(cache));
    } catch (error) {
      console.error('Failed to cache intent:', error);
    }
  }
  
  getIntentCache(): IntentCache {
    try {
      const stored = localStorage.getItem(INTENT_CACHE_KEY);
      if (!stored) {
        return {
          actions: [],
          sessionId: this.getSessionId(),
          lastUpdated: Date.now(),
          userTier: 'guest'
        };
      }
      
      const cache: IntentCache = JSON.parse(stored);
      
      // Clean expired actions
      const now = Date.now();
      const validActions = cache.actions.filter(action => {
        if (!action.expiresAt) return true;
        return now < action.expiresAt;
      });
      
      if (validActions.length !== cache.actions.length) {
        cache.actions = validActions;
        this.updateIntentCache(cache);
      }
      
      return cache;
    } catch (error) {
      console.error('Failed to get intent cache:', error);
      return {
        actions: [],
        sessionId: this.getSessionId(),
        lastUpdated: Date.now(),
        userTier: 'guest'
      };
    }
  }
  
  clearIntentCache(): void {
    try {
      localStorage.removeItem(INTENT_CACHE_KEY);
    } catch (error) {
      console.error('Failed to clear intent cache:', error);
    }
  }
  
  updateUserTier(newTier: string): void {
    try {
      const cache = this.getIntentCache();
      cache.userTier = newTier;
      cache.lastUpdated = Date.now();
      this.updateIntentCache(cache);
    } catch (error) {
      console.error('Failed to update user tier:', error);
    }
  }
  
  private updateIntentCache(cache: IntentCache): void {
    localStorage.setItem(INTENT_CACHE_KEY, JSON.stringify(cache));
  }
  
  private getSessionId(): string {
    return localStorage.getItem('session_id') || `session_${Date.now()}`;
  }
}
```

### 9.2 Post-Signup Action Handler

#### Action Execution Service
```typescript
interface ActionExecutor {
  execute(action: PostSignupAction): Promise<void>;
  canExecute(action: PostSignupAction, userTier: string): boolean;
  getSuccessMessage(action: PostSignupAction): string;
}

class PostSignupActionService {
  private static instance: PostSignupActionService;
  private executors: Map<string, ActionExecutor> = new Map();
  
  private constructor() {
    this.registerExecutors();
  }
  
  static getInstance(): PostSignupActionService {
    if (!PostSignupActionService.instance) {
      PostSignupActionService.instance = new PostSignupActionService();
    }
    return PostSignupActionService.instance;
  }
  
  private registerExecutors(): void {
    this.executors.set('upload', new UploadActionExecutor());
    this.executors.set('save_session', new SaveSessionActionExecutor());
    this.executors.set('add_library_track', new AddLibraryTrackActionExecutor());
    this.executors.set('edit_cues', new EditCuesActionExecutor());
    this.executors.set('record', new RecordActionExecutor());
    this.executors.set('download', new DownloadActionExecutor());
  }
  
  async executePendingActions(): Promise<void> {
    const intentCache = IntentManagementService.getInstance().getIntentCache();
    const { user } = useAuth();
    const userTier = user?.subscription_tier || 'free';
    
    // Update user tier in cache
    IntentManagementService.getInstance().updateUserTier(userTier);
    
    const executableActions = intentCache.actions.filter(action => {
      const executor = this.executors.get(action.type);
      return executor && executor.canExecute(action, userTier);
    });
    
    for (const action of executableActions) {
      try {
        const executor = this.executors.get(action.type);
        if (executor) {
          await executor.execute(action);
          
          // Show success message
          const message = executor.getSuccessMessage(action);
          showSuccessMessage(message);
          
          // Remove executed action from cache
          this.removeActionFromCache(action.id);
        }
      } catch (error) {
        console.error(`Failed to execute action ${action.type}:`, error);
        showErrorMessage(`Failed to complete ${action.type} action`);
      }
    }
  }
  
  private removeActionFromCache(actionId: string): void {
    const intentCache = IntentManagementService.getInstance().getIntentCache();
    intentCache.actions = intentCache.actions.filter(a => a.id !== actionId);
    localStorage.setItem(INTENT_CACHE_KEY, JSON.stringify(intentCache));
  }
}

// Action Executor Implementations
class UploadActionExecutor implements ActionExecutor {
  async execute(action: PostSignupAction): Promise<void> {
    // Trigger upload panel
    setSidePanelMode('upload');
    
    // If there's file context, pre-populate
    if (action.context.file) {
      // Handle file upload logic
    }
  }
  
  canExecute(action: PostSignupAction, userTier: string): boolean {
    return userTier !== 'guest';
  }
  
  getSuccessMessage(action: PostSignupAction): string {
    return "🎉 Welcome! You can now upload your own tracks.";
  }
}

class SaveSessionActionExecutor implements ActionExecutor {
  async execute(action: PostSignupAction): Promise<void> {
    // Trigger save session flow
    await handleSaveSession();
  }
  
  canExecute(action: PostSignupAction, userTier: string): boolean {
    return userTier !== 'guest';
  }
  
  getSuccessMessage(action: PostSignupAction): string {
    return "💾 Session saved! You can now save unlimited sessions.";
  }
}

class AddLibraryTrackActionExecutor implements ActionExecutor {
  async execute(action: PostSignupAction): Promise<void> {
    // Switch to library panel
    setSidePanelMode('library');
    
    // If specific track context, highlight it
    if (action.context.trackId) {
      // Highlight the specific track
    }
  }
  
  canExecute(action: PostSignupAction, userTier: string): boolean {
    return userTier !== 'guest';
  }
  
  getSuccessMessage(action: PostSignupAction): string {
    return "🎵 Browse our full library and add tracks to your studio!";
  }
}

class EditCuesActionExecutor implements ActionExecutor {
  async execute(action: PostSignupAction): Promise<void> {
    // Enable cue editing mode
    setCueEditingMode(true);
    
    // If specific cue context, focus on it
    if (action.context.cueIndex !== undefined) {
      // Focus on specific cue
    }
  }
  
  canExecute(action: PostSignupAction, userTier: string): boolean {
    return userTier !== 'guest';
  }
  
  getSuccessMessage(action: PostSignupAction): string {
    return "🎯 You can now customize cue points and loops!";
  }
}

class RecordActionExecutor implements ActionExecutor {
  async execute(action: PostSignupAction): Promise<void> {
    // Show recording tutorial or enable recording
    setRecordingMode(true);
  }
  
  canExecute(action: PostSignupAction, userTier: string): boolean {
    return userTier === 'pro';
  }
  
  getSuccessMessage(action: PostSignupAction): string {
    return "🎙 Start recording your performances!";
  }
}

class DownloadActionExecutor implements ActionExecutor {
  async execute(action: PostSignupAction): Promise<void> {
    // Enable download functionality
    setDownloadMode(true);
  }
  
  canExecute(action: PostSignupAction, userTier: string): boolean {
    return userTier === 'pro';
  }
  
  getSuccessMessage(action: PostSignupAction): string {
    return "📥 Download your mixes and share them!";
  }
}
```

### 9.3 Session State Preservation

#### Demo Session State Management
```typescript
interface DemoSessionState {
  currentTrack: AudioAsset | null;
  playbackPosition: number;
  cuePoints: CuePoint[];
  loopRegions: LoopRegion[];
  mode: 'preview' | 'loop' | 'cue';
  volume: number;
  tempo: number;
  timestamp: number;
}

const DEMO_SESSION_KEY = 'demo_session_state';

class DemoSessionManager {
  private static instance: DemoSessionManager;
  
  private constructor() {}
  
  static getInstance(): DemoSessionManager {
    if (!DemoSessionManager.instance) {
      DemoSessionManager.instance = new DemoSessionManager();
    }
    return DemoSessionManager.instance;
  }
  
  saveDemoState(state: DemoSessionState): void {
    try {
      const sessionData = {
        ...state,
        timestamp: Date.now()
      };
      localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(sessionData));
    } catch (error) {
      console.error('Failed to save demo state:', error);
    }
  }
  
  getDemoState(): DemoSessionState | null {
    try {
      const stored = localStorage.getItem(DEMO_SESSION_KEY);
      if (!stored) return null;
      
      const state: DemoSessionState = JSON.parse(stored);
      
      // Check if state is still valid (within 1 hour)
      const now = Date.now();
      const oneHour = 60 * 60 * 1000;
      
      if (now - state.timestamp > oneHour) {
        this.clearDemoState();
        return null;
      }
      
      return state;
    } catch (error) {
      console.error('Failed to get demo state:', error);
      return null;
    }
  }
  
  clearDemoState(): void {
    try {
      localStorage.removeItem(DEMO_SESSION_KEY);
    } catch (error) {
      console.error('Failed to clear demo state:', error);
    }
  }
  
  restoreDemoState(): boolean {
    const state = this.getDemoState();
    if (!state) return false;
    
    try {
      // Restore track
      if (state.currentTrack) {
        loadTrack(state.currentTrack);
      }
      
      // Restore playback position
      if (state.playbackPosition) {
        setPlaybackPosition(state.playbackPosition);
      }
      
      // Restore mode
      if (state.mode) {
        setPlaybackMode(state.mode);
      }
      
      // Restore volume and tempo
      if (state.volume) {
        setVolume(state.volume);
      }
      if (state.tempo) {
        setTempo(state.tempo);
      }
      
      // Restore cue points and loops (read-only for guests)
      if (state.cuePoints) {
        setCuePoints(state.cuePoints);
      }
      if (state.loopRegions) {
        setLoopRegions(state.loopRegions);
      }
      
      return true;
    } catch (error) {
      console.error('Failed to restore demo state:', error);
      return false;
    }
  }
}
```

### 9.4 Post-Signup Flow Integration

#### Signup Success Handler
```typescript
interface SignupSuccessHandler {
  handleSignupSuccess(user: User, trigger?: string): Promise<void>;
  handleTierUpgrade(user: User, newTier: string): Promise<void>;
}

class PostSignupFlowHandler implements SignupSuccessHandler {
  async handleSignupSuccess(user: User, trigger?: string): Promise<void> {
    try {
      // Update user tier in intent cache
      IntentManagementService.getInstance().updateUserTier('free');
      
      // Execute pending actions
      await PostSignupActionService.getInstance().executePendingActions();
      
      // Restore demo session if available
      const demoManager = DemoSessionManager.getInstance();
      const restored = demoManager.restoreDemoState();
      
      if (restored) {
        showSuccessMessage("🎉 Welcome back! Your session has been restored.");
      } else {
        showSuccessMessage("🎉 Welcome to Audafact! Start creating your mixes.");
      }
      
      // Track signup completion
      const analytics = AnalyticsService.getInstance();
      analytics.track('signup_completed', {
        method: 'email',
        trigger,
        hasRestoredSession: restored,
        userTier: 'free'
      });
      
    } catch (error) {
      console.error('Failed to handle signup success:', error);
      showErrorMessage('Welcome! Some features may take a moment to activate.');
    }
  }
  
  async handleTierUpgrade(user: User, newTier: string): Promise<void> {
    try {
      // Update user tier in intent cache
      IntentManagementService.getInstance().updateUserTier(newTier);
      
      // Execute any pending pro-only actions
      await PostSignupActionService.getInstance().executePendingActions();
      
      // Show upgrade success message
      const messages = {
        pro: "🚀 Welcome to Pro Creator! You now have access to all features.",
        free: "Your subscription has been updated."
      };
      
      showSuccessMessage(messages[newTier as keyof typeof messages] || "Subscription updated!");
      
      // Track upgrade
      const analytics = AnalyticsService.getInstance();
      analytics.track('tier_upgraded', {
        newTier,
        previousTier: 'free',
        timestamp: Date.now()
      });
      
    } catch (error) {
      console.error('Failed to handle tier upgrade:', error);
      showErrorMessage('Upgrade processed! Some features may take a moment to activate.');
    }
  }
}
```

---

## 🎨 UI/UX Requirements

### Success Message System

#### Message Configuration
```typescript
interface SuccessMessage {
  id: string;
  title: string;
  message: string;
  icon: string;
  duration: number;
  actions?: SuccessMessageAction[];
}

interface SuccessMessageAction {
  label: string;
  action: () => void;
  variant: 'primary' | 'secondary';
}

const SUCCESS_MESSAGES: Record<string, SuccessMessage> = {
  signup_completed: {
    id: 'signup_completed',
    title: 'Welcome to Audafact!',
    message: 'Your account has been created successfully.',
    icon: '🎉',
    duration: 5000,
    actions: [
      {
        label: 'Start Creating',
        action: () => setSidePanelMode('upload'),
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
        action: () => showProFeaturesTour(),
        variant: 'primary'
      }
    ]
  }
};
```

#### Success Message Component
```typescript
interface SuccessMessageProps {
  message: SuccessMessage;
  onClose: () => void;
}

const SuccessMessage: React.FC<SuccessMessageProps> = ({ message, onClose }) => {
  const [isVisible, setIsVisible] = useState(true);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300); // Allow animation to complete
    }, message.duration);
    
    return () => clearTimeout(timer);
  }, [message.duration, onClose]);
  
  return (
    <div className={`success-message ${isVisible ? 'visible' : 'hidden'}`}>
      <div className="success-content">
        <div className="success-icon">{message.icon}</div>
        <div className="success-text">
          <h4>{message.title}</h4>
          <p>{message.message}</p>
        </div>
        <button className="close-button" onClick={onClose}>
          ✕
        </button>
      </div>
      
      {message.actions && (
        <div className="success-actions">
          {message.actions.map((action, index) => (
            <button
              key={index}
              className={`action-button ${action.variant}`}
              onClick={action.action}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
```

### Success Message Styling
```css
.success-message {
  position: fixed;
  top: 20px;
  right: 20px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
  padding: 16px;
  max-width: 400px;
  z-index: 1000;
  transform: translateX(100%);
  transition: transform 0.3s ease;
}

.success-message.visible {
  transform: translateX(0);
}

.success-message.hidden {
  transform: translateX(100%);
}

.success-content {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.success-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.success-text h4 {
  margin: 0 0 4px 0;
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
}

.success-text p {
  margin: 0;
  font-size: 14px;
  color: #6b7280;
  line-height: 1.4;
}

.close-button {
  background: none;
  border: none;
  font-size: 16px;
  color: #9ca3af;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: color 0.2s;
}

.close-button:hover {
  color: #6b7280;
}

.success-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #f3f4f6;
}

.action-button {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.action-button.primary {
  background: #3b82f6;
  color: white;
}

.action-button.primary:hover {
  background: #2563eb;
}

.action-button.secondary {
  background: #f3f4f6;
  color: #374151;
}

.action-button.secondary:hover {
  background: #e5e7eb;
}

@media (max-width: 768px) {
  .success-message {
    top: 10px;
    right: 10px;
    left: 10px;
    max-width: none;
  }
}
```

---

## 🔧 Implementation Details

### Integration with Existing Components

#### Enhanced Signup Modal
```typescript
const EnhancedSignupModal: React.FC<SignupModalProps> = ({
  isOpen,
  onClose,
  trigger,
  redirectAction
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const { user, error } = await supabase.auth.signUp({
        email,
        password
      });
      
      if (error) throw error;
      
      // Cache the intent if there's a trigger
      if (trigger) {
        const intentService = IntentManagementService.getInstance();
        intentService.cacheIntent({
          id: `intent_${Date.now()}`,
          type: trigger as any,
          timestamp: Date.now(),
          context: {},
          priority: 'high',
          expiresAt: Date.now() + (INTENT_EXPIRY_HOURS * 60 * 60 * 1000)
        });
      }
      
      // Handle signup success
      const handler = new PostSignupFlowHandler();
      await handler.handleSignupSuccess(user, trigger);
      
      onClose();
      
    } catch (error) {
      console.error('Signup error:', error);
      showErrorMessage('Failed to create account. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      {/* Existing modal content */}
    </Modal>
  );
};
```

#### Enhanced Auth Context
```typescript
const EnhancedAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user);
          
          // Handle post-signup flow
          const handler = new PostSignupFlowHandler();
          await handler.handleSignupSuccess(session.user);
          
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          
          // Clear intent cache on signout
          IntentManagementService.getInstance().clearIntentCache();
          
        } else if (event === 'USER_UPDATED' && session?.user) {
          setUser(session.user);
          
          // Handle tier changes
          if (session.user.user_metadata?.tier_changed) {
            const handler = new PostSignupFlowHandler();
            await handler.handleTierUpgrade(session.user, session.user.user_metadata.new_tier);
          }
        }
        
        setLoading(false);
      }
    );
    
    return () => subscription.unsubscribe();
  }, []);
  
  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
```

### Demo State Integration

#### Enhanced Studio Component
```typescript
const EnhancedStudio: React.FC = () => {
  const { user } = useAuth();
  const { tier } = useUserTier();
  const demoManager = DemoSessionManager.getInstance();
  
  useEffect(() => {
    // If user just signed up, try to restore demo state
    if (user && tier.id === 'free') {
      const restored = demoManager.restoreDemoState();
      if (restored) {
        showSuccessMessage(SUCCESS_MESSAGES.session_restored);
      }
    }
  }, [user, tier.id]);
  
  // Save demo state periodically for guests
  useEffect(() => {
    if (tier.id === 'guest') {
      const interval = setInterval(() => {
        const currentState = getCurrentSessionState();
        demoManager.saveDemoState(currentState);
      }, 30000); // Save every 30 seconds
      
      return () => clearInterval(interval);
    }
  }, [tier.id]);
  
  return (
    <div className="studio">
      {/* Existing studio content */}
    </div>
  );
};

const getCurrentSessionState = (): DemoSessionState => {
  return {
    currentTrack: getCurrentTrack(),
    playbackPosition: getPlaybackPosition(),
    cuePoints: getCuePoints(),
    loopRegions: getLoopRegions(),
    mode: getPlaybackMode(),
    volume: getVolume(),
    tempo: getTempo(),
    timestamp: Date.now()
  };
};
```

---

## 🧪 Testing Requirements

### Intent Caching Tests
```typescript
describe('Intent Management', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  
  it('should cache and retrieve intents', () => {
    const intentService = IntentManagementService.getInstance();
    
    const action: PostSignupAction = {
      id: 'test_action',
      type: 'upload',
      timestamp: Date.now(),
      context: {},
      priority: 'high'
    };
    
    intentService.cacheIntent(action);
    
    const cache = intentService.getIntentCache();
    expect(cache.actions).toHaveLength(1);
    expect(cache.actions[0].id).toBe('test_action');
  });
  
  it('should clean expired intents', () => {
    const intentService = IntentManagementService.getInstance();
    
    const expiredAction: PostSignupAction = {
      id: 'expired_action',
      type: 'upload',
      timestamp: Date.now() - (25 * 60 * 60 * 1000), // 25 hours ago
      context: {},
      priority: 'high',
      expiresAt: Date.now() - (60 * 60 * 1000) // 1 hour ago
    };
    
    intentService.cacheIntent(expiredAction);
    
    const cache = intentService.getIntentCache();
    expect(cache.actions).toHaveLength(0);
  });
});
```

### Post-Signup Flow Tests
```typescript
describe('Post-Signup Flow', () => {
  it('should execute pending actions after signup', async () => {
    const intentService = IntentManagementService.getInstance();
    const actionService = PostSignupActionService.getInstance();
    
    // Cache an intent
    intentService.cacheIntent({
      id: 'test_upload',
      type: 'upload',
      timestamp: Date.now(),
      context: {},
      priority: 'high'
    });
    
    // Mock user signup
    const user = { id: 'test_user', subscription_tier: 'free' };
    const handler = new PostSignupFlowHandler();
    
    await handler.handleSignupSuccess(user, 'upload');
    
    // Verify action was executed
    const cache = intentService.getIntentCache();
    expect(cache.actions).toHaveLength(0); // Should be cleared after execution
  });
});
```

### Demo State Tests
```typescript
describe('Demo Session Management', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  
  it('should save and restore demo state', () => {
    const demoManager = DemoSessionManager.getInstance();
    
    const state: DemoSessionState = {
      currentTrack: { id: 'test_track', name: 'Test Track' },
      playbackPosition: 30,
      cuePoints: [],
      loopRegions: [],
      mode: 'preview',
      volume: 0.8,
      tempo: 120,
      timestamp: Date.now()
    };
    
    demoManager.saveDemoState(state);
    
    const restored = demoManager.getDemoState();
    expect(restored).toEqual(state);
  });
  
  it('should clear expired demo state', () => {
    const demoManager = DemoSessionManager.getInstance();
    
    const oldState: DemoSessionState = {
      currentTrack: null,
      playbackPosition: 0,
      cuePoints: [],
      loopRegions: [],
      mode: 'preview',
      volume: 1,
      tempo: 120,
      timestamp: Date.now() - (2 * 60 * 60 * 1000) // 2 hours ago
    };
    
    demoManager.saveDemoState(oldState);
    
    const restored = demoManager.getDemoState();
    expect(restored).toBeNull();
  });
});
```

---

## 📊 Analytics Events

### Post-Signup Events
```typescript
interface PostSignupEvents {
  'intent_cached': { actionType: string; priority: string; userTier: string };
  'intent_executed': { actionType: string; success: boolean; userTier: string };
  'demo_state_saved': { hasTrack: boolean; hasCues: boolean; sessionDuration: number };
  'demo_state_restored': { success: boolean; stateAge: number };
  'tier_upgraded': { newTier: string; previousTier: string; trigger: string };
  'post_signup_flow_completed': { 
    actionsExecuted: number; 
    sessionRestored: boolean; 
    totalTime: number 
  };
}

const trackPostSignupEvent = (event: keyof PostSignupEvents, properties: any) => {
  const analytics = AnalyticsService.getInstance();
  analytics.track(event, {
    ...properties,
    timestamp: Date.now(),
    sessionId: analytics.getSessionId()
  });
};
```

---

## 🚀 Success Criteria

- [ ] User intent is preserved through signup flow
- [ ] Post-signup actions execute automatically
- [ ] Demo session state is restored for returning users
- [ ] Tier changes trigger appropriate UI updates
- [ ] Success messages provide clear feedback
- [ ] Intent cache expires appropriately
- [ ] Failed actions are handled gracefully
- [ ] Session state is saved periodically for guests
- [ ] Analytics track post-signup behavior
- [ ] Performance impact is minimal

---

## 🔄 Dependencies & Integration

### Input Dependencies
- PRD 1: Demo Mode Foundation (for session state management)
- PRD 2: Feature Gating Architecture (for tier-based access)
- PRD 3: Signup Flow & Modal Triggers (for signup integration)
- PRD 5: Upload/Save/Record/Download Gate (for action execution)

### Output Dependencies
- PRD 10: Performance & Error Monitoring (for flow monitoring)

### Integration Points
- Authentication system for user state changes
- Feature gate system for tier-based access control
- Signup modal for intent caching
- Studio component for session state management
- Analytics system for flow tracking
- Local storage for state persistence
- Success message system for user feedback 