import React, { createContext, useContext, useState, useCallback } from 'react';

interface AudioContextProviderProps {
  children: React.ReactNode;
}

interface AudioContextValue {
  audioContext: AudioContext | null;
  initializeAudio: () => Promise<AudioContext>;
  resumeAudioContext: () => Promise<void>;
}

const AudioContextInstance = createContext<AudioContextValue | null>(null);

export const AudioProvider: React.FC<AudioContextProviderProps> = ({ children }) => {
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);

  const initializeAudio = useCallback(async (): Promise<AudioContext> => {
    try {
      // Create a new context if one doesn't exist
      if (!audioContext) {
        // Create a new AudioContext with explicit options to ensure compatibility
        const newContext = new (window.AudioContext || (window as any).webkitAudioContext)({
          // Some browsers may require a sample rate to be specified
          sampleRate: 44100,
          // Start in a resumed state where possible
          latencyHint: 'interactive'
        });
        
        // If the state is suspended, we need to explicitly resume it
        if (newContext.state === 'suspended') {
          try {
            await newContext.resume();
          } catch (resumeError) {
            console.error('Failed to resume audio context:', resumeError);
            // Continue anyway - we'll try to handle it later
          }
        }
        
        setAudioContext(newContext);
        return newContext;
      }
      
      // If context exists but is suspended, resume it
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
      
      return audioContext;
    } catch (error) {
      console.error('Failed to initialize audio context:', error);
      throw error;
    }
  }, [audioContext]);
  
  const resumeAudioContext = useCallback(async (): Promise<void> => {
    try {
      if (audioContext && audioContext.state === 'suspended') {
        await audioContext.resume();
      }
    } catch (error) {
      console.error('Failed to resume audio context:', error);
      throw error;
    }
  }, [audioContext]);

  const value = {
    audioContext,
    initializeAudio,
    resumeAudioContext
  };

  return (
    <AudioContextInstance.Provider value={value}>
      {children}
    </AudioContextInstance.Provider>
  );
};

export const AudioContextProvider = AudioProvider;

export const useAudioContext = (): AudioContextValue => {
  const context = useContext(AudioContextInstance);
  if (!context) {
    throw new Error('useAudioContext must be used within an AudioProvider');
  }
  return context;
}; 