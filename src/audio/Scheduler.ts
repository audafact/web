/**
 * Lookahead Scheduler for precise audio event scheduling
 *
 * This scheduler uses Web Audio API's precise timing to schedule events
 * ahead of time, ensuring smooth playback without gaps or timing issues.
 */

import { ScheduledEvent, ScheduledCallback } from "../types/sequence";

export class LookaheadScheduler {
  private audioContext: AudioContext;
  private scheduledEvents: ScheduledEvent[] = [];
  private intervalId: number | null = null;
  private lookahead: number; // seconds
  private scheduleInterval: number; // milliseconds
  private currentBeat: number = 0;
  private tempo: number; // BPM
  private startTime: number = 0; // AudioContext.currentTime when started
  private beatStartTime: number = 0; // Beat position when started

  constructor(
    audioContext: AudioContext,
    tempo: number = 120,
    lookahead: number = 0.1,
    scheduleInterval: number = 25
  ) {
    this.audioContext = audioContext;
    this.tempo = tempo;
    this.lookahead = lookahead;
    this.scheduleInterval = scheduleInterval;
  }

  /**
   * Start the scheduler
   */
  start(currentBeat: number = 0): void {
    if (this.intervalId !== null) {
      return; // Already running
    }

    this.currentBeat = currentBeat;
    this.startTime = this.audioContext.currentTime;
    this.beatStartTime = currentBeat;

    // Start the scheduling loop
    this.intervalId = window.setInterval(() => {
      this.schedule();
    }, this.scheduleInterval);
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.scheduledEvents = [];
  }

  /**
   * Schedule an event at a specific beat position
   */
  scheduleAt(beat: number, callback: ScheduledCallback): string {
    const id = `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const event: ScheduledEvent = {
      id,
      beat,
      callback,
      cancelled: false,
    };

    this.scheduledEvents.push(event);
    // Sort by beat position for efficient processing
    this.scheduledEvents.sort((a, b) => a.beat - b.beat);

    return id;
  }

  /**
   * Schedule an event relative to current beat
   */
  scheduleRelative(deltaBeats: number, callback: ScheduledCallback): string {
    return this.scheduleAt(this.currentBeat + deltaBeats, callback);
  }

  /**
   * Cancel a scheduled event
   */
  cancel(eventId: string): void {
    const event = this.scheduledEvents.find((e) => e.id === eventId);
    if (event) {
      event.cancelled = true;
    }
  }

  /**
   * Update tempo (affects beat-to-time conversion)
   */
  setTempo(tempo: number): void {
    // Recalculate start time to maintain current beat position
    const currentTime = this.audioContext.currentTime;
    const elapsedBeats = this.beatToTime(
      this.currentBeat - this.beatStartTime,
      this.tempo
    );
    this.startTime = currentTime - elapsedBeats;
    this.tempo = tempo;
  }

  /**
   * Get current beat position
   */
  getCurrentBeat(): number {
    if (this.intervalId === null) {
      return this.currentBeat;
    }

    const currentTime = this.audioContext.currentTime;
    const elapsedTime = currentTime - this.startTime;
    const elapsedBeats = this.timeToBeat(elapsedTime, this.tempo);
    return this.beatStartTime + elapsedBeats;
  }

  /**
   * Convert beats to seconds based on tempo
   */
  beatToTime(beats: number, tempo?: number): number {
    const bpm = tempo || this.tempo;
    const secondsPerBeat = 60 / bpm;
    return beats * secondsPerBeat;
  }

  /**
   * Convert seconds to beats based on tempo
   */
  timeToBeat(seconds: number, tempo?: number): number {
    const bpm = tempo || this.tempo;
    const beatsPerSecond = bpm / 60;
    return seconds * beatsPerSecond;
  }

  /**
   * Main scheduling loop - checks for events that need to be triggered
   */
  private schedule(): void {
    if (this.intervalId === null) {
      return;
    }

    const currentTime = this.audioContext.currentTime;
    const currentBeat = this.getCurrentBeat();
    const lookaheadBeats = this.timeToBeat(this.lookahead, this.tempo);
    const scheduleUntilBeat = currentBeat + lookaheadBeats;

    // Process events that should trigger within the lookahead window
    const eventsToTrigger: ScheduledEvent[] = [];
    const remainingEvents: ScheduledEvent[] = [];

    for (const event of this.scheduledEvents) {
      if (event.cancelled) {
        continue; // Skip cancelled events
      }

      if (event.beat <= scheduleUntilBeat) {
        eventsToTrigger.push(event);
      } else {
        remainingEvents.push(event);
      }
    }

    // Trigger events
    for (const event of eventsToTrigger) {
      if (!event.cancelled) {
        try {
          // Calculate precise schedule time
          const beatDelta = event.beat - currentBeat;
          const timeDelta = this.beatToTime(beatDelta, this.tempo);
          const scheduleTime = currentTime + timeDelta;

          // Schedule callback at precise time
          if (scheduleTime <= currentTime + this.lookahead) {
            // Execute immediately if within lookahead, otherwise schedule
            if (scheduleTime <= currentTime) {
              event.callback();
            } else {
              // Use setTimeout for precise timing (Web Audio API handles audio scheduling)
              const delay = (scheduleTime - currentTime) * 1000;
              setTimeout(() => {
                if (!event.cancelled) {
                  event.callback();
                }
              }, Math.max(0, delay));
            }
          }
        } catch (error) {
          console.error("Error executing scheduled event:", error);
        }
      }
    }

    // Update scheduled events list
    this.scheduledEvents = remainingEvents;
  }

  /**
   * Clear all scheduled events
   */
  clear(): void {
    this.scheduledEvents = [];
  }

  /**
   * Get all scheduled events (for debugging)
   */
  getScheduledEvents(): ScheduledEvent[] {
    return [...this.scheduledEvents];
  }
}
