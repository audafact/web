# Advanced Performance Gating State

This document captures the current state of gating for the in-progress advanced performance feature set and provides a release checklist for enabling it safely.

## Flag Definition

- Source: `src/config/featureFlags.ts`
- Flag: `exposeAdvancedPerformanceUi`
- Env var: `VITE_EXPOSE_ADVANCED_PERFORMANCE_UI`
- Truthy values: `"true"` or `"1"`
- Default behavior: **off** (advanced UI hidden unless explicitly enabled at build time)

## What Is Gated Today (UI / Entry Points)

When `exposeAdvancedPerformanceUi` is false:

- `src/components/RecordingControls.tsx`
  - Advanced recording toggles are hidden (`Log events`, `Record mix`)
  - Record behavior falls back to simple defaults
  - Advanced status messaging is not shown
- `src/components/TrackControls.tsx`
  - Advanced track-level controls are hidden
- `src/components/SidePanel.tsx`
  - Advanced replay controls are hidden (`Loop Replay`, per-track engagement, `Overdub`)
  - Shared bundle `Auto Play` replay entry point is hidden
  - Main play control no longer enters event replay when flag is off

## What Is Not Fully Gated (Intentional for Now)

The expanded internals are present and compiled even when UI is gated:

- `src/context/RecordingContext.tsx` includes:
  - Expanded performance APIs/state (playback, engagement, overdub, mix/event options, lane/take logic)
  - Additional local persistence and event schema handling
- `src/views/Studio.tsx` includes wiring to expanded context APIs

This is currently a **dark-launch posture**: broad functionality exists in code, while user-facing access is feature-flagged.

## Recent Hardening (Merge + Audit)

During merge-conflict resolution and gating audit, the following gaps were closed:

- Prevented shared-bundle `Auto Play` from triggering advanced replay when flag is off
- Ensured SidePanel main play path does not activate event replay unless the advanced flag is on

## Release Checklist (When Ready to Launch)

1. Product decision
- Confirm release scope: full advanced replay + overdub + event controls, or phased release.

2. Flag rollout strategy
- Enable `VITE_EXPOSE_ADVANCED_PERFORMANCE_UI=true` first in non-prod environments.
- Keep production disabled until QA sign-off.
- Decide if launch is all-at-once or environment-by-environment.

3. QA coverage (required)
- Recording flows:
  - Mix-only recording
  - Events-only recording
  - Mix + events recording
- Replay flows:
  - Loop replay
  - Reference-only playback
  - Track engagement controls
  - Overdub behavior
- Regression checks:
  - Legacy/simple record flow with flag off
  - Save/export/download limits and access gating
  - Guest behavior and signup prompts

4. Observability + safety
- Monitor client errors around recording/playback actions.
- Watch for performance regressions (CPU/memory) during long replay loops.
- Keep a rollback path: set `VITE_EXPOSE_ADVANCED_PERFORMANCE_UI=false` and redeploy.

5. Cleanup after stable rollout (optional but recommended)
- Remove obsolete simple-path branches if no longer needed.
- Replace "advanced UI" naming with neutral naming once feature is standard.
- Update user-facing docs/help text to match released behavior.

## Developer Notes

- Because this is a Vite build-time env flag, changing it requires rebuilding/redeploying the frontend.
- If runtime toggling is needed later, migrate this to a runtime-config or remote flag system.
