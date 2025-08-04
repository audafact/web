# 🔒 PRD 2: Feature Gating Architecture

## 📋 Overview

**Scope:** `useUserTier` hook (guest/free/pro), central access control logic (`AccessService`), `FeatureGate` component (modal/tooltip/disabled/hidden types)

**Dependencies:** PRD 1 (for user context integration)  
**Parallelizable:** Yes  
**Estimated Timeline:** 1-2 weeks

---

## 🎯 Objectives

- Establish centralized user tier management system
- Create flexible feature gating architecture
- Provide reusable gate components for different UX patterns
- Enable consistent access control across the application

---

## 🏗️ Technical Requirements

### 2.1 User Access Tiers

#### Tier Definition
```typescript
interface UserTier {
  id: 'guest' | 'free' | 'pro';
  name: string;
  features: FeatureAccess;
  limits: UsageLimits;
}

interface FeatureAccess {
  canUpload: boolean;
  canSaveSession: boolean;
  canRecord: boolean;
  canDownload: boolean;
  canEditCues: boolean;
  canEditLoops: boolean;
  canBrowseLibrary: boolean;
  canAccessProTracks: boolean;
}

interface UsageLimits {
  maxUploads: number;
  maxSessions: number;
  maxRecordings: number;
  maxLibraryTracks: number;
}
```

#### Tier Configuration
```typescript
const GUEST_FEATURES: FeatureAccess = {
  canUpload: false,
  canSaveSession: false,
  canRecord: false,
  canDownload: false,
  canEditCues: false,
  canEditLoops: false,
  canBrowseLibrary: true, // View only
  canAccessProTracks: false
};

const FREE_FEATURES: FeatureAccess = {
  canUpload: true,
  canSaveSession: true,
  canRecord: false,
  canDownload: false,
  canEditCues: true,
  canEditLoops: true,
  canBrowseLibrary: true,
  canAccessProTracks: false
};

const PRO_FEATURES: FeatureAccess = {
  canUpload: true,
  canSaveSession: true,
  canRecord: true,
  canDownload: true,
  canEditCues: true,
  canEditLoops: true,
  canBrowseLibrary: true,
  canAccessProTracks: true
};

const GUEST_LIMITS: UsageLimits = {
  maxUploads: 0,
  maxSessions: 0,
  maxRecordings: 0,
  maxLibraryTracks: 10
};

const FREE_LIMITS: UsageLimits = {
  maxUploads: 3,
  maxSessions: 2,
  maxRecordings: 1,
  maxLibraryTracks: 10
};

const PRO_LIMITS: UsageLimits = {
  maxUploads: Infinity,
  maxSessions: Infinity,
  maxRecordings: Infinity,
  maxLibraryTracks: Infinity
};
```

### 2.2 User Tier Hook

```typescript
const useUserTier = () => {
  const { user } = useAuth();
  
  const getUserTier = (): UserTier => {
    if (!user) {
      return { 
        id: 'guest', 
        name: 'Guest', 
        features: GUEST_FEATURES, 
        limits: GUEST_LIMITS 
      };
    }
    
    if (user.subscription_tier === 'pro') {
      return { 
        id: 'pro', 
        name: 'Pro Creator', 
        features: PRO_FEATURES, 
        limits: PRO_LIMITS 
      };
    }
    
    return { 
      id: 'free', 
      name: 'Free User', 
      features: FREE_FEATURES, 
      limits: FREE_LIMITS 
    };
  };
  
  const tier = getUserTier();
  
  return {
    tier,
    isGuest: tier.id === 'guest',
    isFree: tier.id === 'free',
    isPro: tier.id === 'pro',
    features: tier.features,
    limits: tier.limits
  };
};
```

### 2.3 Enhanced Access Service

```typescript
class EnhancedAccessService extends AccessService {
  static canAccessFeature(feature: string, tier: UserTier): boolean {
    const featureAccess = {
      upload: tier.features.canUpload,
      save_session: tier.features.canSaveSession,
      record: tier.features.canRecord,
      download: tier.features.canDownload,
      edit_cues: tier.features.canEditCues,
      edit_loops: tier.features.canEditLoops,
      browse_library: tier.features.canBrowseLibrary,
      access_pro_tracks: tier.features.canAccessProTracks
    };
    
    return featureAccess[feature] || false;
  }
  
  static getFeatureGateConfig(feature: string): FeatureGateConfig {
    const configs = {
      upload: {
        gateType: 'modal',
        message: "🎧 Ready to remix your own sounds?",
        ctaText: "Sign up to upload tracks",
        upgradeRequired: false
      },
      save_session: {
        gateType: 'modal',
        message: "💾 Don't lose your work",
        ctaText: "Sign up to save session",
        upgradeRequired: false
      },
      record: {
        gateType: 'modal',
        message: "🎙 Record and export your performances",
        ctaText: "Upgrade to Pro Creator",
        upgradeRequired: true
      },
      download: {
        gateType: 'modal',
        message: "💿 Download your recordings",
        ctaText: "Upgrade to Pro Creator",
        upgradeRequired: true
      },
      edit_cues: {
        gateType: 'tooltip',
        message: "Sign up to customize cue points",
        ctaText: "Sign up now",
        upgradeRequired: false
      },
      edit_loops: {
        gateType: 'tooltip',
        message: "Sign up to set custom loops",
        ctaText: "Sign up now",
        upgradeRequired: false
      }
    };
    
    return configs[feature] || {
      gateType: 'modal',
      message: "Upgrade to unlock this feature",
      ctaText: "Upgrade now",
      upgradeRequired: true
    };
  }
  
  static async checkUsageLimits(userId: string, tier: UserTier, action: string): Promise<boolean> {
    if (tier.id === 'pro') return true; // No limits for pro users
    
    const limits = tier.limits;
    
    switch (action) {
      case 'upload':
        const uploadCount = await this.getUserUploadCount(userId);
        return uploadCount < limits.maxUploads;
      
      case 'save_session':
        const sessionCount = await this.getUserSessionCount(userId);
        return sessionCount < limits.maxSessions;
      
      case 'record':
        const recordingCount = await this.getUserRecordingCount(userId);
        return recordingCount < limits.maxRecordings;
      
      default:
        return true;
    }
  }
}
```

### 2.4 Feature Gate Component System

```typescript
interface FeatureGateProps {
  feature: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  gateType?: 'modal' | 'tooltip' | 'disabled' | 'hidden';
  onGateTrigger?: (feature: string) => void;
}

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
```

### 2.5 Gate Type Components

#### Modal Gate
```typescript
const ModalGate: React.FC<{ feature: string; children: React.ReactNode; onTrigger: () => void }> = ({ 
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
```

#### Tooltip Gate
```typescript
const TooltipGate: React.FC<{ feature: string; children: React.ReactNode; onTrigger: () => void }> = ({ 
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
```

---

## 🎨 UI/UX Requirements

### Visual Design System

#### Feature Gate Visual Indicators
```css
/* Locked feature styling */
.locked-feature {
  opacity: 0.6;
  cursor: not-allowed;
  position: relative;
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
}

/* Disabled button styling */
.disabled-button {
  background: #f3f4f6;
  color: #9ca3af;
  border: 1px solid #d1d5db;
  cursor: not-allowed;
}

.disabled-button:hover {
  background: #f3f4f6;
  transform: none;
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
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-top: 4px;
}

.feature-tooltip::before {
  content: '';
  position: absolute;
  top: -4px;
  left: 50%;
  transform: translateX(-50%);
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  border-bottom: 4px solid rgba(0, 0, 0, 0.9);
}

/* Modal gate styling */
.modal-gate {
  cursor: pointer;
  transition: opacity 0.2s;
}

.modal-gate:hover {
  opacity: 0.8;
}
```

---

## 🔧 Implementation Details

### Access Control Hook Enhancement
```typescript
export const useAccessControl = () => {
  const { user } = useAuth();
  const { tier } = useUserTier();
  const [accessStatus, setAccessStatus] = useState<AccessStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshAccessStatus = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const status = await EnhancedAccessService.getUserAccessStatus(user.id, tier);
      setAccessStatus(status);
    } catch (error) {
      console.error('Error fetching access status:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshAccessStatus();
  }, [user?.id, tier.id]);

  const canAccessFeature = (feature: string): boolean => {
    return EnhancedAccessService.canAccessFeature(feature, tier);
  };

  const canPerformAction = async (action: 'upload' | 'save_session' | 'record' | 'add_library_track' | 'download'): Promise<boolean> => {
    if (!user?.id) return false;
    
    const hasFeatureAccess = canAccessFeature(action);
    if (!hasFeatureAccess) return false;
    
    return EnhancedAccessService.checkUsageLimits(user.id, tier, action);
  };

  const getUpgradeMessage = (action: string): string => {
    const config = EnhancedAccessService.getFeatureGateConfig(action);
    return config.message;
  };

  return {
    accessStatus,
    loading,
    refreshAccessStatus,
    canAccessFeature,
    canPerformAction,
    getUpgradeMessage,
    tier
  };
};
```

### Feature Gate Usage Examples

#### Upload Button
```typescript
const UploadButton = () => {
  return (
    <FeatureGate feature="upload" gateType="modal">
      <button className="upload-button">
        📁 Upload Track
      </button>
    </FeatureGate>
  );
};
```

#### Save Session Button
```typescript
const SaveSessionButton = () => {
  const { canAccessFeature } = useAccessControl();
  
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
```

#### Cue Point Editing
```typescript
const CuePointHandle = ({ cue, onDrag }: CuePointProps) => {
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
```

---

## 🧪 Testing Requirements

### Unit Tests
```typescript
describe('Feature Gating Architecture', () => {
  describe('useUserTier', () => {
    it('should return guest tier for anonymous users', () => {
      const { result } = renderHook(() => useUserTier(), {
        wrapper: ({ children }) => (
          <AuthProvider>
            {children}
          </AuthProvider>
        )
      });
      
      expect(result.current.tier.id).toBe('guest');
      expect(result.current.isGuest).toBe(true);
    });
    
    it('should return pro tier for pro users', () => {
      // Mock user with pro subscription
      const { result } = renderHook(() => useUserTier(), {
        wrapper: ({ children }) => (
          <AuthProvider>
            {children}
          </AuthProvider>
        )
      });
      
      expect(result.current.tier.id).toBe('pro');
      expect(result.current.isPro).toBe(true);
    });
  });
  
  describe('FeatureGate Component', () => {
    it('should render children for users with access', () => {
      const { getByText } = render(
        <FeatureGate feature="upload">
          <button>Upload</button>
        </FeatureGate>
      );
      
      expect(getByText('Upload')).toBeInTheDocument();
    });
    
    it('should show modal gate for users without access', () => {
      const { getByText } = render(
        <FeatureGate feature="upload">
          <button>Upload</button>
        </FeatureGate>
      );
      
      fireEvent.click(getByText('Upload'));
      expect(getByText('Sign up to upload tracks')).toBeInTheDocument();
    });
  });
  
  describe('EnhancedAccessService', () => {
    it('should allow pro users to access all features', () => {
      const proTier = { 
        id: 'pro', 
        name: 'Pro Creator',
        features: PRO_FEATURES,
        limits: PRO_LIMITS
      };
      
      expect(EnhancedAccessService.canAccessFeature('upload', proTier)).toBe(true);
      expect(EnhancedAccessService.canAccessFeature('record', proTier)).toBe(true);
      expect(EnhancedAccessService.canAccessFeature('download', proTier)).toBe(true);
    });
    
    it('should restrict guest users appropriately', () => {
      const guestTier = { 
        id: 'guest', 
        name: 'Guest',
        features: GUEST_FEATURES,
        limits: GUEST_LIMITS
      };
      
      expect(EnhancedAccessService.canAccessFeature('upload', guestTier)).toBe(false);
      expect(EnhancedAccessService.canAccessFeature('save_session', guestTier)).toBe(false);
      expect(EnhancedAccessService.canAccessFeature('browse_library', guestTier)).toBe(true);
    });
  });
});
```

---

## 📊 Analytics Events

### Feature Gate Events
```typescript
interface FeatureGateEvents {
  'feature_gate_clicked': { feature: string; userTier: string; gateType: string };
  'feature_access_denied': { feature: string; userTier: string; reason: string };
  'usage_limit_reached': { action: string; userTier: string; limit: number };
}
```

---

## 🚀 Success Criteria

- [ ] `useUserTier` hook correctly identifies user tiers
- [ ] `EnhancedAccessService` provides accurate feature access control
- [ ] `FeatureGate` component renders appropriate gate types
- [ ] Visual indicators clearly show locked/disabled features
- [ ] Tooltip gates show contextual messages on hover
- [ ] Modal gates trigger signup/upgrade flows
- [ ] Usage limits are enforced for free users
- [ ] Analytics events are tracked for gate interactions

---

## 🔄 Dependencies & Integration

### Input Dependencies
- PRD 1: Demo Mode Foundation (for user context integration)

### Output Dependencies
- PRD 3: Signup Flow & Modal Triggers (for modal gate integration)
- PRD 4: Library Panel & Gated Actions (for library access control)
- PRD 5: Upload / Save / Record / Download Gate (for specific feature gates)
- PRD 6: Analytics & Funnel Tracking (for gate event tracking)

### Integration Points
- `useAuth` hook for user authentication state
- `AccessService` for existing access control logic
- Modal system for signup/upgrade flows
- Analytics service for gate interaction tracking 