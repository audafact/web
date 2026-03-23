/**
 * Type definitions for sequencing and synchronization features
 */

import { TimeSignature } from "./music";

/**
 * A sequence event represents a single cue trigger at a specific beat position
 */
export interface SequenceEvent {
  id: string;
  trackId: string;
  cueIndex: number;
  beat: number; // Beat position (0-based, musical time)
  duration?: number; // Optional: how long to play (in beats)
  velocity?: number; // Optional: volume/intensity (0-1)
}

/**
 * A sequence contains a series of events that can be played back
 */
export interface Sequence {
  id: string;
  name: string;
  length: number; // Total length in beats
  tempo: number; // BPM at sequence creation
  timeSignature: TimeSignature;
  events: SequenceEvent[];
  createdAt?: number; // Timestamp
  updatedAt?: number; // Timestamp
}

/**
 * Transport state for master clock
 */
export type TransportState = "stopped" | "playing" | "paused";

/**
 * Transport configuration
 */
export interface TransportConfig {
  tempo: number; // BPM
  timeSignature: TimeSignature;
  lookahead: number; // Lookahead time in seconds (default: 0.1)
  scheduleInterval: number; // Scheduler check interval in ms (default: 25)
}

/**
 * Scheduled event callback
 */
export type ScheduledCallback = () => void;

/**
 * Scheduled event with timing information
 */
export interface ScheduledEvent {
  id: string;
  beat: number;
  callback: ScheduledCallback;
  cancelled: boolean;
}
