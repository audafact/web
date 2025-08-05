import React from 'react';

interface DemoModeIndicatorProps {
  className?: string;
}

const DemoModeIndicator: React.FC<DemoModeIndicatorProps> = ({ className = '' }) => {
  return (
    <div className={`demo-mode-indicator ${className}`}>
      Demo Mode
    </div>
  );
};

export default DemoModeIndicator; 