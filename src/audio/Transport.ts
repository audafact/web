/**
 * Transport - Master Clock for Audio Sequencing
 *
 * Provides a centralized timing system that coordinates all audio playback.
 * Converts between musical time (beats/measures) and audio time (seconds).
 */

import { TimeSignature } from "../types/music";
import { TransportState, TransportConfig } from "../types/sequence";
import { LookaheadScheduler } from "./Scheduler";

export type TransportCallback = (beat: number) => void;

export class Transport {
  private audioContext: AudioContext;
  private state: TransportState = "stopped";
  private currentBeat: number = 0;
  private tempo: number; // BPM
  private timeSignature: TimeSignature;
  private scheduler: LookaheadScheduler;

  // Timing references
  private startTime: number = 0; // AudioContext.currentTime when transport started
  private pausedAtBeat: number = 0; // Beat position when paused

  // Event callbacks
  private beatCallbacks: TransportCallback[] = [];
  private measureCallbacks: TransportCallback[] = [];

  // Configuration
  private config: TransportConfig;

  constructor(audioContext: AudioContext, config?: Partial<TransportConfig>) {
    this.audioContext = audioContext;
    this.tempo = config?.tempo || 120;
    this.timeSignature = config?.timeSignature || {
      numerator: 4,
      denominator: 4,
    };

    this.config = {
      tempo: this.tempo,
      timeSignature: this.timeSignature,
      lookahead: config?.lookahead || 0.1,
      scheduleInterval: config?.scheduleInterval || 25,
    };

    // Initialize scheduler
    this.scheduler = new LookaheadScheduler(
      audioContext,
      this.tempo,
      this.config.lookahead,
      this.config.scheduleInterval
    );
  }

  /**
   * Start the transport
   */
  start(): void {
    if (this.state === "playing") {
      return; // Already playing
    }

    if (this.state === "paused") {
      // Resume from paused position
      this.startTime = this.audioContext.currentTime;
      this.scheduler.start(this.pausedAtBeat);
    } else {
      // Start from current beat position
      this.startTime = this.audioContext.currentTime;
      this.scheduler.start(this.currentBeat);
    }

    this.state = "playing";
    this.startBeatCallbacks();
  }

  /**
   * Stop the transport
   */
  stop(): void {
    this.state = "stopped";
    this.scheduler.stop();
    this.stopBeatCallbacks();
    this.currentBeat = 0;
    this.pausedAtBeat = 0;
  }

  /**
   * Pause the transport
   */
  pause(): void {
    if (this.state !== "playing") {
      return;
    }

    this.state = "paused";
    this.pausedAtBeat = this.getCurrentBeat();
    this.scheduler.stop();
    this.stopBeatCallbacks();
  }

  /**
   * Seek to a specific beat position
   */
  seek(beat: number): void {
    const wasPlaying = this.state === "playing";

    if (wasPlaying) {
      this.pause();
    }

    this.currentBeat = Math.max(0, beat);
    this.pausedAtBeat = this.currentBeat;

    if (wasPlaying) {
      this.startTime = this.audioContext.currentTime;
      this.scheduler.start(this.currentBeat);
      this.state = "playing";
      this.startBeatCallbacks();
    }
  }

  /**
   * Get current beat position
   */
  getCurrentBeat(): number {
    if (this.state === "stopped") {
      return this.currentBeat;
    }

    if (this.state === "paused") {
      return this.pausedAtBeat;
    }

    // Calculate current beat based on elapsed time
    const currentTime = this.audioContext.currentTime;
    const elapsedTime = currentTime - this.startTime;
    const elapsedBeats = this.timeToBeat(elapsedTime);
    return this.pausedAtBeat + elapsedBeats;
  }

  /**
   * Get current measure number (1-based)
   */
  getCurrentMeasure(): number {
    const beatsPerMeasure = this.timeSignature.numerator;
    return Math.floor(this.getCurrentBeat() / beatsPerMeasure) + 1;
  }

  /**
   * Get beat position within current measure (0-based)
   */
  getBeatInMeasure(): number {
    const beatsPerMeasure = this.timeSignature.numerator;
    return this.getCurrentBeat() % beatsPerMeasure;
  }

  /**
   * Convert beats to seconds based on current tempo
   */
  beatToTime(beats: number): number {
    const secondsPerBeat = 60 / this.tempo;
    return beats * secondsPerBeat;
  }

  /**
   * Convert seconds to beats based on current tempo
   */
  timeToBeat(seconds: number): number {
    const beatsPerSecond = this.tempo / 60;
    return seconds * beatsPerSecond;
  }

  /**
   * Get the time (AudioContext.currentTime) for a specific beat position
   */
  getTimeForBeat(beat: number): number {
    if (this.state === "stopped") {
      return this.audioContext.currentTime;
    }

    const beatDelta = beat - this.pausedAtBeat;
    const timeDelta = this.beatToTime(beatDelta);
    return this.startTime + timeDelta;
  }

  /**
   * Get the next beat position (for quantization)
   */
  getNextBeat(quantizeTo: number = 1): number {
    const current = this.getCurrentBeat();
    return Math.ceil(current / quantizeTo) * quantizeTo;
  }

  /**
   * Get the previous beat position (for quantization)
   */
  getPreviousBeat(quantizeTo: number = 1): number {
    const current = this.getCurrentBeat();
    return Math.floor(current / quantizeTo) * quantizeTo;
  }

  /**
   * Schedule an event at a specific beat
   */
  scheduleAt(beat: number, callback: () => void): string {
    return this.scheduler.scheduleAt(beat, callback);
  }

  /**
   * Schedule an event relative to current beat
   */
  scheduleRelative(deltaBeats: number, callback: () => void): string {
    return this.scheduler.scheduleRelative(deltaBeats, callback);
  }

  /**
   * Cancel a scheduled event
   */
  cancel(eventId: string): void {
    this.scheduler.cancel(eventId);
  }

  /**
   * Set tempo (BPM)
   */
  setTempo(tempo: number): void {
    if (tempo <= 0) {
      console.warn("Tempo must be greater than 0");
      return;
    }

    const wasPlaying = this.state === "playing";
    const currentBeat = this.getCurrentBeat();

    if (wasPlaying) {
      this.pause();
    }

    this.tempo = tempo;
    this.config.tempo = tempo;
    this.scheduler.setTempo(tempo);

    if (wasPlaying) {
      this.seek(currentBeat);
      this.start();
    }
  }

  /**
   * Set time signature
   */
  setTimeSignature(timeSignature: TimeSignature): void {
    this.timeSignature = timeSignature;
    this.config.timeSignature = timeSignature;
  }

  /**
   * Get current tempo
   */
  getTempo(): number {
    return this.tempo;
  }

  /**
   * Get current time signature
   */
  getTimeSignature(): TimeSignature {
    return { ...this.timeSignature };
  }

  /**
   * Get current state
   */
  getState(): TransportState {
    return this.state;
  }

  /**
   * Register callback for beat events
   */
  onBeat(callback: TransportCallback): () => void {
    this.beatCallbacks.push(callback);
    return () => {
      const index = this.beatCallbacks.indexOf(callback);
      if (index > -1) {
        this.beatCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Register callback for measure events
   */
  onMeasure(callback: TransportCallback): () => void {
    this.measureCallbacks.push(callback);
    return () => {
      const index = this.measureCallbacks.indexOf(callback);
      if (index > -1) {
        this.measureCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Start beat callbacks (called when transport starts)
   */
  private startBeatCallbacks(): void {
    const beatsPerMeasure = this.timeSignature.numerator;
    let lastBeat = Math.floor(this.getCurrentBeat());
    let lastMeasure = Math.floor(lastBeat / beatsPerMeasure);

    const checkBeats = () => {
      if (this.state !== "playing") {
        return;
      }

      const currentBeat = this.getCurrentBeat();
      const currentBeatFloor = Math.floor(currentBeat);
      const currentMeasure = Math.floor(currentBeatFloor / beatsPerMeasure);

      // Trigger beat callbacks
      if (currentBeatFloor > lastBeat) {
        for (let beat = lastBeat + 1; beat <= currentBeatFloor; beat++) {
          this.beatCallbacks.forEach((cb) => cb(beat));
        }
        lastBeat = currentBeatFloor;
      }

      // Trigger measure callbacks
      if (currentMeasure > lastMeasure) {
        this.measureCallbacks.forEach((cb) => cb(currentMeasure + 1));
        lastMeasure = currentMeasure;
      }

      requestAnimationFrame(checkBeats);
    };

    requestAnimationFrame(checkBeats);
  }

  /**
   * Stop beat callbacks (called when transport stops/pauses)
   */
  private stopBeatCallbacks(): void {
    // Callbacks are stopped by checking state in startBeatCallbacks
    // No explicit cleanup needed since requestAnimationFrame stops naturally
  }

  /**
   * Clear all scheduled events
   */
  clear(): void {
    this.scheduler.clear();
  }

  /**
   * Destroy the transport (cleanup)
   */
  destroy(): void {
    this.stop();
    this.beatCallbacks = [];
    this.measureCallbacks = [];
    this.scheduler.clear();
  }
}
