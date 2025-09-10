import React from 'react';

interface DemoModeIndicatorProps {
  className?: string;
}

const DemoModeIndicator: React.FC<DemoModeIndicatorProps> = ({ className = '' }) => {
  return (
    <div className={`fixed top-4 right-4 z-50 bg-gradient-to-r from-audafact-accent-cyan to-audafact-accent-purple text-white px-4 py-2 rounded-lg shadow-lg border border-audafact-accent-cyan border-opacity-30 ${className}`}>
      <div className="flex items-center gap-2">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="text-sm font-medium">Demo Mode</span>
      </div>
    </div>
  );
};

export default DemoModeIndicator; 