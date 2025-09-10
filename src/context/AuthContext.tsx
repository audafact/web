import { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import { authService, AuthResponse } from '../auth/authService';
import { analytics } from '../services/analyticsService';
import { IntentManagementService } from '../services/intentManagementService';
import { PostSignupFlowHandler } from '../services/postSignupFlowHandler';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string, captchaToken?: string) => Promise<AuthResponse>;
  signIn: (email: string, password: string) => Promise<AuthResponse>;
  signInWithGoogle: () => Promise<AuthResponse>;
  signOut: () => Promise<AuthResponse>;
  resetPassword: (email: string) => Promise<AuthResponse>;
  updatePassword: (password: string) => Promise<AuthResponse>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signUp: async () => ({ success: false, error: 'Context not initialized' }),
  signIn: async () => ({ success: false, error: 'Context not initialized' }),
  signInWithGoogle: async () => ({ success: false, error: 'Context not initialized' }),
  signOut: async () => ({ success: false, error: 'Context not initialized' }),
  resetPassword: async () => ({ success: false, error: 'Context not initialized' }),
  updatePassword: async () => ({ success: false, error: 'Context not initialized' }),
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
      
      // Set analytics user
      if (session?.user) {
        // Get user tier from metadata or default to free
        const userTier = session.user.user_metadata?.tier || 'free';
        analytics.setUser(session.user.id, userTier);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null);
      
      // Update analytics user
      if (session?.user) {
        // Get user tier from metadata or default to free
        const userTier = session.user.user_metadata?.tier || 'free';
        analytics.setUser(session.user.id, userTier);
        
        // Handle post-signup flow for new signups
        if (event === 'SIGNED_IN') {
          const handler = new PostSignupFlowHandler();
          await handler.handleSignupSuccess(session.user);
        }
        
        // Handle tier changes
        if (event === 'USER_UPDATED' && session.user.user_metadata?.tier_changed) {
          const handler = new PostSignupFlowHandler();
          await handler.handleTierUpgrade(session.user, session.user.user_metadata.new_tier);
        }
      } else {
        analytics.setUser('', 'guest');
        
        // Clear intent cache on signout
        if (event === 'SIGNED_OUT') {
          IntentManagementService.getInstance().clearIntentCache();
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, captchaToken?: string): Promise<AuthResponse> => {
    return await authService.signUp(email, password, captchaToken);
  };

  const signIn = async (email: string, password: string, captchaToken?: string): Promise<AuthResponse> => {
    return await authService.signIn(email, password, captchaToken);
  };

  const signOut = async (): Promise<AuthResponse> => {
    const result = await authService.signOut();
    if (result.success) {
      setUser(null);
      window.location.href = '/';
    }
    return result;
  };

  const resetPassword = async (email: string, captchaToken?: string): Promise<AuthResponse> => {
    return await authService.resetPassword(email, captchaToken);
  };

  const updatePassword = async (password: string): Promise<AuthResponse> => {
    return await authService.updatePassword(password);
  };

  const signInWithGoogle = async (): Promise<AuthResponse> => {
    return await authService.signInWithGoogle();
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      signUp, 
      signIn, 
      signInWithGoogle,
      signOut, 
      resetPassword, 
      updatePassword 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext); 