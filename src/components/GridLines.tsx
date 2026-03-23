import { useCallback, useMemo } from 'react';
import { TimeSignature } from '../types/music';

/** Zoom below this: show only bar lines */
const ZOOM_BARS_ONLY = 1.5;
/** Zoom above this: show all beats; between this and ZOOM_BARS_ONLY: bars + beats */
const ZOOM_BARS_AND_BEATS = 4;
const MAX_LINES = 500;

interface GridLinesProps {
  duration: number;
  tempo: number;
  zoomLevel: number;
  /** When provided, used for time-to-pixels (fixes alignment at 1x zoom). Falls back to 40 * zoomLevel. */
  pixelsPerSecond?: number;
  timeSignature: TimeSignature;
  firstMeasureTime: number;
  visible?: boolean;
  showMeasures?: boolean;
  /** When provided (non-empty), use these beat times for adaptive grid; otherwise use tempo-based grid */
  beats?: number[];
  /** When set, highlight the nearest beat line (e.g. during cue drag) */
  highlightTime?: number | null;
}

interface BeatLine {
  time: number;
  isBar: boolean;
  index: number;
}

const GridLines = ({
  duration,
  tempo,
  zoomLevel,
  pixelsPerSecond,
  timeSignature,
  firstMeasureTime,
  visible = true,
  showMeasures = false,
  beats: beatsProp,
  highlightTime
}: GridLinesProps) => {
  const beatDuration = useCallback(() => {
    const secondsPerBeat = 60 / tempo;
    const beatNoteValue = 4 / timeSignature.denominator;
    return secondsPerBeat * beatNoteValue;
  }, [tempo, timeSignature]);

  const measureDuration = useCallback(() => {
    const secondsPerBeat = 60 / tempo;
    const beatNoteValue = 4 / timeSignature.denominator;
    return timeSignature.numerator * secondsPerBeat * beatNoteValue;
  }, [tempo, timeSignature]);

  const timeToPixels = useCallback((time: number) => {
    const pxPerSec = pixelsPerSecond ?? 40 * zoomLevel;
    return time * pxPerSec;
  }, [zoomLevel, pixelsPerSecond]);

  // Adaptive mode: use detected beat times when available
  const useAdaptiveGrid = Array.isArray(beatsProp) && beatsProp.length > 0;

  const adaptiveBeatLines = useMemo((): BeatLine[] => {
    if (!useAdaptiveGrid || !beatsProp) return [];
    const numer = timeSignature.numerator;
    return beatsProp
      .filter((t) => t >= 0 && t <= duration)
      .map((time, index) => ({
        time,
        isBar: index % numer === 0,
        index
      }));
  }, [useAdaptiveGrid, beatsProp, duration, timeSignature.numerator]);

  const tempoBeatLines = useMemo((): BeatLine[] => {
    const beatDur = beatDuration();
    const measureDur = measureDuration();
    const lines: BeatLine[] = [];
    let currentTime = firstMeasureTime;
    let beatNumber = 0;
    while (currentTime <= duration) {
      for (let beatInMeasure = 0; beatInMeasure < timeSignature.numerator; beatInMeasure++) {
        const t = currentTime + beatInMeasure * beatDur;
        if (t <= duration) {
          lines.push({ time: t, isBar: beatInMeasure === 0, index: beatNumber });
          beatNumber++;
        }
      }
      currentTime += measureDur;
    }
    return lines;
  }, [duration, firstMeasureTime, beatDuration, measureDuration, timeSignature.numerator]);

  const beatLines = useAdaptiveGrid ? adaptiveBeatLines : tempoBeatLines;

  const zoomDensity = useMemo(() => {
    if (zoomLevel <= ZOOM_BARS_ONLY) return 'bars_only';
    if (zoomLevel < ZOOM_BARS_AND_BEATS) return 'bars_and_beats';
    return 'all';
  }, [zoomLevel]);

  const visibleLines = useMemo(() => {
    let list = beatLines;
    if (zoomDensity === 'bars_only') {
      list = list.filter((l) => l.isBar);
    }
    if (list.length > MAX_LINES) {
      list = list.slice(0, MAX_LINES);
    }
    return list;
  }, [beatLines, zoomDensity]);

  const nearestHighlightTime = useMemo(() => {
    if (highlightTime == null || visibleLines.length === 0) return null;
    let best = visibleLines[0];
    let bestDist = Math.abs(best.time - highlightTime);
    for (let i = 1; i < visibleLines.length; i++) {
      const d = Math.abs(visibleLines[i].time - highlightTime);
      if (d < bestDist) {
        bestDist = d;
        best = visibleLines[i];
      }
    }
    return best.time;
  }, [highlightTime, visibleLines]);

  if (!visible) return null;

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        height: '120px',
        top: 0,
        left: 0,
        right: 0
      }}
    >
      {showMeasures ? (
        visibleLines
          .filter((l) => l.isBar)
          .map((line) => (
            <div
              key={`bar-${line.time}`}
              className="absolute top-0 bottom-0 w-px bg-white opacity-40"
              style={{
                left: `${timeToPixels(line.time)}px`,
                transform: 'translateX(-50%)'
              }}
            />
          ))
      ) : (
        visibleLines.map((line) => {
          const isHighlight = nearestHighlightTime != null && line.time === nearestHighlightTime;
          const opacity = isHighlight ? 0.7 : line.isBar ? 0.4 : 0.25;
          return (
            <div
              key={`${line.time}-${line.index}`}
              className={`absolute top-0 bottom-0 w-px bg-white ${isHighlight ? 'opacity-70' : ''}`}
              style={{
                left: `${timeToPixels(line.time)}px`,
                transform: 'translateX(-50%)',
                opacity: isHighlight ? undefined : opacity
              }}
            />
          );
        })
      )}
    </div>
  );
};

export default GridLines;
