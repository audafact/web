/**
 * Sequence Player - Plays back sequences synchronized to transport
 *
 * Schedules sequence events to trigger at the correct beat positions,
 * synchronized with the transport's master clock.
 */

import { Transport } from "./Transport";
import { Sequence, SequenceEvent } from "../types/sequence";

export type CueTriggerCallback = (
  trackId: string,
  cueIndex: number,
  velocity?: number
) => void;

export class SequencePlayer {
  private transport: Transport;
  private isPlaying: boolean = false;
  private currentSequence: Sequence | null = null;
  private scheduledEventIds: string[] = [];
  private startBeat: number = 0;
  private cueTriggerCallback: CueTriggerCallback | null = null;
  private loop: boolean = false;

  constructor(transport: Transport) {
    this.transport = transport;
  }

  /**
   * Set callback for cue triggers
   */
  setCueTriggerCallback(callback: CueTriggerCallback): void {
    this.cueTriggerCallback = callback;
  }

  /**
   * Play a sequence
   */
  play(sequence: Sequence, startBeat?: number, loop: boolean = false): void {
    if (this.isPlaying) {
      this.stop();
    }

    this.currentSequence = sequence;
    this.loop = loop;
    this.isPlaying = true;
    this.startBeat =
      startBeat !== undefined ? startBeat : this.transport.getCurrentBeat();

    // Schedule all events in the sequence
    this.scheduleSequenceEvents(sequence, this.startBeat);

    // If looping, schedule the next iteration
    if (loop) {
      this.scheduleLoop();
    }
  }

  /**
   * Stop playing the current sequence
   */
  stop(): void {
    if (!this.isPlaying) {
      return;
    }

    // Cancel all scheduled events
    this.scheduledEventIds.forEach((id) => {
      this.transport.cancel(id);
    });

    this.scheduledEventIds = [];
    this.isPlaying = false;
    this.currentSequence = null;
  }

  /**
   * Check if currently playing
   */
  isCurrentlyPlaying(): boolean {
    return this.isPlaying;
  }

  /**
   * Get current sequence being played
   */
  getCurrentSequence(): Sequence | null {
    return this.currentSequence;
  }

  /**
   * Schedule all events in a sequence
   */
  private scheduleSequenceEvents(sequence: Sequence, startBeat: number): void {
    sequence.events.forEach((event) => {
      const absoluteBeat = startBeat + event.beat;
      const eventId = this.transport.scheduleAt(absoluteBeat, () => {
        // Trigger the cue
        if (this.cueTriggerCallback) {
          this.cueTriggerCallback(
            event.trackId,
            event.cueIndex,
            event.velocity
          );
        }

        // Remove from scheduled events list
        const index = this.scheduledEventIds.indexOf(eventId);
        if (index > -1) {
          this.scheduledEventIds.splice(index, 1);
        }
      });

      this.scheduledEventIds.push(eventId);
    });
  }

  /**
   * Schedule the next loop iteration
   */
  private scheduleLoop(): void {
    if (!this.currentSequence || !this.loop) {
      return;
    }

    const loopEndBeat = this.startBeat + this.currentSequence.length;
    const loopEventId = this.transport.scheduleAt(loopEndBeat, () => {
      // Restart the sequence
      if (this.isPlaying && this.currentSequence) {
        this.startBeat = loopEndBeat;
        this.scheduleSequenceEvents(this.currentSequence, this.startBeat);
        this.scheduleLoop(); // Schedule next loop
      }
    });

    this.scheduledEventIds.push(loopEventId);
  }

  /**
   * Set loop mode
   */
  setLoop(loop: boolean): void {
    this.loop = loop;

    // If currently playing and loop changed, reschedule
    if (this.isPlaying && this.currentSequence) {
      const wasLooping =
        this.scheduledEventIds.length > this.currentSequence.events.length;

      if (loop && !wasLooping) {
        // Start looping
        this.scheduleLoop();
      } else if (!loop && wasLooping) {
        // Stop looping - cancel loop event
        // The loop event is the last one scheduled
        if (this.scheduledEventIds.length > 0) {
          const lastId =
            this.scheduledEventIds[this.scheduledEventIds.length - 1];
          this.transport.cancel(lastId);
          const index = this.scheduledEventIds.indexOf(lastId);
          if (index > -1) {
            this.scheduledEventIds.splice(index, 1);
          }
        }
      }
    }
  }

  /**
   * Get loop state
   */
  getLoop(): boolean {
    return this.loop;
  }
}
