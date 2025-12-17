/**
 * Sequence Recorder - Captures cue triggers with precise timing
 *
 * Records user actions (cue triggers) and stores them as sequence events
 * with beat positions relative to the transport.
 */

import { Transport } from "./Transport";
import { Sequence, SequenceEvent } from "../types/sequence";
import { TimeSignature } from "../types/music";

export class SequenceRecorder {
  private transport: Transport;
  private isRecording: boolean = false;
  private sequence: Sequence | null = null;
  private events: SequenceEvent[] = [];
  private startBeat: number = 0;

  constructor(transport: Transport) {
    this.transport = transport;
  }

  /**
   * Start recording a new sequence
   */
  startRecording(
    name: string,
    tempo?: number,
    timeSignature?: TimeSignature
  ): void {
    if (this.isRecording) {
      console.warn("Already recording. Stop current recording first.");
      return;
    }

    this.isRecording = true;
    this.events = [];
    this.startBeat = this.transport.getCurrentBeat();

    const currentTempo = tempo || this.transport.getTempo();
    const currentTimeSignature =
      timeSignature || this.transport.getTimeSignature();

    this.sequence = {
      id: `seq-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      length: 0, // Will be updated when recording stops
      tempo: currentTempo,
      timeSignature: currentTimeSignature,
      events: [],
      createdAt: Date.now(),
    };
  }

  /**
   * Stop recording
   */
  stopRecording(): Sequence | null {
    if (!this.isRecording) {
      return null;
    }

    this.isRecording = false;

    if (!this.sequence) {
      return null;
    }

    // Calculate sequence length (end at last event + some padding)
    const lastEvent =
      this.events.length > 0
        ? Math.max(...this.events.map((e) => e.beat))
        : this.startBeat;

    // Add padding (e.g., 1 measure)
    const beatsPerMeasure = this.sequence.timeSignature.numerator;
    this.sequence.length = lastEvent + beatsPerMeasure;
    this.sequence.events = [...this.events];
    this.sequence.updatedAt = Date.now();

    const result = { ...this.sequence };

    // Reset for next recording
    this.sequence = null;
    this.events = [];

    return result;
  }

  /**
   * Record a cue trigger
   */
  recordCueTrigger(trackId: string, cueIndex: number, velocity?: number): void {
    if (!this.isRecording) {
      return; // Not recording, ignore
    }

    const currentBeat = this.transport.getCurrentBeat();
    const relativeBeat = currentBeat - this.startBeat;

    const event: SequenceEvent = {
      id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      trackId,
      cueIndex,
      beat: relativeBeat,
      velocity: velocity || 1.0,
    };

    this.events.push(event);
  }

  /**
   * Record a cue trigger with quantization
   */
  recordCueTriggerQuantized(
    trackId: string,
    cueIndex: number,
    quantizeTo: number = 1,
    velocity?: number
  ): void {
    if (!this.isRecording) {
      return;
    }

    // Quantize to nearest beat subdivision
    const currentBeat = this.transport.getCurrentBeat();
    const quantizedBeat = Math.round(currentBeat / quantizeTo) * quantizeTo;
    const relativeBeat = quantizedBeat - this.startBeat;

    const event: SequenceEvent = {
      id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      trackId,
      cueIndex,
      beat: relativeBeat,
      velocity: velocity || 1.0,
    };

    this.events.push(event);
  }

  /**
   * Check if currently recording
   */
  isCurrentlyRecording(): boolean {
    return this.isRecording;
  }

  /**
   * Get current recording sequence (for preview/debugging)
   */
  getCurrentSequence(): Sequence | null {
    if (!this.isRecording || !this.sequence) {
      return null;
    }

    return {
      ...this.sequence,
      events: [...this.events],
      length:
        this.events.length > 0
          ? Math.max(...this.events.map((e) => e.beat)) +
            this.sequence.timeSignature.numerator
          : 0,
    };
  }

  /**
   * Cancel current recording
   */
  cancelRecording(): void {
    this.isRecording = false;
    this.sequence = null;
    this.events = [];
  }

  /**
   * Get number of events recorded so far
   */
  getEventCount(): number {
    return this.events.length;
  }
}
