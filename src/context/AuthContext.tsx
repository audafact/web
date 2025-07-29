import { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import { authService, AuthResponse } from '../auth/authService';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<AuthResponse>;
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
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string): Promise<AuthResponse> => {
    return await authService.signUp(email, password);
  };

  const signIn = async (email: string, password: string): Promise<AuthResponse> => {
    return await authService.signIn(email, password);
  };

  const signOut = async (): Promise<AuthResponse> => {
    const result = await authService.signOut();
    if (result.success) {
      setUser(null);
    }
    return result;
  };

  const resetPassword = async (email: string): Promise<AuthResponse> => {
    return await authService.resetPassword(email);
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