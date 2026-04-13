/**
 * Build-time feature exposure (Vite: prefix with VITE_).
 *
 * Set `VITE_EXPOSE_ADVANCED_PERFORMANCE_UI=true` in `.env` / staging to show
 * event logging toggles, lane arm/mute, loop replay, overdub, and per-track replay engagement.
 * Default is off so production builds stay mix-record-only with a simple Record control.
 */
const envTruthy = (v: string | undefined): boolean => v === 'true' || v === '1';

export const exposeAdvancedPerformanceUi = envTruthy(
  import.meta.env.VITE_EXPOSE_ADVANCED_PERFORMANCE_UI as string | undefined
);
