/**
 * Transport Context - Provides transport system to React components
 * 
 * Creates and manages a single Transport instance shared across the app,
 * along with SequenceRecorder and SequencePlayer instances.
 */

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useAudioContext } from './AudioContext';
import { Transport } from '../audio/Transport';
import { SequenceRecorder } from '../audio/SequenceRecorder';
import { SequencePlayer } from '../audio/SequencePlayer';
import { TransportState, Sequence } from '../types/sequence';
import { TimeSignature } from '../types/music';

interface TransportContextValue {
  transport: Transport | null;
  recorder: SequenceRecorder | null;
  player: SequencePlayer | null;
  state: TransportState;
  currentBeat: number;
  tempo: number;
  timeSignature: TimeSignature;
  
  // Transport controls
  start: () => void;
  stop: () => void;
  pause: () => void;
  seek: (beat: number) => void;
  
  // Tempo/time signature
  setTempo: (tempo: number) => void;
  setTimeSignature: (timeSignature: TimeSignature) => void;
  
  // Recording
  startRecording: (name: string, tempo?: number, timeSignature?: TimeSignature) => void;
  stopRecording: () => Sequence | null;
  cancelRecording: () => void;
  isRecording: boolean;
  
  // Playback
  playSequence: (sequence: Sequence, startBeat?: number, loop?: boolean) => void;
  stopSequence: () => void;
  isPlayingSequence: boolean;
  setSequenceLoop: (loop: boolean) => void;
}

const TransportContextInstance = createContext<TransportContextValue | null>(null);

interface TransportProviderProps {
  children: React.ReactNode;
  initialTempo?: number;
  initialTimeSignature?: TimeSignature;
}

export const TransportProvider: React.FC<TransportProviderProps> = ({
  children,
  initialTempo = 120,
  initialTimeSignature = { numerator: 4, denominator: 4 },
}) => {
  const { audioContext } = useAudioContext();
  const transportRef = useRef<Transport | null>(null);
  const recorderRef = useRef<SequenceRecorder | null>(null);
  const playerRef = useRef<SequencePlayer | null>(null);
  
  const [state, setState] = useState<TransportState>('stopped');
  const [currentBeat, setCurrentBeat] = useState<number>(0);
  const [tempo, setTempoState] = useState<number>(initialTempo);
  const [timeSignature, setTimeSignatureState] = useState<TimeSignature>(initialTimeSignature);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isPlayingSequence, setIsPlayingSequence] = useState<boolean>(false);

  // Initialize transport when audio context is available
  useEffect(() => {
    if (!audioContext) {
      return;
    }

    // Create transport instance
    const transport = new Transport(audioContext, {
      tempo: initialTempo,
      timeSignature: initialTimeSignature,
    });

    // Create recorder and player
    const recorder = new SequenceRecorder(transport);
    const player = new SequencePlayer(transport);

    // Set up cue trigger callback for player
    player.setCueTriggerCallback((trackId, cueIndex, velocity) => {
      // This will be handled by components that use the transport
      // Components can listen to this via events or callbacks
      console.log('Cue trigger:', { trackId, cueIndex, velocity });
    });

    transportRef.current = transport;
    recorderRef.current = recorder;
    playerRef.current = player;

    // Update state when transport state changes
    const updateState = () => {
      if (transportRef.current) {
        setState(transportRef.current.getState());
        setCurrentBeat(transportRef.current.getCurrentBeat());
      }
    };

    // Poll for state updates (could be improved with events)
    const intervalId = setInterval(updateState, 50); // Update every 50ms

    return () => {
      clearInterval(intervalId);
      transport.destroy();
      transportRef.current = null;
      recorderRef.current = null;
      playerRef.current = null;
    };
  }, [audioContext, initialTempo, initialTimeSignature]);

  // Update current beat periodically
  useEffect(() => {
    if (state !== 'playing') {
      return;
    }

    const intervalId = setInterval(() => {
      if (transportRef.current) {
        setCurrentBeat(transportRef.current.getCurrentBeat());
      }
    }, 50); // Update every 50ms for smooth UI

    return () => clearInterval(intervalId);
  }, [state]);

  // Transport controls
  const start = useCallback(() => {
    transportRef.current?.start();
    setState('playing');
  }, []);

  const stop = useCallback(() => {
    transportRef.current?.stop();
    setState('stopped');
    setCurrentBeat(0);
    // Also stop sequence playback
    playerRef.current?.stop();
    setIsPlayingSequence(false);
  }, []);

  const pause = useCallback(() => {
    transportRef.current?.pause();
    setState('paused');
  }, []);

  const seek = useCallback((beat: number) => {
    transportRef.current?.seek(beat);
    setCurrentBeat(beat);
  }, []);

  // Tempo/time signature
  const setTempo = useCallback((newTempo: number) => {
    transportRef.current?.setTempo(newTempo);
    setTempoState(newTempo);
  }, []);

  const setTimeSignature = useCallback((newTimeSignature: TimeSignature) => {
    transportRef.current?.setTimeSignature(newTimeSignature);
    setTimeSignatureState(newTimeSignature);
  }, []);

  // Recording
  const startRecording = useCallback((name: string, tempo?: number, timeSignature?: TimeSignature) => {
    recorderRef.current?.startRecording(name, tempo, timeSignature);
    setIsRecording(true);
  }, []);

  const stopRecording = useCallback((): Sequence | null => {
    const sequence = recorderRef.current?.stopRecording() || null;
    setIsRecording(false);
    return sequence;
  }, []);

  const cancelRecording = useCallback(() => {
    recorderRef.current?.cancelRecording();
    setIsRecording(false);
  }, []);

  // Playback
  const playSequence = useCallback((sequence: Sequence, startBeat?: number, loop: boolean = false) => {
    playerRef.current?.play(sequence, startBeat, loop);
    setIsPlayingSequence(true);
  }, []);

  const stopSequence = useCallback(() => {
    playerRef.current?.stop();
    setIsPlayingSequence(false);
  }, []);

  const setSequenceLoop = useCallback((loop: boolean) => {
    playerRef.current?.setLoop(loop);
  }, []);

  const value: TransportContextValue = {
    transport: transportRef.current,
    recorder: recorderRef.current,
    player: playerRef.current,
    state,
    currentBeat,
    tempo,
    timeSignature,
    start,
    stop,
    pause,
    seek,
    setTempo,
    setTimeSignature,
    startRecording,
    stopRecording,
    cancelRecording,
    isRecording,
    playSequence,
    stopSequence,
    isPlayingSequence,
    setSequenceLoop,
  };

  return (
    <TransportContextInstance.Provider value={value}>
      {children}
    </TransportContextInstance.Provider>
  );
};

export const useTransport = (): TransportContextValue => {
  const context = useContext(TransportContextInstance);
  if (!context) {
    throw new Error('useTransport must be used within a TransportProvider');
  }
  return context;
};

