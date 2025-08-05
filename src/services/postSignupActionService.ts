import { PostSignupAction, ActionExecutor, INTENT_CACHE_KEY } from '../types/postSignup';
import { IntentManagementService } from './intentManagementService';
import { analytics } from './analyticsService';

// Action Executor Implementations
class UploadActionExecutor implements ActionExecutor {
  async execute(action: PostSignupAction): Promise<void> {
    // Trigger upload panel
    this.setSidePanelMode('upload');
    
    // If there's file context, pre-populate
    if (action.context.file) {
      // Handle file upload logic
      console.log('Handling file upload with context:', action.context.file);
    }
  }
  
  canExecute(action: PostSignupAction, userTier: string): boolean {
    return userTier !== 'guest';
  }
  
  getSuccessMessage(action: PostSignupAction): string {
    return "🎉 Welcome! You can now upload your own tracks.";
  }
  
  private setSidePanelMode(mode: string): void {
    // TODO: Integrate with actual side panel system
    console.log('Setting side panel mode:', mode);
  }
}

class SaveSessionActionExecutor implements ActionExecutor {
  async execute(action: PostSignupAction): Promise<void> {
    // Trigger save session flow
    await this.handleSaveSession();
  }
  
  canExecute(action: PostSignupAction, userTier: string): boolean {
    return userTier !== 'guest';
  }
  
  getSuccessMessage(action: PostSignupAction): string {
    return "💾 Session saved! You can now save unlimited sessions.";
  }
  
  private async handleSaveSession(): Promise<void> {
    // TODO: Integrate with actual save session system
    console.log('Handling save session');
  }
}

class AddLibraryTrackActionExecutor implements ActionExecutor {
  async execute(action: PostSignupAction): Promise<void> {
    // Switch to library panel
    this.setSidePanelMode('library');
    
    // If specific track context, highlight it
    if (action.context.trackId) {
      // Highlight the specific track
      console.log('Highlighting track:', action.context.trackId);
    }
  }
  
  canExecute(action: PostSignupAction, userTier: string): boolean {
    return userTier !== 'guest';
  }
  
  getSuccessMessage(action: PostSignupAction): string {
    return "🎵 Browse our full library and add tracks to your studio!";
  }
  
  private setSidePanelMode(mode: string): void {
    // TODO: Integrate with actual side panel system
    console.log('Setting side panel mode:', mode);
  }
}

class EditCuesActionExecutor implements ActionExecutor {
  async execute(action: PostSignupAction): Promise<void> {
    // Enable cue editing mode
    this.setCueEditingMode(true);
    
    // If specific cue context, focus on it
    if (action.context.cueIndex !== undefined) {
      // Focus on specific cue
      console.log('Focusing on cue index:', action.context.cueIndex);
    }
  }
  
  canExecute(action: PostSignupAction, userTier: string): boolean {
    return userTier !== 'guest';
  }
  
  getSuccessMessage(action: PostSignupAction): string {
    return "🎯 You can now customize cue points and loops!";
  }
  
  private setCueEditingMode(enabled: boolean): void {
    // TODO: Integrate with actual cue editing system
    console.log('Setting cue editing mode:', enabled);
  }
}

class RecordActionExecutor implements ActionExecutor {
  async execute(action: PostSignupAction): Promise<void> {
    // Show recording tutorial or enable recording
    this.setRecordingMode(true);
  }
  
  canExecute(action: PostSignupAction, userTier: string): boolean {
    return userTier === 'pro';
  }
  
  getSuccessMessage(action: PostSignupAction): string {
    return "🎙 Start recording your performances!";
  }
  
  private setRecordingMode(enabled: boolean): void {
    // TODO: Integrate with actual recording system
    console.log('Setting recording mode:', enabled);
  }
}

class DownloadActionExecutor implements ActionExecutor {
  async execute(action: PostSignupAction): Promise<void> {
    // Enable download functionality
    this.setDownloadMode(true);
  }
  
  canExecute(action: PostSignupAction, userTier: string): boolean {
    return userTier === 'pro';
  }
  
  getSuccessMessage(action: PostSignupAction): string {
    return "📥 Download your mixes and share them!";
  }
  
  private setDownloadMode(enabled: boolean): void {
    // TODO: Integrate with actual download system
    console.log('Setting download mode:', enabled);
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