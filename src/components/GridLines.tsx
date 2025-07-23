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
  showMeasures?: boolean; // Add prop to know when measures are being displayed
}

const GridLines = ({
  duration,
  tempo,
  zoomLevel,
  timeSignature,
  firstMeasureTime,
  visible = true,
  containerRef: externalContainerRef,
  showMeasures = false
}: GridLinesProps) => {
  const internalContainerRef = useRef<HTMLDivElement>(null);
  const containerRef = externalContainerRef || internalContainerRef;

  // Calculate beat duration in seconds (same as MeasureDisplay)
  const beatDuration = useCallback(() => {
    // Convert tempo (BPM) to seconds per beat
    const secondsPerBeat = 60 / tempo;
    
    // The denominator tells us what note gets one beat
    // 4 = quarter note, 8 = eighth note, 2 = half note, etc.
    const beatNoteValue = 4 / timeSignature.denominator;
    
    // Calculate beat duration: duration per beat × beat note value
    return secondsPerBeat * beatNoteValue;
  }, [tempo, timeSignature]);

  // Calculate measure duration in seconds (exact same as MeasureDisplay)
  const measureDuration = useCallback(() => {
    // Convert tempo (BPM) to seconds per beat
    const secondsPerBeat = 60 / tempo;
    
    // The denominator tells us what note gets one beat
    // 4 = quarter note, 8 = eighth note, 2 = half note, etc.
    const beatNoteValue = 4 / timeSignature.denominator;
    
    // Calculate measure duration: beats per measure × duration per beat
    return timeSignature.numerator * secondsPerBeat * beatNoteValue;
  }, [tempo, timeSignature]);

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

  // Calculate measure positions (for when measures are visible)
  const calculateMeasures = useCallback(() => {
    const measureDur = measureDuration();
    const measures = [];
    
    // Start from the first measure time
    let currentTime = firstMeasureTime;
    let measureNumber = 1;
    
    while (currentTime <= duration) {
      measures.push({
        time: currentTime,
        number: measureNumber
      });
      currentTime += measureDur;
      measureNumber++;
    }
    
    return measures;
  }, [duration, firstMeasureTime, measureDuration]);

  // Convert time to pixel position
  const timeToPixels = useCallback((time: number) => {
    // Calculate pixels per second based on zoom level
    // Base pixels per second is 40 (WaveSurfer's actual default minPxPerSec)
    const basePixelsPerSecond = 40;
    const zoomedPixelsPerSecond = basePixelsPerSecond * zoomLevel;
    return time * zoomedPixelsPerSecond;
  }, [zoomLevel]);

  const beats = calculateBeats();
  const measures = calculateMeasures();



  // Don't render anything if not visible
  if (!visible) {
    return null;
  }

  return (
    <div 
      ref={internalContainerRef}
      className="absolute pointer-events-none"
      style={{ 
        height: '120px',
        top: 0,
        left: 0,
        right: 0
      }}
    >
      {showMeasures ? (
        // When measures are visible, only show grid lines at measure boundaries
        measures.map((measure, index) => (
          <div key={`measure-${index}`}>
            <div
              className="absolute top-0 bottom-0 w-px bg-white opacity-40"
              style={{
                left: `${timeToPixels(measure.time)}px`,
                transform: 'translateX(-50%)'
              }}
            />
          </div>
        ))
      ) : (
        // When measures are not visible, show grid lines for every beat
        beats.map((beat, index) => (
          <div key={`beat-${index}`}>
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
        ))
      )}
    </div>
  );
};

export default GridLines; 