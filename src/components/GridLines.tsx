import { useCallback, useRef, useEffect } from 'react';
import { TimeSignature } from '../types/music';

interface GridLinesProps {
  duration: number;
  tempo: number;
  zoomLevel: number;
  timeSignature: TimeSignature;
  firstMeasureTime: number;
  visible?: boolean;
  containerRef?: React.RefObject<HTMLDivElement>;
}

const GridLines = ({
  duration,
  tempo,
  zoomLevel,
  timeSignature,
  firstMeasureTime,
  visible = true,
  containerRef: externalContainerRef
}: GridLinesProps) => {
  const internalContainerRef = useRef<HTMLDivElement>(null);
  const containerRef = externalContainerRef || internalContainerRef;

  // Calculate beat duration in seconds
  const beatDuration = useCallback(() => {
    // Convert tempo (BPM) to seconds per beat
    const secondsPerBeat = 60 / tempo;
    
    // The denominator tells us what note gets one beat
    // 4 = quarter note, 8 = eighth note, 2 = half note, etc.
    const beatNoteValue = 4 / timeSignature.denominator;
    
    // Calculate beat duration: duration per beat × beat note value
    return secondsPerBeat * beatNoteValue;
  }, [tempo, timeSignature]);

  // Calculate measure duration in seconds
  const measureDuration = useCallback(() => {
    const beatDur = beatDuration();
    // Calculate measure duration: beats per measure × duration per beat
    return timeSignature.numerator * beatDur;
  }, [timeSignature, beatDuration]);

  // Calculate all beat positions
  const calculateBeats = useCallback(() => {
    const beatDur = beatDuration();
    const measureDur = measureDuration();
    const beats = [];
    
    // Start from the first measure time
    let currentTime = firstMeasureTime;
    let beatNumber = 1;
    let measureNumber = 1;
    
    while (currentTime <= duration) {
      // Add all beats in this measure
      for (let beatInMeasure = 0; beatInMeasure < timeSignature.numerator; beatInMeasure++) {
        const beatTime = currentTime + (beatInMeasure * beatDur);
        if (beatTime <= duration) {
          beats.push({
            time: beatTime,
            beatNumber: beatNumber,
            measureNumber: measureNumber,
            isMeasureStart: beatInMeasure === 0
          });
          beatNumber++;
        }
      }
      currentTime += measureDur;
      measureNumber++;
    }
    
    return beats;
  }, [duration, firstMeasureTime, beatDuration, measureDuration, timeSignature]);

  // Convert time to pixel position
  const timeToPixels = useCallback((time: number) => {
    // Calculate pixels per second based on zoom level
    // Base pixels per second is 40 (WaveSurfer's actual default minPxPerSec)
    const basePixelsPerSecond = 40;
    const zoomedPixelsPerSecond = basePixelsPerSecond * zoomLevel;
    return time * zoomedPixelsPerSecond;
  }, [zoomLevel]);

  const beats = calculateBeats();

  // Don't render anything if not visible
  if (!visible) {
    return null;
  }

  return (
    <div 
      ref={internalContainerRef}
      className="absolute inset-0 pointer-events-none"
      style={{ 
        height: '100%'
      }}
    >
      {/* Grid Lines for every beat */}
      {beats.map((beat, index) => (
        <div key={index}>
          {/* Beat line - lighter for regular beats, darker for measure starts */}
          <div
            className={`absolute top-0 bottom-0 w-px ${
              beat.isMeasureStart 
                ? 'bg-white opacity-60' // More visible for measure starts
                : 'bg-white opacity-30' // Less visible for regular beats
            }`}
            style={{
              left: `${timeToPixels(beat.time)}px`,
              transform: 'translateX(-50%)'
            }}
          />
        </div>
      ))}
    </div>
  );
};

export default GridLines; 