import React from 'react';
import { useUserTier } from '../hooks/useUserTier';
import { useAccessControl } from '../hooks/useAccessControl';
import { useResponsiveDesign } from '../hooks/useResponsiveDesign';
import { showSignupModal } from '../hooks/useSignupModal';
import { trackEvent } from '../services/analyticsService';
import VisualFeatureGate from './VisualFeatureGate';

interface MobileGateProps {
  feature: string;
  children: React.ReactNode;
  fallbackGateType?: 'lock' | 'overlay' | 'disabled';
  mobileText?: string;
  tabletText?: string;
  onClick?: () => void;
  tooltipText?: string;
  className?: string;
}

const MobileGate: React.FC<MobileGateProps> = ({
  feature,
  children,
  fallbackGateType = 'lock',
  mobileText = 'Tap to unlock',
  tabletText = 'Click to unlock',
  onClick,
  tooltipText,
  className = ''
}) => {
  const { isMobile, isTablet } = useResponsiveDesign();
  const { tier } = useUserTier();
  const { canAccessFeature } = useAccessControl();
  
  const hasAccess = canAccessFeature(feature, tier);
  
  const handleClick = (e: React.MouseEvent) => {
    if (!hasAccess) {
      e.preventDefault();
      e.stopPropagation();
      
      // Track mobile gate interaction
      trackEvent('mobile_gate_tapped', {
        feature,
        screenSize: isMobile ? 'mobile' : 'tablet',
        userTier: tier
      });
      
      if (onClick) {
        onClick();
      } else {
        showSignupModal(feature);
      }
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!hasAccess && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      handleClick(e as any);
    }
  };
  
  if (hasAccess) {
    return <>{children}</>;
  }
  
  const baseClassName = `mobile-gate ${className}`;
  const ariaLabel = tooltipText || `Sign up to unlock ${feature}`;
  
  if (isMobile) {
    return (
      <div className={baseClassName}>
        {children}
        <div 
          className="mobile-gate-overlay" 
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          role="button"
          tabIndex={0}
          aria-label={ariaLabel}
        >
          <div className="mobile-gate-content">
            <div className="mobile-gate-icon">🔒</div>
            <span>{mobileText}</span>
          </div>
        </div>
      </div>
    );
  }
  
  if (isTablet) {
    return (
      <div className={baseClassName}>
        {children}
        <div 
          className="mobile-gate-overlay" 
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          role="button"
          tabIndex={0}
          aria-label={ariaLabel}
        >
          <div className="mobile-gate-content">
            <div className="mobile-gate-icon">🔒</div>
            <span>{tabletText}</span>
          </div>
        </div>
      </div>
    );
  }
  
  // Fallback to desktop gate
  return (
    <VisualFeatureGate
      feature={feature}
      gateType={fallbackGateType}
      tooltipText={tooltipText}
      onClick={onClick}
      className={className}
    >
      {children}
    </VisualFeatureGate>
  );
};

export default MobileGate; 