import { supabase } from '../services/supabase';
import { User } from '@supabase/supabase-js';

export interface AuthResponse {
  success: boolean;
  user?: User;
  error?: string;
}

export const authService = {
  // Sign up with email and password
  async signUp(email: string, password: string): Promise<AuthResponse> {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        return {
          success: false,
          error: error.message,
        };
      }

      return {
        success: true,
        user: data.user || undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: 'An unexpected error occurred during sign up',
      };
    }
  },

  // Sign in with email and password
  async signIn(email: string, password: string): Promise<AuthResponse> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return {
          success: false,
          error: error.message,
        };
      }

      return {
        success: true,
        user: data.user || undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: 'An unexpected error occurred during sign in',
      };
    }
  },

  // Sign out
  async signOut(): Promise<AuthResponse> {
    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        return {
          success: false,
          error: error.message,
        };
      }

      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error: 'An unexpected error occurred during sign out',
      };
    }
  },

  // Reset password
  async resetPassword(email: string): Promise<AuthResponse> {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        return {
          success: false,
          error: error.message,
        };
      }

      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error: 'An unexpected error occurred during password reset',
      };
    }
  },

  // Update password
  async updatePassword(password: string): Promise<AuthResponse> {
    try {
      const { data, error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        return {
          success: false,
          error: error.message,
        };
      }

      return {
        success: true,
        user: data.user || undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: 'An unexpected error occurred while updating password',
      };
    }
  },

  // Get current session
  async getSession() {
    return await supabase.auth.getSession();
  },

  // Sign in with Google
  async signInWithGoogle(): Promise<AuthResponse> {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      });

      if (error) {
        return {
          success: false,
          error: error.message,
        };
      }

      // OAuth redirects to Google, so we return success to indicate the flow started
      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error: 'An unexpected error occurred during Google sign in',
      };
    }
  },
}; 