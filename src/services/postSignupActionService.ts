import { PostSignupAction, ActionExecutor, INTENT_CACHE_KEY } from '../types/postSignup';
import { IntentManagementService } from './intentManagementService';
import { analytics } from './analyticsService';

// Action Executor Implementations
class UploadActionExecutor implements ActionExecutor {
  async execute(_action: PostSignupAction): Promise<void> {
    // UI handoff is handled centrally via postSignupAction event.
  }
  
  canExecute(action: PostSignupAction, userTier: string): boolean {
    return userTier !== 'guest';
  }
  
  getSuccessMessage(action: PostSignupAction): string {
    return "🎉 Welcome! You can now upload your own tracks.";
  }
}

class SaveSessionActionExecutor implements ActionExecutor {
  async execute(_action: PostSignupAction): Promise<void> {
    // UI handoff is handled centrally via postSignupAction event.
  }
  
  canExecute(action: PostSignupAction, userTier: string): boolean {
    return userTier !== 'guest';
  }
  
  getSuccessMessage(action: PostSignupAction): string {
    return "💾 Session saved! You can now save unlimited sessions.";
  }
}

class AddLibraryTrackActionExecutor implements ActionExecutor {
  async execute(_action: PostSignupAction): Promise<void> {
    // UI handoff is handled centrally via postSignupAction event.
  }
  
  canExecute(action: PostSignupAction, userTier: string): boolean {
    return userTier !== 'guest';
  }
  
  getSuccessMessage(action: PostSignupAction): string {
    return "🎵 Browse available sounds and add tracks to your studio!";
  }
}

class AddSecondSourceExecutor implements ActionExecutor {
  async execute(_action: PostSignupAction): Promise<void> {
    // UI handoff is handled centrally via postSignupAction event.
  }

  canExecute(_action: PostSignupAction, userTier: string): boolean {
    return userTier !== 'guest';
  }

  getSuccessMessage(): string {
    return '🎵 You can add multiple tracks — use Add or drag from the library.';
  }
}

class EditCuesActionExecutor implements ActionExecutor {
  async execute(_action: PostSignupAction): Promise<void> {
    // UI handoff is handled centrally via postSignupAction event.
  }
  
  canExecute(action: PostSignupAction, userTier: string): boolean {
    return userTier !== 'guest';
  }
  
  getSuccessMessage(action: PostSignupAction): string {
    return "🎯 You can now customize cue points and loops!";
  }
}

class RecordActionExecutor implements ActionExecutor {
  async execute(_action: PostSignupAction): Promise<void> {
    // UI handoff is handled centrally via postSignupAction event.
  }
  
  canExecute(action: PostSignupAction, userTier: string): boolean {
    return userTier === 'pro';
  }
  
  getSuccessMessage(action: PostSignupAction): string {
    return "🎙 Start recording your performances!";
  }
}

class DownloadActionExecutor implements ActionExecutor {
  async execute(_action: PostSignupAction): Promise<void> {
    // UI handoff is handled centrally via postSignupAction event.
  }
  
  canExecute(action: PostSignupAction, userTier: string): boolean {
    return userTier === 'pro';
  }
  
  getSuccessMessage(action: PostSignupAction): string {
    return "📥 Download your mixes and share them!";
  }
}

// Global success message function - will be set by the component
let showSuccessMessage: (message: string) => void = (message: string) => {
  console.log('Success message:', message);
};

let showErrorMessage: (message: string) => void = (message: string) => {
  console.error('Error message:', message);
};

export class PostSignupActionService {
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
  
  // Set message functions from the component
  static setMessageFunctions(
    successFn: (message: string) => void,
    errorFn: (message: string) => void
  ) {
    showSuccessMessage = successFn;
    showErrorMessage = errorFn;
  }
  
  private registerExecutors(): void {
    this.executors.set('upload', new UploadActionExecutor());
    this.executors.set('save_session', new SaveSessionActionExecutor());
    this.executors.set('add_library_track', new AddLibraryTrackActionExecutor());
    this.executors.set('add_second_source', new AddSecondSourceExecutor());
    this.executors.set('edit_cues', new EditCuesActionExecutor());
    this.executors.set('record', new RecordActionExecutor());
    this.executors.set('download', new DownloadActionExecutor());
  }
  
  async executePendingActions(userTier: string = 'free'): Promise<void> {
    const intentCache = IntentManagementService.getInstance().getIntentCache();
    
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
          window.dispatchEvent(new CustomEvent('postSignupAction', { detail: { action: action.type } }));
          
          // Show success message
          const message = executor.getSuccessMessage(action);
          showSuccessMessage(message);
          
          // Track successful execution
          analytics.track('intent_executed', {
            actionType: action.type,
            success: true,
            userTier
          });
          
          // Remove executed action from cache
          this.removeActionFromCache(action.id);
        }
      } catch (error) {
        console.error(`Failed to execute action ${action.type}:`, error);
        showErrorMessage(`Failed to complete ${action.type} action`);
        
        // Track failed execution
        analytics.track('intent_executed', {
          actionType: action.type,
          success: false,
          userTier
        });
      }
    }
  }
  
  private removeActionFromCache(actionId: string): void {
    const intentCache = IntentManagementService.getInstance().getIntentCache();
    intentCache.actions = intentCache.actions.filter(a => a.id !== actionId);
    localStorage.setItem(INTENT_CACHE_KEY, JSON.stringify(intentCache));
  }
} 