import { useState } from 'react';
import { TimeSignature } from '../types/music';

interface TimeSignatureControlsProps {
  timeSignature: TimeSignature;
  onTimeSignatureChange: (timeSignature: TimeSignature) => void;
}

const TimeSignatureControls = ({
  timeSignature,
  onTimeSignatureChange
}: TimeSignatureControlsProps) => {
  const [isOpen, setIsOpen] = useState(false);

  // Common time signatures
  const commonTimeSignatures = [
    { numerator: 2, denominator: 2, label: '2/2 (Cut time)' },
    { numerator: 2, denominator: 4, label: '2/4' },
    { numerator: 3, denominator: 4, label: '3/4' },
    { numerator: 4, denominator: 4, label: '4/4 (Common time)' },
    { numerator: 3, denominator: 8, label: '3/8' },
    { numerator: 6, denominator: 8, label: '6/8' },
    { numerator: 9, denominator: 8, label: '9/8' },
    { numerator: 12, denominator: 8, label: '12/8' },
    { numerator: 5, denominator: 4, label: '5/4' },
    { numerator: 7, denominator: 8, label: '7/8' },
    { numerator: 5, denominator: 8, label: '5/8' },
  ];

  const handleNumeratorChange = (value: string) => {
    const numerator = parseInt(value);
    if (!isNaN(numerator) && numerator > 0 && numerator <= 32) {
      onTimeSignatureChange({ ...timeSignature, numerator });
    }
  };

  const handleDenominatorChange = (value: string) => {
    const denominator = parseInt(value);
    if (!isNaN(denominator) && denominator > 0 && denominator <= 32) {
      onTimeSignatureChange({ ...timeSignature, denominator });
    }
  };

  const handleCommonTimeSignatureSelect = (ts: typeof commonTimeSignatures[0]) => {
    onTimeSignatureChange({ numerator: ts.numerator, denominator: ts.denominator });
    setIsOpen(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 md:space-x-4 md:gap-4 p-2 md:p-3 audafact-card">
      {/* Time Signature Label */}
      <div className="flex flex-col">
        <label className="text-xs md:text-sm font-medium audafact-heading">Time Signature</label>
        <span className="hidden md:block text-xs audafact-text-secondary">Beats per measure</span>
      </div>

      {/* Custom Time Signature Input */}
      <div className="flex items-center space-x-2">
        <input
          type="number"
          min="1"
          max="32"
          value={timeSignature.numerator}
          onChange={(e) => handleNumeratorChange(e.target.value)}
          className="w-10 md:w-12 px-2 py-0.5 md:py-1 text-xs md:text-sm border border-audafact-divider rounded bg-audafact-surface-2 text-audafact-text-primary focus:outline-none focus:ring-2 focus:ring-audafact-accent-cyan focus:border-transparent text-center"
        />
        <span className="text-xs md:text-sm audafact-text-secondary">/</span>
        <input
          type="number"
          min="1"
          max="32"
          value={timeSignature.denominator}
          onChange={(e) => handleDenominatorChange(e.target.value)}
          className="w-10 md:w-12 px-2 py-0.5 md:py-1 text-xs md:text-sm border border-audafact-divider rounded bg-audafact-surface-2 text-audafact-text-primary focus:outline-none focus:ring-2 focus:ring-audafact-accent-cyan focus:border-transparent text-center"
        />
      </div>

      {/* Common Time Signatures Dropdown */}
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="px-2 py-1 text-xs md:px-3 md:py-1.5 md:text-sm font-medium bg-audafact-surface-2 text-audafact-text-secondary border border-audafact-divider rounded-md hover:bg-audafact-divider hover:text-audafact-text-primary transition-colors duration-200"
        >
          Common
        </button>
        
        {isOpen && (
          <div className="absolute top-full left-0 mt-1 w-40 bg-audafact-surface-1 rounded-md shadow-card border border-audafact-divider z-10">
            {commonTimeSignatures.map((ts) => (
              <button
                key={ts.label}
                onClick={() => handleCommonTimeSignatureSelect(ts)}
                className="w-full text-left px-3 py-2 text-xs md:text-sm hover:bg-audafact-surface-2 text-audafact-text-secondary hover:text-audafact-text-primary transition-colors duration-200"
              >
                {ts.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Current Time Signature Display */}
      <div className="flex flex-col">
        <span className="text-xs md:text-sm font-medium audafact-accent-cyan">
          {timeSignature.numerator}/{timeSignature.denominator}
        </span>
        <span className="text-[10px] md:text-xs audafact-text-secondary">
          {timeSignature.numerator} beats per measure
        </span>

      </div>
    </div>
  );
};

export default TimeSignatureControls; 