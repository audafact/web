import React from 'react';
import { useUser } from '../hooks/useUser';
import { useAccessControl } from '../hooks/useAccessControl';
import { FeatureGateProps } from '../types/music';
import { showSignupModal } from '../hooks/useSignupModal';
import { trackEvent } from '../services/analyticsService';
import VisualFeatureGate from './VisualFeatureGate';
import { getGateConfigForScreen } from '../utils/gateConfigs';

// Main FeatureGate Component
const FeatureGate: React.FC<FeatureGateProps> = ({ 
  feature, 
  children, 
  fallback, 
  gateType = 'modal',
  onGateTrigger 
}) => {
  const { tier } = useUser();
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