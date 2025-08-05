import { SignupSuccessHandler } from '../types/postSignup';
import { IntentManagementService } from './intentManagementService';
import { PostSignupActionService } from './postSignupActionService';
import { DemoSessionManager } from './demoSessionManager';
import { analytics } from './analyticsService';

// Global message functions - will be set by the component
let showSuccessMessage: (message: string) => void = (message: string) => {
  console.log('Success message:', message);
};

let showErrorMessage: (message: string) => void = (message: string) => {
  console.error('Error message:', message);
};

export class PostSignupFlowHandler implements SignupSuccessHandler {
  // Set message functions from the component
  static setMessageFunctions(
    successFn: (message: string) => void,
    errorFn: (message: string) => void
  ) {
    showSuccessMessage = successFn;
    showErrorMessage = errorFn;
    
    // Also set for the action service
    PostSignupActionService.setMessageFunctions(successFn, errorFn);
  }
  
  async handleSignupSuccess(user: any, trigger?: string): Promise<void> {
    try {
      // Update user tier in intent cache
      IntentManagementService.getInstance().updateUserTier('free');
      
      // Execute pending actions
      await PostSignupActionService.getInstance().executePendingActions('free');
      
      // Restore demo session if available
      const demoManager = DemoSessionManager.getInstance();
      const restored = demoManager.restoreDemoState();
      
      if (restored) {
        showSuccessMessage("🎉 Welcome back! Your session has been restored.");
      } else {
        showSuccessMessage("🎉 Welcome to Audafact! Start creating your mixes.");
      }
      
      // Track signup completion
      analytics.track('signup_completed', {
        method: 'email',
        trigger,
        hasRestoredSession: restored,
        userTier: 'free'
      });
      
      // Track post-signup flow completion
      analytics.track('post_signup_flow_completed', {
        actionsExecuted: 1, // Will be updated based on actual actions
        sessionRestored: restored,
        totalTime: Date.now() // Will be calculated based on actual timing
      });
      
    } catch (error) {
      console.error('Failed to handle signup success:', error);
      showErrorMessage('Welcome! Some features may take a moment to activate.');
    }
  }
  
  async handleTierUpgrade(user: any, newTier: string): Promise<void> {
    try {
      // Update user tier in intent cache
      IntentManagementService.getInstance().updateUserTier(newTier);
      
      // Execute any pending pro-only actions
      await PostSignupActionService.getInstance().executePendingActions(newTier);
      
      // Show upgrade success message
      const messages = {
        pro: "🚀 Welcome to Pro Creator! You now have access to all features.",
        free: "Your subscription has been updated."
      };
      
      showSuccessMessage(messages[newTier as keyof typeof messages] || "Subscription updated!");
      
      // Track upgrade
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