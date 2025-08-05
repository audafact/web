import React, { useState, useRef, useEffect } from 'react';
import { useUserTier } from '../hooks/useUserTier';
import { useAccessControl } from '../hooks/useAccessControl';
import { useResponsiveDesign } from '../hooks/useResponsiveDesign';
import { showSignupModal } from '../hooks/useSignupModal';
import { trackEvent } from '../services/analyticsService';

interface LockedFeatureStyles {
  opacity: number;
  cursor: string;
  position: 'relative' | 'absolute';
  lockIcon: {
    position: 'top-right' | 'center' | 'overlay';
    size: 'small' | 'medium' | 'large';
    color: string;
    background: string;
  };
  disabledState: {
    background: string;
    color: string;
    border: string;
  };
}

const LOCKED_FEATURE_CONFIG: LockedFeatureStyles = {
  opacity: 0.6,
  cursor: 'not-allowed',
  position: 'relative',
  lockIcon: {
    position: 'top-right',
    size: 'small',
    color: '#ffffff',
    background: 'rgba(0, 0, 0, 0.8)'
  },
  disabledState: {
    background: '#f3f4f6',
    color: '#9ca3af',
    border: '#d1d5db'
  }
};

interface VisualFeatureGateProps {
  feature: string;
  children: React.ReactNode;
  gateType: 'lock' | 'overlay' | 'disabled' | 'tooltip' | 'mobile-overlay';
  tooltipText?: string;
  lockPosition?: 'top-right' | 'center' | 'overlay';
  className?: string;
  onClick?: () => void;
  tooltipPosition?: 'top' | 'bottom' | 'left' | 'right';
  tooltipDelay?: number;
}

const VisualFeatureGate: React.FC<VisualFeatureGateProps> = ({
  feature,
  children,
  gateType,
  tooltipText,
  lockPosition = 'top-right',
  className = '',
  onClick,
  tooltipPosition = 'top',
  tooltipDelay = 200
}) => {
  const { isMobile, isTablet } = useResponsiveDesign();
  const { tier } = useUserTier();
  const { canAccessFeature } = useAccessControl();
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipCoords, setTooltipCoords] = useState({ x: 0, y: 0 });
  const timeoutRef = useRef<NodeJS.Timeout>();
  const triggerRef = useRef<HTMLDivElement>(null);
  
  const hasAccess = canAccessFeature(feature, tier);
  
  const handleClick = (e: React.MouseEvent) => {
    if (!hasAccess) {
      e.preventDefault();
      e.stopPropagation();
      
      // Track interaction
      trackEvent('gate_clicked', {
        feature,
        gateType,
        userTier: tier,
        screenSize: isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop'
      });
      
      if (onClick) {
        onClick();
      } else {
        showSignupModal(feature);
      }
    }
  };
  
  const handleMouseEnter = (e: React.MouseEvent) => {
    if (!hasAccess && (gateType === 'tooltip' || gateType === 'lock')) {
      const rect = e.currentTarget.getBoundingClientRect();
      let x = rect.left + rect.width / 2;
      let y = rect.top;
      
      switch (tooltipPosition) {
        case 'top':
          y = rect.top - 10;
          break;
        case 'bottom':
          y = rect.bottom + 10;
          break;
        case 'left':
          x = rect.left - 10;
          y = rect.top + rect.height / 2;
          break;
        case 'right':
          x = rect.right + 10;
          y = rect.top + rect.height / 2;
          break;
      }
      
      setTooltipCoords({ x, y });
      
      if (tooltipDelay > 0) {
        timeoutRef.current = setTimeout(() => setShowTooltip(true), tooltipDelay);
      } else {
        setShowTooltip(true);
      }
      
      // Track tooltip shown
      trackEvent('tooltip_shown', {
        feature,
        tooltipText,
        userTier: tier
      });
    }
  };
  
  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setShowTooltip(false);
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!hasAccess && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      handleClick(e as any);
    }
  };
  
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
  
  if (hasAccess) {
    return <>{children}</>;
  }
  
  const baseClassName = `visual-feature-gate ${className}`;
  const ariaLabel = `Sign up to unlock ${feature}`;
  
  switch (gateType) {
    case 'lock':
      return (
        <div 
          ref={triggerRef}
          className={`${baseClassName} locked-feature lock-${lockPosition}`}
          onClick={handleClick}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onKeyDown={handleKeyDown}
          role="button"
          tabIndex={0}
          aria-label={ariaLabel}
        >
          {children}
          {showTooltip && tooltipText && (
            <div 
              className={`feature-tooltip tooltip-${tooltipPosition}`}
              style={{
                left: tooltipCoords.x,
                top: tooltipCoords.y,
                transform: tooltipPosition === 'top' || tooltipPosition === 'bottom' 
                  ? 'translateX(-50%)' 
                  : 'translateY(-50%)'
              }}
            >
              {tooltipText}
            </div>
          )}
        </div>
      );
      
    case 'overlay':
      return (
        <div className={`${baseClassName} locked-feature`}>
          {children}
          <div 
            className="locked-overlay" 
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            role="button"
            tabIndex={0}
            aria-label={ariaLabel}
          >
            <div className="locked-overlay-content">
              <div className="locked-overlay-icon">🔒</div>
              <span>Sign up to unlock</span>
            </div>
          </div>
        </div>
      );
      
    case 'disabled':
      return (
        <div 
          ref={triggerRef}
          className={`${baseClassName} disabled-button`}
          onClick={handleClick}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onKeyDown={handleKeyDown}
          role="button"
          tabIndex={0}
          aria-label={ariaLabel}
        >
          {children}
          {showTooltip && tooltipText && (
            <div 
              className={`feature-tooltip tooltip-${tooltipPosition}`}
              style={{
                left: tooltipCoords.x,
                top: tooltipCoords.y,
                transform: tooltipPosition === 'top' || tooltipPosition === 'bottom' 
                  ? 'translateX(-50%)' 
                  : 'translateY(-50%)'
              }}
            >
              {tooltipText}
            </div>
          )}
        </div>
      );
      
    case 'mobile-overlay':
      if (isMobile || isTablet) {
        return (
          <div className={`${baseClassName} mobile-gate`}>
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
                <span>{isMobile ? 'Tap to unlock' : 'Click to unlock'}</span>
              </div>
            </div>
          </div>
        );
      }
      return (
        <VisualFeatureGate
          feature={feature}
          gateType="lock"
          tooltipText={tooltipText}
          onClick={onClick}
          tooltipPosition={tooltipPosition}
        >
          {children}
        </VisualFeatureGate>
      );
      
    default:
      return <>{children}</>;
  }
};

export default VisualFeatureGate; 