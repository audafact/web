# Session grid (multi-lane coherence)

## Model

- **One shared session timeline** for all lanes (timestamps in milliseconds).
- **Option A (no global event channel):** tempo and time signature changes are stored as **per-track** `performance_events` entries (`tempo_change`, `time_signature_change`) with optional `takeId`, same as other lane events.
- **Legacy rows** omit `takeId`; consumers treat missing `takeId` as `default` via `getEventTakeId`.

## Studio behavior

- While **recording with “Log events” enabled**, changing tempo or time signature in the track’s Time/Tempo section emits the corresponding grid events for that **track id**.
- Waveform measure grids can later align to a **session reference** (e.g. leader track or merged grid) by reading these events in timestamp order alongside cue/loop events.

## Defaults

- **Playback take** per lane: if not explicitly selected, the app picks the **latest take** (take whose **first** event has the greatest timestamp among takes on that lane). See `inferLatestTakeIdForTrack` in `web/src/lib/performanceTakeUtils.ts`.
