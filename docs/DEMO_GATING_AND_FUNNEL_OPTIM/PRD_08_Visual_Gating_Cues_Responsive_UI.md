# 🎨 PRD 8: Visual Gating Cues & Responsive UI

## 📋 Overview

**Scope:** Locked UI styles, tooltip styling, mobile behavior overlays, breakpoint-based behavior hooks

**Dependencies:** PRD 2 (gating), PRD 4/5 (UI integration)  
**Parallelizable:** Yes  
**Estimated Timeline:** 1 week

---

## 🎯 Objectives

- Provide clear visual indicators for gated features
- Ensure consistent gating UX across all screen sizes
- Create intuitive mobile-specific gating interactions
- Maintain accessibility standards for all gating elements

---

## 🏗️ Technical Requirements

### 8.1 Visual Design System

#### Locked Feature Styling
```typescript
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
```

#### CSS Design System
```css
/* Base locked feature styling */
.locked-feature {
  opacity: 0.6;
  cursor: not-allowed;
  position: relative;
  transition: all 0.2s ease;
}

.locked-feature:hover {
  opacity: 0.7;
}

.locked-feature::after {
  content: "🔒";
  position: absolute;
  top: -8px;
  right: -8px;
  font-size: 12px;
  background: rgba(0, 0, 0, 0.8);
  border-radius: 50%;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  z-index: 10;
}

/* Disabled button styling */
.disabled-button {
  background: #f3f4f6 !important;
  color: #9ca3af !important;
  border: 1px solid #d1d5db !important;
  cursor: not-allowed !important;
  pointer-events: none;
}

.disabled-button:hover {
  background: #f3f4f6 !important;
  transform: none !important;
  box-shadow: none !important;
}

/* Locked overlay for complex components */
.locked-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 5;
  border-radius: inherit;
}

.locked-overlay-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: #6b7280;
  font-size: 14px;
}

.locked-overlay-icon {
  font-size: 24px;
  margin-bottom: 4px;
}

/* Tooltip styling */
.feature-tooltip {
  position: absolute;
  background: rgba(0, 0, 0, 0.9);
  color: white;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 14px;
  z-index: 1000;
  pointer-events: none;
  white-space: nowrap;
  max-width: 200px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.feature-tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 4px solid transparent;
  border-top-color: rgba(0, 0, 0, 0.9);
}

/* Mobile-specific gating */
.mobile-gate {
  position: relative;
}

.mobile-gate-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 5;
  border-radius: inherit;
  cursor: pointer;
  transition: background-color 0.2s;
}

.mobile-gate-overlay:hover {
  background: rgba(0, 0, 0, 0.2);
}

.mobile-gate-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  color: #374151;
  font-size: 12px;
  font-weight: 500;
}

.mobile-gate-icon {
  font-size: 16px;
  margin-bottom: 2px;
}

/* Responsive breakpoints */
@media (max-width: 768px) {
  .locked-feature::after {
    width: 16px;
    height: 16px;
    font-size: 10px;
    top: -6px;
    right: -6px;
  }
  
  .feature-tooltip {
    font-size: 12px;
    padding: 6px 10px;
    max-width: 150px;
  }
}

@media (max-width: 480px) {
  .locked-feature::after {
    width: 14px;
    height: 14px;
    font-size: 8px;
    top: -4px;
    right: -4px;
  }
  
  .mobile-gate-content {
    font-size: 11px;
  }
  
  .mobile-gate-icon {
    font-size: 14px;
  }
}
```

### 8.2 Responsive Design Hook

#### Breakpoint Management
```typescript
interface BreakpointConfig {
  mobile: number;
  tablet: number;
  desktop: number;
}

const BREAKPOINTS: BreakpointConfig = {
  mobile: 768,
  tablet: 1024,
  desktop: 1200
};

const useResponsiveDesign = () => {
  const [screenSize, setScreenSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  });
  
  const [breakpoints, setBreakpoints] = useState({
    isMobile: window.innerWidth < BREAKPOINTS.mobile,
    isTablet: window.innerWidth >= BREAKPOINTS.mobile && window.innerWidth < BREAKPOINTS.tablet,
    isDesktop: window.innerWidth >= BREAKPOINTS.tablet
  });
  
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      setScreenSize({ width, height });
      setBreakpoints({
        isMobile: width < BREAKPOINTS.mobile,
        isTablet: width >= BREAKPOINTS.mobile && width < BREAKPOINTS.tablet,
        isDesktop: width >= BREAKPOINTS.tablet
      });
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  return {
    screenSize,
    breakpoints,
    isMobile: breakpoints.isMobile,
    isTablet: breakpoints.isTablet,
    isDesktop: breakpoints.isDesktop
  };
};
```

### 8.3 Enhanced Feature Gate Components

#### Visual Feature Gate Component
```typescript
interface VisualFeatureGateProps {
  feature: string;
  children: React.ReactNode;
  gateType: 'lock' | 'overlay' | 'disabled' | 'tooltip' | 'mobile-overlay';
  tooltipText?: string;
  lockPosition?: 'top-right' | 'center' | 'overlay';
  className?: string;
  onClick?: () => void;
}

const VisualFeatureGate: React.FC<VisualFeatureGateProps> = ({
  feature,
  children,
  gateType,
  tooltipText,
  lockPosition = 'top-right',
  className = '',
  onClick
}) => {
  const { isMobile, isTablet } = useResponsiveDesign();
  const { tier } = useUserTier();
  const { canAccessFeature } = useAccessControl();
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  
  const hasAccess = canAccessFeature(feature, tier);
  
  const handleClick = (e: React.MouseEvent) => {
    if (!hasAccess) {
      e.preventDefault();
      e.stopPropagation();
      
      if (onClick) {
        onClick();
      } else {
        showSignupModal(feature);
      }
    }
  };
  
  const handleMouseEnter = (e: React.MouseEvent) => {
    if (!hasAccess && gateType === 'tooltip') {
      const rect = e.currentTarget.getBoundingClientRect();
      setTooltipPosition({
        x: rect.left + rect.width / 2,
        y: rect.top - 10
      });
      setShowTooltip(true);
    }
  };
  
  const handleMouseLeave = () => {
    setShowTooltip(false);
  };
  
  if (hasAccess) {
    return <>{children}</>;
  }
  
  const baseClassName = `visual-feature-gate ${className}`;
  
  switch (gateType) {
    case 'lock':
      return (
        <div 
          className={`${baseClassName} locked-feature lock-${lockPosition}`}
          onClick={handleClick}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {children}
          {showTooltip && tooltipText && (
            <div 
              className="feature-tooltip"
              style={{
                left: tooltipPosition.x,
                top: tooltipPosition.y,
                transform: 'translateX(-50%)'
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
          <div className="locked-overlay" onClick={handleClick}>
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
          className={`${baseClassName} disabled-button`}
          onClick={handleClick}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {children}
          {showTooltip && tooltipText && (
            <div 
              className="feature-tooltip"
              style={{
                left: tooltipPosition.x,
                top: tooltipPosition.y,
                transform: 'translateX(-50%)'
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
            <div className="mobile-gate-overlay" onClick={handleClick}>
              <div className="mobile-gate-content">
                <div className="mobile-gate-icon">🔒</div>
                <span>Tap to unlock</span>
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
        >
          {children}
        </VisualFeatureGate>
      );
      
    default:
      return <>{children}</>;
  }
};
```

#### Mobile-Specific Gate Component
```typescript
interface MobileGateProps {
  feature: string;
  children: React.ReactNode;
  fallbackGateType?: 'lock' | 'overlay' | 'disabled';
  mobileText?: string;
  tabletText?: string;
  onClick?: () => void;
}

const MobileGate: React.FC<MobileGateProps> = ({
  feature,
  children,
  fallbackGateType = 'lock',
  mobileText = 'Tap to unlock',
  tabletText = 'Click to unlock',
  onClick
}) => {
  const { isMobile, isTablet } = useResponsiveDesign();
  const { tier } = useUserTier();
  const { canAccessFeature } = useAccessControl();
  
  const hasAccess = canAccessFeature(feature, tier);
  
  if (hasAccess) {
    return <>{children}</>;
  }
  
  if (isMobile) {
    return (
      <div className="mobile-gate">
        {children}
        <div 
          className="mobile-gate-overlay" 
          onClick={onClick || (() => showSignupModal(feature))}
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
      <div className="mobile-gate">
        {children}
        <div 
          className="mobile-gate-overlay" 
          onClick={onClick || (() => showSignupModal(feature))}
        >
          <div className="mobile-gate-content">
            <div className="mobile-gate-icon">🔒</div>
            <span>{tabletText}</span>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <VisualFeatureGate
      feature={feature}
      gateType={fallbackGateType}
      onClick={onClick}
    >
      {children}
    </VisualFeatureGate>
  );
};
```

### 8.4 Tooltip System

#### Advanced Tooltip Component
```typescript
interface TooltipProps {
  content: string | React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  trigger?: 'hover' | 'click' | 'focus';
  delay?: number;
  className?: string;
  children: React.ReactNode;
}

const Tooltip: React.FC<TooltipProps> = ({
  content,
  position = 'top',
  trigger = 'hover',
  delay = 200,
  className = '',
  children
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const timeoutRef = useRef<NodeJS.Timeout>();
  const triggerRef = useRef<HTMLDivElement>(null);
  
  const showTooltip = (e: React.MouseEvent | React.FocusEvent) => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      let x = rect.left + rect.width / 2;
      let y = rect.top;
      
      switch (position) {
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
      
      setTooltipPosition({ x, y });
    }
    
    if (delay > 0) {
      timeoutRef.current = setTimeout(() => setIsVisible(true), delay);
    } else {
      setIsVisible(true);
    }
  };
  
  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };
  
  const eventHandlers = {
    hover: {
      onMouseEnter: showTooltip,
      onMouseLeave: hideTooltip
    },
    click: {
      onClick: (e: React.MouseEvent) => {
        e.preventDefault();
        setIsVisible(!isVisible);
        if (triggerRef.current) {
          const rect = triggerRef.current.getBoundingClientRect();
          setTooltipPosition({
            x: rect.left + rect.width / 2,
            y: rect.top - 10
          });
        }
      }
    },
    focus: {
      onFocus: showTooltip,
      onBlur: hideTooltip
    }
  };
  
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
  
  return (
    <div className={`tooltip-container ${className}`}>
      <div
        ref={triggerRef}
        className="tooltip-trigger"
        {...eventHandlers[trigger]}
      >
        {children}
      </div>
      
      {isVisible && (
        <div
          className={`feature-tooltip tooltip-${position}`}
          style={{
            left: tooltipPosition.x,
            top: tooltipPosition.y,
            transform: position === 'top' || position === 'bottom' 
              ? 'translateX(-50%)' 
              : 'translateY(-50%)'
          }}
        >
          {content}
        </div>
      )}
    </div>
  );
};
```

---

## 🎨 UI/UX Requirements

### Visual Consistency Guidelines

#### Color System
```css
:root {
  /* Lock colors */
  --lock-bg: rgba(0, 0, 0, 0.8);
  --lock-color: #ffffff;
  --lock-hover: rgba(0, 0, 0, 0.9);
  
  /* Disabled colors */
  --disabled-bg: #f3f4f6;
  --disabled-color: #9ca3af;
  --disabled-border: #d1d5db;
  
  /* Overlay colors */
  --overlay-bg: rgba(255, 255, 255, 0.9);
  --overlay-text: #6b7280;
  
  /* Mobile overlay colors */
  --mobile-overlay-bg: rgba(0, 0, 0, 0.1);
  --mobile-overlay-hover: rgba(0, 0, 0, 0.2);
  --mobile-overlay-text: #374151;
  
  /* Tooltip colors */
  --tooltip-bg: rgba(0, 0, 0, 0.9);
  --tooltip-color: #ffffff;
  --tooltip-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}
```

#### Typography System
```css
/* Lock icon sizes */
.lock-icon-small {
  font-size: 12px;
  width: 20px;
  height: 20px;
}

.lock-icon-medium {
  font-size: 16px;
  width: 24px;
  height: 24px;
}

.lock-icon-large {
  font-size: 20px;
  width: 32px;
  height: 32px;
}

/* Mobile text sizes */
.mobile-gate-text {
  font-size: 12px;
  font-weight: 500;
  line-height: 1.2;
}

.tablet-gate-text {
  font-size: 14px;
  font-weight: 500;
  line-height: 1.3;
}

/* Tooltip text */
.tooltip-text {
  font-size: 14px;
  line-height: 1.4;
  font-weight: 400;
}

@media (max-width: 768px) {
  .tooltip-text {
    font-size: 12px;
  }
  
  .mobile-gate-text {
    font-size: 11px;
  }
}
```

### Accessibility Requirements

#### ARIA Labels and Roles
```typescript
const AccessibleFeatureGate: React.FC<FeatureGateProps> = ({
  feature,
  children,
  gateType,
  tooltipText,
  onClick
}) => {
  const { tier } = useUserTier();
  const { canAccessFeature } = useAccessControl();
  
  const hasAccess = canAccessFeature(feature, tier);
  
  const getAriaLabel = () => {
    if (hasAccess) return undefined;
    
    switch (gateType) {
      case 'lock':
        return `Locked feature: ${tooltipText || 'Sign up to unlock'}`;
      case 'overlay':
        return `Click to unlock ${feature}`;
      case 'disabled':
        return `Disabled: ${tooltipText || 'Sign up to enable'}`;
      default:
        return `Sign up to access ${feature}`;
    }
  };
  
  const getRole = () => {
    if (hasAccess) return undefined;
    return 'button';
  };
  
  return (
    <div
      className={`accessible-feature-gate ${gateType}`}
      role={getRole()}
      aria-label={getAriaLabel()}
      tabIndex={hasAccess ? undefined : 0}
      onKeyDown={(e) => {
        if (!hasAccess && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick?.();
        }
      }}
      onClick={hasAccess ? undefined : onClick}
    >
      {children}
    </div>
  );
};
```

#### Focus Management
```css
/* Focus styles for accessible gating */
.accessible-feature-gate:focus {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}

.accessible-feature-gate:focus:not(:focus-visible) {
  outline: none;
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .locked-feature::after {
    background: #000000;
    border: 2px solid #ffffff;
  }
  
  .feature-tooltip {
    background: #000000;
    border: 2px solid #ffffff;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .locked-feature,
  .mobile-gate-overlay,
  .feature-tooltip {
    transition: none;
  }
}
```

---

## 🔧 Implementation Details

### Usage Examples

#### Button with Visual Gate
```typescript
const SaveButton = () => {
  return (
    <VisualFeatureGate
      feature="save_session"
      gateType="disabled"
      tooltipText="Sign up to save your session"
    >
      <button className="save-button">
        💾 Save Session
      </button>
    </VisualFeatureGate>
  );
};
```

#### Complex Component with Overlay
```typescript
const WaveformEditor = () => {
  return (
    <VisualFeatureGate
      feature="edit_cues"
      gateType="overlay"
    >
      <div className="waveform-editor">
        <WaveformDisplay />
        <CuePointHandles />
        <LoopRegions />
      </div>
    </VisualFeatureGate>
  );
};
```

#### Mobile-Responsive Gate
```typescript
const UploadButton = () => {
  return (
    <MobileGate
      feature="upload"
      mobileText="Tap to upload"
      tabletText="Click to upload"
    >
      <button className="upload-button">
        📁 Upload Track
      </button>
    </MobileGate>
  );
};
```

#### Tooltip Integration
```typescript
const LibraryTrack = ({ track }: { track: AudioAsset }) => {
  return (
    <div className="library-track">
      <div className="track-info">
        <h4>{track.name}</h4>
        <p>{track.genre} • {track.bpm} BPM</p>
      </div>
      
      <Tooltip
        content="Sign up to add this track to your studio"
        position="top"
        trigger="hover"
      >
        <VisualFeatureGate
          feature="add_library_track"
          gateType="lock"
        >
          <button className="add-track-button">
            ➕ Add to Studio
          </button>
        </VisualFeatureGate>
      </Tooltip>
    </div>
  );
};
```

### Responsive Behavior Configuration

#### Breakpoint-Specific Configurations
```typescript
const getGateConfigForScreen = (feature: string) => {
  const { isMobile, isTablet } = useResponsiveDesign();
  
  const configs = {
    upload: {
      mobile: { gateType: 'mobile-overlay', text: 'Tap to upload' },
      tablet: { gateType: 'mobile-overlay', text: 'Click to upload' },
      desktop: { gateType: 'disabled', tooltip: 'Sign up to upload tracks' }
    },
    save_session: {
      mobile: { gateType: 'mobile-overlay', text: 'Tap to save' },
      tablet: { gateType: 'mobile-overlay', text: 'Click to save' },
      desktop: { gateType: 'disabled', tooltip: 'Sign up to save session' }
    },
    edit_cues: {
      mobile: { gateType: 'overlay', text: 'Tap to customize' },
      tablet: { gateType: 'overlay', text: 'Click to customize' },
      desktop: { gateType: 'lock', tooltip: 'Sign up to edit cue points' }
    }
  };
  
  const config = configs[feature];
  if (!config) return { gateType: 'lock' };
  
  if (isMobile) return config.mobile;
  if (isTablet) return config.tablet;
  return config.desktop;
};
```

---

## 🧪 Testing Requirements

### Visual Regression Tests
```typescript
describe('Visual Feature Gates', () => {
  it('should render locked state correctly', () => {
    const { container } = render(
      <VisualFeatureGate feature="upload" gateType="lock">
        <button>Upload</button>
      </VisualFeatureGate>
    );
    
    expect(container.querySelector('.locked-feature')).toBeInTheDocument();
    expect(container.querySelector('.locked-feature::after')).toHaveStyle({
      content: '"🔒"'
    });
  });
  
  it('should show tooltip on hover', async () => {
    const { getByText, findByText } = render(
      <VisualFeatureGate 
        feature="upload" 
        gateType="tooltip"
        tooltipText="Sign up to upload"
      >
        <button>Upload</button>
      </VisualFeatureGate>
    );
    
    fireEvent.mouseEnter(getByText('Upload'));
    
    const tooltip = await findByText('Sign up to upload');
    expect(tooltip).toBeInTheDocument();
  });
});
```

### Responsive Behavior Tests
```typescript
describe('Responsive Design', () => {
  it('should use mobile overlay on small screens', () => {
    // Mock mobile screen size
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375
    });
    
    const { container } = render(
      <MobileGate feature="upload">
        <button>Upload</button>
      </MobileGate>
    );
    
    expect(container.querySelector('.mobile-gate-overlay')).toBeInTheDocument();
  });
  
  it('should use desktop gate on large screens', () => {
    // Mock desktop screen size
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1200
    });
    
    const { container } = render(
      <MobileGate feature="upload">
        <button>Upload</button>
      </MobileGate>
    );
    
    expect(container.querySelector('.locked-feature')).toBeInTheDocument();
  });
});
```

### Accessibility Tests
```typescript
describe('Accessibility', () => {
  it('should have proper ARIA labels', () => {
    const { getByRole } = render(
      <AccessibleFeatureGate feature="upload" gateType="lock">
        <button>Upload</button>
      </AccessibleFeatureGate>
    );
    
    const button = getByRole('button');
    expect(button).toHaveAttribute('aria-label');
  });
  
  it('should be keyboard navigable', () => {
    const { getByRole } = render(
      <AccessibleFeatureGate feature="upload" gateType="lock">
        <button>Upload</button>
      </AccessibleFeatureGate>
    );
    
    const button = getByRole('button');
    fireEvent.keyDown(button, { key: 'Enter' });
    
    // Should trigger the gate action
    expect(mockShowSignupModal).toHaveBeenCalledWith('upload');
  });
});
```

---

## 📊 Analytics Events

### Visual Interaction Events
```typescript
interface VisualGateEvents {
  'gate_hovered': { feature: string; gateType: string; userTier: string };
  'gate_clicked': { feature: string; gateType: string; userTier: string };
  'tooltip_shown': { feature: string; tooltipText: string; userTier: string };
  'mobile_gate_tapped': { feature: string; screenSize: string; userTier: string };
}

const trackGateInteraction = (event: keyof VisualGateEvents, properties: any) => {
  const analytics = AnalyticsService.getInstance();
  analytics.track(event, {
    ...properties,
    timestamp: Date.now(),
    sessionId: analytics.getSessionId()
  });
};
```

---

## 🚀 Success Criteria

- [ ] All gated features have clear visual indicators
- [ ] Mobile and desktop gating behaviors are optimized for each platform
- [ ] Tooltips provide helpful context without being intrusive
- [ ] Accessibility standards are met for all gating elements
- [ ] Visual consistency is maintained across all screen sizes
- [ ] Performance impact of visual gating is minimal
- [ ] Users can easily understand what features are locked
- [ ] Gating interactions feel natural and intuitive
- [ ] High contrast and reduced motion preferences are respected
- [ ] All gating elements are keyboard navigable

---

## 🔄 Dependencies & Integration

### Input Dependencies
- PRD 2: Feature Gating Architecture (for access control logic)
- PRD 4: Library Panel & Gated Actions (for UI integration)
- PRD 5: Upload/Save/Record/Download Gate (for UI integration)

### Output Dependencies
- PRD 9: Post-Signup Experience Continuity (for visual state updates)
- PRD 10: Performance & Error Monitoring (for performance tracking)

### Integration Points
- Feature gate components for visual styling
- Responsive design system for breakpoint management
- Accessibility system for ARIA labels and keyboard navigation
- Analytics system for interaction tracking
- CSS-in-JS or styled-components for dynamic styling
- Design system tokens for consistent theming 