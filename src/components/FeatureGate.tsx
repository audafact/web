import React, { useState } from 'react';
import { useUserTier } from '../hooks/useUserTier';
import { useAccessControl } from '../hooks/useAccessControl';
import { FeatureGateProps } from '../types/music';
import { EnhancedAccessService } from '../services/accessService';
import { showSignupModal } from '../hooks/useSignupModal';
import { trackEvent } from '../services/analyticsService';
import VisualFeatureGate from './VisualFeatureGate';
import { getGateConfigForScreen } from '../utils/gateConfigs';

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
  
  const hasAccess = canAccessFeature(feature);
  
  if (hasAccess) {
    return <>{children}</>;
  }
  
  const handleGateTrigger = () => {
    onGateTrigger?.(feature);
    
    // Track feature gate click
    trackEvent('feature_gate_clicked', {
      feature,
      userTier: tier.id,
      gateType
    });
    
    switch (gateType) {
      case 'modal':
        showSignupModal(feature);
        break;
      case 'tooltip':
        // Tooltip is handled by CSS hover
        break;
      case 'disabled':
        // Disabled state is handled by CSS
        break;
    }
  };
  
  // Use the new visual gating system for better UX
  const config = getGateConfigForScreen(feature);
  
  switch (gateType) {
    case 'hidden':
      return null;
      
    case 'disabled':
      return (
        <VisualFeatureGate
          feature={feature}
          gateType="disabled"
          onClick={handleGateTrigger}
        >
          {fallback || children}
        </VisualFeatureGate>
      );
      
    case 'tooltip':
      return (
        <VisualFeatureGate
          feature={feature}
          gateType="tooltip"
          tooltipText={config.tooltip}
          onClick={handleGateTrigger}
        >
          {fallback || children}
        </VisualFeatureGate>
      );
      
    case 'modal':
    default:
      return (
        <VisualFeatureGate
          feature={feature}
          gateType={config.gateType}
          tooltipText={config.tooltip}
          onClick={handleGateTrigger}
        >
          {fallback || children}
        </VisualFeatureGate>
      );
  }
};

export default FeatureGate; 