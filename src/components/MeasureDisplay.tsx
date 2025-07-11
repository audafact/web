import { useState, useEffect, useRef, useCallback } from 'react';
import { TimeSignature } from '../types/music';

interface MeasureDisplayProps {
  duration: number;
  tempo: number;
  zoomLevel: number;
  onFirstMeasureChange: (time: number) => void;
  timeSignature: TimeSignature;
  onTimeSignatureChange: (timeSignature: TimeSignature) => void;
  firstMeasureTime: number;
  visible?: boolean;
}

const MeasureDisplay = ({
  duration,
  tempo,
  zoomLevel,
  onFirstMeasureChange,
  timeSignature,
  onTimeSignatureChange,
  firstMeasureTime,
  visible = true
}: MeasureDisplayProps) => {
  const [isDraggingFirstMeasure, setIsDraggingFirstMeasure] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartTime, setDragStartTime] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate measure duration in seconds
  const measureDuration = useCallback(() => {
    // Convert tempo (BPM) to seconds per beat
    const secondsPerBeat = 60 / tempo;
    
    // The denominator tells us what note gets one beat
    // 4 = quarter note, 8 = eighth note, 2 = half note, etc.
    const beatNoteValue = 4 / timeSignature.denominator;
    
    // Calculate measure duration: beats per measure × duration per beat
    return timeSignature.numerator * secondsPerBeat * beatNoteValue;
  }, [tempo, timeSignature]);

  // Calculate measure positions
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
    if (!containerRef.current) return 0;
    const containerWidth = containerRef.current.offsetWidth;
    const pixelsPerSecond = containerWidth / duration;
    return time * pixelsPerSecond;
  }, [duration]);

  // Convert pixel position to time
  const pixelsToTime = useCallback((pixels: number) => {
    if (!containerRef.current) return 0;
    const containerWidth = containerRef.current.offsetWidth;
    const pixelsPerSecond = containerWidth / duration;
    return pixels / pixelsPerSecond;
  }, [duration]);

  // Handle first measure marker drag start
  const handleFirstMeasureMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingFirstMeasure(true);
    setDragStartX(e.clientX);
    setDragStartTime(firstMeasureTime);
  }, [firstMeasureTime]);



  // Handle mouse move during drag
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDraggingFirstMeasure || !containerRef.current) return;
    
    const deltaX = e.clientX - dragStartX;
    const containerRect = containerRef.current.getBoundingClientRect();
    const relativeDeltaX = deltaX;
    const timeDelta = pixelsToTime(relativeDeltaX);
    const newTime = Math.max(0, Math.min(duration, dragStartTime + timeDelta));
    
    onFirstMeasureChange(newTime);
  }, [isDraggingFirstMeasure, dragStartX, dragStartTime, pixelsToTime, duration, onFirstMeasureChange]);

  // Handle mouse up to end drag
  const handleMouseUp = useCallback(() => {
    setIsDraggingFirstMeasure(false);
  }, []);

  // Add/remove global mouse event listeners
  useEffect(() => {
    if (isDraggingFirstMeasure) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDraggingFirstMeasure, handleMouseMove, handleMouseUp]);

  const measures = calculateMeasures();

  return (
    <div 
      ref={containerRef}
      className={`absolute inset-0 ${visible ? 'pointer-events-auto' : 'pointer-events-none'}`}
      style={{ 
        height: '100%'
      }}
    >
      {/* First Measure Marker */}
      {visible && (
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-yellow-500 pointer-events-auto cursor-ew-resize z-20"
          style={{
            left: `${timeToPixels(firstMeasureTime)}px`,
            transform: 'translateX(-50%)'
          }}
          onMouseDown={handleFirstMeasureMouseDown}
          title={`First measure at ${firstMeasureTime.toFixed(2)}s`}
        >
          <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 bg-yellow-500 text-yellow-900 text-xs px-1 py-0.5 rounded whitespace-nowrap">
            Measure 1
          </div>
        </div>
      )}

      {/* Measure Lines */}
      {visible && measures.map((measure, index) => (
        <div key={index}>
          {/* Measure line - made darker */}
          <div
            className="absolute top-0 bottom-0 w-px bg-gray-500"
            style={{
              left: `${timeToPixels(measure.time)}px`,
              transform: 'translateX(-50%)'
            }}
          />
          
          {/* Measure number (show every 4th measure to avoid clutter) */}
          {measure.number % 4 === 1 && (
            <div
              className="absolute top-1 left-1/2 transform -translate-x-1/2 bg-gray-100 text-gray-600 text-xs px-1 py-0.5 rounded whitespace-nowrap"
              style={{
                left: `${timeToPixels(measure.time)}px`,
                transform: 'translateX(-50%)'
              }}
            >
              {measure.number}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default MeasureDisplay; 