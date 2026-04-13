export type PerformanceEventType =
  | "cue_trigger"
  | "cue_release"
  | "loop_play"
  | "loop_stop"
  | "volume_change"
  | "speed_change"
  | "tempo_change"
  | "time_signature_change";

export interface BasePerformanceEvent {
  timestamp: number;
  trackId: string;
  /** Lane take stack id; omitted in legacy rows (treated as DEFAULT_TAKE_ID). */
  takeId?: string;
}

export interface CueTriggerEvent extends BasePerformanceEvent {
  type: "cue_trigger";
  data: {
    cueIndex: number;
    cueTime: number;
    mode: "preview" | "loop" | "cue";
    chopTriggerStyle?: "cue" | "hold" | "one-shot";
  };
}

/** End of Hold-style gate (keyup / pointer up); omit for Cue / One-Shot */
export interface CueReleaseEvent extends BasePerformanceEvent {
  type: "cue_release";
  data: {
    cueIndex: number;
    mode: "preview" | "loop" | "cue";
  };
}

export interface LoopPlayEvent extends BasePerformanceEvent {
  type: "loop_play";
  data: {
    mode: "loop";
    loopStart: number;
    loopEnd: number;
    currentTime: number;
  };
}

export interface LoopStopEvent extends BasePerformanceEvent {
  type: "loop_stop";
  data: {
    mode: "loop";
  };
}

export interface VolumeChangeEvent extends BasePerformanceEvent {
  type: "volume_change";
  data: {
    oldVolume: number;
    newVolume: number;
    mode: "preview" | "loop" | "cue";
  };
}

export interface SpeedChangeEvent extends BasePerformanceEvent {
  type: "speed_change";
  data: {
    oldSpeed: number;
    newSpeed: number;
    mode: "preview" | "loop" | "cue";
  };
}

/** Session grid: per-track tempo (Option A — no separate global event channel). */
export interface TempoChangeEvent extends BasePerformanceEvent {
  type: "tempo_change";
  data: {
    bpm: number;
    previousBpm?: number;
    mode: "preview" | "loop" | "cue";
  };
}

/** Session grid: per-track time signature. */
export interface TimeSignatureChangeEvent extends BasePerformanceEvent {
  type: "time_signature_change";
  data: {
    numerator: number;
    denominator: number;
    mode: "preview" | "loop" | "cue";
  };
}

export type PerformanceEvent =
  | CueTriggerEvent
  | CueReleaseEvent
  | LoopPlayEvent
  | LoopStopEvent
  | VolumeChangeEvent
  | SpeedChangeEvent
  | TempoChangeEvent
  | TimeSignatureChangeEvent;

export type NewPerformanceEvent = Omit<PerformanceEvent, "timestamp">;

export const PERFORMANCE_EVENT_SCHEMA_VERSION = 3;

/** Legacy / missing takeId on stored events maps to this. */
export const DEFAULT_TAKE_ID = "default";

export const isPerformanceEvent = (value: unknown): value is PerformanceEvent => {
  if (!value || typeof value !== "object") return false;
  const event = value as Partial<PerformanceEvent>;
  if (typeof event.timestamp !== "number") return false;
  if (typeof event.trackId !== "string" || !event.trackId) return false;
  if (typeof event.type !== "string") return false;
  if (!event.data || typeof event.data !== "object") return false;
  if ("takeId" in event && event.takeId !== undefined && typeof event.takeId !== "string") return false;
  return (
    event.type === "cue_trigger" ||
    event.type === "cue_release" ||
    event.type === "loop_play" ||
    event.type === "loop_stop" ||
    event.type === "volume_change" ||
    event.type === "speed_change" ||
    event.type === "tempo_change" ||
    event.type === "time_signature_change"
  );
};

export const parsePerformanceEvents = (value: unknown): PerformanceEvent[] => {
  if (!Array.isArray(value)) return [];
  return value.filter(isPerformanceEvent);
};

/** JSON-safe deep clone for PostgREST jsonb (strips non-serializable fields). */
export function clonePerformanceEventsForDb(events: PerformanceEvent[] | undefined): PerformanceEvent[] {
  if (!events?.length) return [];
  try {
    return JSON.parse(JSON.stringify(events)) as PerformanceEvent[];
  } catch {
    return [];
  }
}

export function getEventTakeId(event: PerformanceEvent): string {
  return event.takeId ?? DEFAULT_TAKE_ID;
}
