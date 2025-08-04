import React from 'react';
import FeatureGate from './FeatureGate';
import { useAccessControl } from '../hooks/useAccessControl';

// Upload Button Example
export const UploadButton: React.FC = () => {
  return (
    <FeatureGate feature="upload" gateType="modal">
      <button className="upload-button">
        📁 Upload Track
      </button>
    </FeatureGate>
  );
};

// Save Session Button Example
export const SaveSessionButton: React.FC = () => {
  const { canAccessFeature } = useAccessControl();
  
  const handleSave = () => {
    console.log('Saving session...');
  };
  
  if (!canAccessFeature('save_session')) {
    return (
      <FeatureGate feature="save_session" gateType="disabled">
        <button className="save-button">
          💾 Save Session
        </button>
      </FeatureGate>
    );
  }
  
  return (
    <button className="save-button" onClick={handleSave}>
      💾 Save Session
    </button>
  );
};

// Cue Point Editing Example
export const CuePointHandle: React.FC<{ cue: any; onDrag: () => void }> = ({ 
  cue, 
  onDrag 
}) => {
  return (
    <FeatureGate feature="edit_cues" gateType="tooltip">
      <div 
        className="cue-handle"
        draggable={true}
        onDragStart={onDrag}
        title="Drag to adjust"
      />
    </FeatureGate>
  );
};

// Record Button Example
export const RecordButton: React.FC = () => {
  return (
    <FeatureGate feature="record" gateType="modal">
      <button className="record-button">
        🎙 Record
      </button>
    </FeatureGate>
  );
};

// Download Button Example
export const DownloadButton: React.FC = () => {
  return (
    <FeatureGate feature="download" gateType="modal">
      <button className="download-button">
        💿 Download
      </button>
    </FeatureGate>
  );
};

// Loop Editing Example
export const LoopRegionHandle: React.FC<{ loop: any; onDrag: () => void }> = ({ 
  loop, 
  onDrag 
}) => {
  return (
    <FeatureGate feature="edit_loops" gateType="tooltip">
      <div 
        className="loop-handle"
        draggable={true}
        onDragStart={onDrag}
        title="Drag to adjust loop"
      />
    </FeatureGate>
  );
}; 