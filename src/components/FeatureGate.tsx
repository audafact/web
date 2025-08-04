import React, { useState } from 'react';
import { useUserTier } from '../hooks/useUserTier';
import { useAccessControl } from '../hooks/useAccessControl';
import { FeatureGateProps } from '../types/music';
import { EnhancedAccessService } from '../services/accessService';

// Modal Gate Component
const ModalGate: React.FC<{ 
  feature: string; 
  children: React.ReactNode; 
  onTrigger: () => void 
}> = ({ 
  feature, 
  children, 
  onTrigger 
}) => {
  return (
    <div className="modal-gate" onClick={onTrigger}>
      {children}
    </div>
  );
};

// Tooltip Gate Component
const TooltipGate: React.FC<{ 
  feature: string; 
  children: React.ReactNode; 
  onTrigger: () => void 
}> = ({ 
  feature, 
  children, 
  onTrigger 
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const config = EnhancedAccessService.getFeatureGateConfig(feature);
  
  return (
    <div 
      className="tooltip-gate"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onClick={onTrigger}
    >
      {children}
      {showTooltip && (
        <div className="feature-tooltip">
          {config.message}
        </div>
      )}
    </div>
  );
};

// Main FeatureGate Component
const FeatureGate: React.FC<FeatureGateProps> = ({ 
  feature, 
  children, 
  fallback, 
  gateType = 'modal',
  onGateTrigger 
}) => {
  const { tier } = useUserTier();
  const { canAccessFeature } = useAccessControl();
  
  const hasAccess = canAccessFeature(feature, tier);
  
  if (hasAccess) {
    return <>{children}</>;
  }
  
  const handleGateTrigger = () => {
    onGateTrigger?.(feature);
    
    switch (gateType) {
      case 'modal':
        // TODO: Implement showSignupModal function
        console.log('Show signup modal for feature:', feature);
        break;
      case 'tooltip':
        // Tooltip is handled by CSS hover
        break;
      case 'disabled':
        // Disabled state is handled by CSS
        break;
    }
  };
  
  switch (gateType) {
    case 'hidden':
      return null;
      
    case 'disabled':
      return (
        <div className="feature-gate-disabled" onClick={handleGateTrigger}>
          {fallback || children}
        </div>
      );
      
    case 'tooltip':
      return (
        <TooltipGate feature={feature} onTrigger={handleGateTrigger}>
          {fallback || children}
        </TooltipGate>
      );
      
    case 'modal':
    default:
      return (
        <ModalGate feature={feature} onTrigger={handleGateTrigger}>
          {fallback || children}
        </ModalGate>
      );
  }
};

export default FeatureGate; 