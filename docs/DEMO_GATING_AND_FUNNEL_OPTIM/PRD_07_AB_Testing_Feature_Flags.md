# 🧪 PRD 7: A/B Testing & Feature Flags

## 📋 Overview

**Scope:** A/B test configuration and rollout logic, variant distribution by hash, feature flag system with tier targeting

**Dependencies:** PRD 2 (access gates), PRD 3 (copy testing), PRD 6 (analytics)  
**Parallelizable:** Mostly  
**Estimated Timeline:** 1-2 weeks

---

## 🎯 Objectives

- Enable data-driven optimization through A/B testing
- Provide flexible feature rollout and targeting capabilities
- Support gradual feature releases and rollbacks
- Enable copy and UX optimization experiments

---

## 🏗️ Technical Requirements

### 7.1 A/B Testing Framework

#### Test Configuration Schema
```typescript
interface ABTestConfig {
  id: string;
  name: string;
  description: string;
  variants: ABTestVariant[];
  trafficSplit: number; // percentage
  targetAudience: 'all' | 'guests' | 'free' | 'pro';
  startDate: Date;
  endDate?: Date;
  isActive: boolean;
  metrics: string[];
  minimumSampleSize: number;
}

interface ABTestVariant {
  id: string;
  name: string;
  weight: number; // percentage of traffic
  config: Record<string, any>;
}

interface ABTestResult {
  testId: string;
  variantId: string;
  userId?: string;
  sessionId: string;
  timestamp: number;
  userTier: string;
}
```

#### A/B Testing Service
```typescript
class ABTestingService {
  private static instance: ABTestingService;
  private tests: Map<string, ABTestConfig> = new Map();
  private userAssignments: Map<string, Map<string, string>> = new Map(); // userId -> testId -> variantId
  private analytics: AnalyticsService;
  
  private constructor() {
    this.analytics = AnalyticsService.getInstance();
    this.loadTests();
    this.loadUserAssignments();
  }
  
  static getInstance(): ABTestingService {
    if (!ABTestingService.instance) {
      ABTestingService.instance = new ABTestingService();
    }
    return ABTestingService.instance;
  }
  
  registerTest(test: ABTestConfig) {
    this.tests.set(test.id, test);
    this.saveTests();
  }
  
  getVariant(testId: string, userId?: string): ABTestVariant | null {
    const test = this.tests.get(testId);
    if (!test || !test.isActive) return null;
    
    // Check if test is within date range
    const now = new Date();
    if (now < test.startDate || (test.endDate && now > test.endDate)) {
      return null;
    }
    
    // Check audience targeting
    const userTier = getCurrentUserTier();
    if (test.targetAudience !== 'all' && test.targetAudience !== userTier) {
      return null;
    }
    
    // Get or create user assignment
    const assignmentKey = userId || this.getAnonymousId();
    let userTests = this.userAssignments.get(assignmentKey);
    
    if (!userTests) {
      userTests = new Map();
      this.userAssignments.set(assignmentKey, userTests);
    }
    
    let variantId = userTests.get(testId);
    
    if (!variantId) {
      // Assign user to variant based on weight distribution
      variantId = this.assignVariant(test);
      userTests.set(testId, variantId);
      this.saveUserAssignments();
      
      // Track assignment
      this.trackAssignment(testId, variantId, userId);
    }
    
    return test.variants.find(v => v.id === variantId) || null;
  }
  
  private assignVariant(test: ABTestConfig): string {
    const random = Math.random() * 100;
    let cumulativeWeight = 0;
    
    for (const variant of test.variants) {
      cumulativeWeight += variant.weight;
      if (random <= cumulativeWeight) {
        return variant.id;
      }
    }
    
    // Fallback to first variant
    return test.variants[0].id;
  }
  
  private getAnonymousId(): string {
    let anonymousId = localStorage.getItem('anonymous_id');
    if (!anonymousId) {
      anonymousId = `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('anonymous_id', anonymousId);
    }
    return anonymousId;
  }
  
  private trackAssignment(testId: string, variantId: string, userId?: string) {
    this.analytics.track('ab_test_assigned', {
      testId,
      variantId,
      userId,
      userTier: getCurrentUserTier(),
      sessionId: this.analytics.getSessionId()
    });
  }
  
  trackConversion(testId: string, conversionType: string, value?: number) {
    const assignmentKey = this.getCurrentUserId() || this.getAnonymousId();
    const userTests = this.userAssignments.get(assignmentKey);
    const variantId = userTests?.get(testId);
    
    if (variantId) {
      this.analytics.track('ab_test_conversion', {
        testId,
        variantId,
        conversionType,
        value,
        userTier: getCurrentUserTier(),
        sessionId: this.analytics.getSessionId()
      });
    }
  }
  
  private loadTests() {
    try {
      const stored = localStorage.getItem('ab_tests');
      if (stored) {
        const tests = JSON.parse(stored);
        tests.forEach((test: ABTestConfig) => {
          this.tests.set(test.id, test);
        });
      }
    } catch (error) {
      console.error('Failed to load A/B tests:', error);
    }
  }
  
  private saveTests() {
    try {
      const tests = Array.from(this.tests.values());
      localStorage.setItem('ab_tests', JSON.stringify(tests));
    } catch (error) {
      console.error('Failed to save A/B tests:', error);
    }
  }
  
  private loadUserAssignments() {
    try {
      const stored = localStorage.getItem('ab_test_assignments');
      if (stored) {
        const assignments = JSON.parse(stored);
        Object.entries(assignments).forEach(([userId, tests]) => {
          this.userAssignments.set(userId, new Map(Object.entries(tests)));
        });
      }
    } catch (error) {
      console.error('Failed to load A/B test assignments:', error);
    }
  }
  
  private saveUserAssignments() {
    try {
      const assignments: Record<string, Record<string, string>> = {};
      this.userAssignments.forEach((tests, userId) => {
        assignments[userId] = Object.fromEntries(tests);
      });
      localStorage.setItem('ab_test_assignments', JSON.stringify(assignments));
    } catch (error) {
      console.error('Failed to save A/B test assignments:', error);
    }
  }
  
  getCurrentUserId(): string | undefined {
    // Get current user ID from auth system
    return localStorage.getItem('user_id') || undefined;
  }
}
```

### 7.2 Feature Flag System

#### Feature Flag Configuration
```typescript
interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  rolloutPercentage: number;
  targetAudience: 'all' | 'guests' | 'free' | 'pro';
  startDate: Date;
  endDate?: Date;
  conditions?: FeatureFlagCondition[];
}

interface FeatureFlagCondition {
  type: 'user_tier' | 'user_id' | 'session_count' | 'custom';
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains';
  value: any;
}

class FeatureFlagService {
  private static instance: FeatureFlagService;
  private flags: Map<string, FeatureFlag> = new Map();
  private userEligibility: Map<string, Set<string>> = new Map(); // userId -> flagIds
  
  private constructor() {
    this.loadFlags();
  }
  
  static getInstance(): FeatureFlagService {
    if (!FeatureFlagService.instance) {
      FeatureFlagService.instance = new FeatureFlagService();
    }
    return FeatureFlagService.instance;
  }
  
  isEnabled(flagId: string, userId?: string): boolean {
    const flag = this.flags.get(flagId);
    if (!flag) return false;
    
    if (!flag.enabled) return false;
    
    // Check date range
    const now = new Date();
    if (now < flag.startDate || (flag.endDate && now > flag.endDate)) {
      return false;
    }
    
    // Check audience targeting
    const userTier = getCurrentUserTier();
    if (flag.targetAudience !== 'all' && flag.targetAudience !== userTier) {
      return false;
    }
    
    // Check custom conditions
    if (flag.conditions && !this.evaluateConditions(flag.conditions, userId)) {
      return false;
    }
    
    // Check rollout percentage
    const assignmentKey = userId || this.getAnonymousId();
    const hash = this.hashString(assignmentKey + flagId);
    const isInRollout = (hash % 100) < flag.rolloutPercentage;
    
    if (isInRollout) {
      this.trackFlagAccess(flagId, userId, true);
      return true;
    }
    
    this.trackFlagAccess(flagId, userId, false);
    return false;
  }
  
  private evaluateConditions(conditions: FeatureFlagCondition[], userId?: string): boolean {
    return conditions.every(condition => {
      switch (condition.type) {
        case 'user_tier':
          const userTier = getCurrentUserTier();
          return this.evaluateCondition(userTier, condition);
        
        case 'user_id':
          return this.evaluateCondition(userId, condition);
        
        case 'session_count':
          const sessionCount = this.getSessionCount(userId);
          return this.evaluateCondition(sessionCount, condition);
        
        case 'custom':
          return this.evaluateCustomCondition(condition, userId);
        
        default:
          return true;
      }
    });
  }
  
  private evaluateCondition(value: any, condition: FeatureFlagCondition): boolean {
    switch (condition.operator) {
      case 'equals':
        return value === condition.value;
      case 'not_equals':
        return value !== condition.value;
      case 'greater_than':
        return value > condition.value;
      case 'less_than':
        return value < condition.value;
      case 'contains':
        return String(value).includes(String(condition.value));
      default:
        return true;
    }
  }
  
  private evaluateCustomCondition(condition: FeatureFlagCondition, userId?: string): boolean {
    // Implementation for custom conditions
    return true;
  }
  
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
  
  private getAnonymousId(): string {
    let anonymousId = localStorage.getItem('anonymous_id');
    if (!anonymousId) {
      anonymousId = `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('anonymous_id', anonymousId);
    }
    return anonymousId;
  }
  
  private getSessionCount(userId?: string): number {
    // Implementation to get user's session count
    return 0;
  }
  
  private trackFlagAccess(flagId: string, userId?: string, enabled: boolean) {
    const analytics = AnalyticsService.getInstance();
    analytics.track('feature_flag_accessed', {
      flagId,
      enabled,
      userId,
      userTier: getCurrentUserTier(),
      sessionId: analytics.getSessionId()
    });
  }
  
  private loadFlags() {
    try {
      const stored = localStorage.getItem('feature_flags');
      if (stored) {
        const flags = JSON.parse(stored);
        flags.forEach((flag: FeatureFlag) => {
          this.flags.set(flag.id, flag);
        });
      }
    } catch (error) {
      console.error('Failed to load feature flags:', error);
    }
  }
}
```

### 7.3 A/B Testing Hooks

#### A/B Testing Hook
```typescript
const useABTest = (testId: string) => {
  const [variant, setVariant] = useState<ABTestVariant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  
  useEffect(() => {
    const abTesting = ABTestingService.getInstance();
    const testVariant = abTesting.getVariant(testId, user?.id);
    setVariant(testVariant);
    setIsLoading(false);
  }, [testId, user?.id]);
  
  const trackConversion = useCallback((conversionType: string, value?: number) => {
    const abTesting = ABTestingService.getInstance();
    abTesting.trackConversion(testId, conversionType, value);
  }, [testId]);
  
  return {
    variant,
    isLoading,
    trackConversion,
    isInTest: !!variant
  };
};
```

#### Feature Flag Hook
```typescript
const useFeatureFlag = (flagId: string) => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  
  useEffect(() => {
    const featureFlags = FeatureFlagService.getInstance();
    const enabled = featureFlags.isEnabled(flagId, user?.id);
    setIsEnabled(enabled);
    setIsLoading(false);
  }, [flagId, user?.id]);
  
  return {
    isEnabled,
    isLoading
  };
};
```

---

## 🎨 UI/UX Requirements

### A/B Test Configuration UI

```typescript
interface ABTestConfiguratorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (test: ABTestConfig) => void;
  existingTest?: ABTestConfig;
}

const ABTestConfigurator: React.FC<ABTestConfiguratorProps> = ({
  isOpen,
  onClose,
  onSave,
  existingTest
}) => {
  const [testConfig, setTestConfig] = useState<ABTestConfig>(
    existingTest || {
      id: '',
      name: '',
      description: '',
      variants: [
        { id: 'control', name: 'Control', weight: 50, config: {} },
        { id: 'variant_a', name: 'Variant A', weight: 50, config: {} }
      ],
      trafficSplit: 100,
      targetAudience: 'all',
      startDate: new Date(),
      isActive: false,
      metrics: [],
      minimumSampleSize: 1000
    }
  );
  
  const handleSave = () => {
    onSave(testConfig);
    onClose();
  };
  
  const addVariant = () => {
    const newVariant: ABTestVariant = {
      id: `variant_${Date.now()}`,
      name: `Variant ${testConfig.variants.length}`,
      weight: 0,
      config: {}
    };
    
    setTestConfig(prev => ({
      ...prev,
      variants: [...prev.variants, newVariant]
    }));
  };
  
  const updateVariant = (index: number, updates: Partial<ABTestVariant>) => {
    setTestConfig(prev => ({
      ...prev,
      variants: prev.variants.map((variant, i) => 
        i === index ? { ...variant, ...updates } : variant
      )
    }));
  };
  
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="ab-test-configurator">
        <div className="configurator-header">
          <h2>{existingTest ? 'Edit A/B Test' : 'Create A/B Test'}</h2>
          <button onClick={onClose} className="close-button">✕</button>
        </div>
        
        <div className="configurator-content">
          <div className="form-section">
            <h3>Basic Information</h3>
            
            <div className="form-group">
              <label>Test ID</label>
              <input
                type="text"
                value={testConfig.id}
                onChange={(e) => setTestConfig(prev => ({ ...prev, id: e.target.value }))}
                placeholder="e.g., signup_modal_copy"
              />
            </div>
            
            <div className="form-group">
              <label>Test Name</label>
              <input
                type="text"
                value={testConfig.name}
                onChange={(e) => setTestConfig(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Signup Modal Copy Test"
              />
            </div>
            
            <div className="form-group">
              <label>Description</label>
              <textarea
                value={testConfig.description}
                onChange={(e) => setTestConfig(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe what this test is trying to achieve"
                rows={3}
              />
            </div>
          </div>
          
          <div className="form-section">
            <h3>Targeting</h3>
            
            <div className="form-group">
              <label>Target Audience</label>
              <select
                value={testConfig.targetAudience}
                onChange={(e) => setTestConfig(prev => ({ 
                  ...prev, 
                  targetAudience: e.target.value as any 
                }))}
              >
                <option value="all">All Users</option>
                <option value="guests">Guest Users Only</option>
                <option value="free">Free Users Only</option>
                <option value="pro">Pro Users Only</option>
              </select>
            </div>
            
            <div className="form-group">
              <label>Traffic Split (%)</label>
              <input
                type="number"
                min="1"
                max="100"
                value={testConfig.trafficSplit}
                onChange={(e) => setTestConfig(prev => ({ 
                  ...prev, 
                  trafficSplit: parseInt(e.target.value) 
                }))}
              />
            </div>
          </div>
          
          <div className="form-section">
            <h3>Variants</h3>
            
            {testConfig.variants.map((variant, index) => (
              <div key={variant.id} className="variant-config">
                <div className="variant-header">
                  <h4>Variant {index + 1}</h4>
                  {index > 0 && (
                    <button
                      onClick={() => {
                        setTestConfig(prev => ({
                          ...prev,
                          variants: prev.variants.filter((_, i) => i !== index)
                        }));
                      }}
                      className="remove-variant"
                    >
                      Remove
                    </button>
                  )}
                </div>
                
                <div className="variant-fields">
                  <div className="form-group">
                    <label>Name</label>
                    <input
                      type="text"
                      value={variant.name}
                      onChange={(e) => updateVariant(index, { name: e.target.value })}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Weight (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={variant.weight}
                      onChange={(e) => updateVariant(index, { weight: parseInt(e.target.value) })}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Configuration (JSON)</label>
                    <textarea
                      value={JSON.stringify(variant.config, null, 2)}
                      onChange={(e) => {
                        try {
                          const config = JSON.parse(e.target.value);
                          updateVariant(index, { config });
                        } catch (error) {
                          // Invalid JSON, ignore
                        }
                      }}
                      placeholder="{}"
                      rows={4}
                    />
                  </div>
                </div>
              </div>
            ))}
            
            <button onClick={addVariant} className="add-variant-button">
              + Add Variant
            </button>
          </div>
          
          <div className="form-section">
            <h3>Settings</h3>
            
            <div className="form-group">
              <label>Start Date</label>
              <input
                type="datetime-local"
                value={testConfig.startDate.toISOString().slice(0, 16)}
                onChange={(e) => setTestConfig(prev => ({ 
                  ...prev, 
                  startDate: new Date(e.target.value) 
                }))}
              />
            </div>
            
            <div className="form-group">
              <label>End Date (Optional)</label>
              <input
                type="datetime-local"
                value={testConfig.endDate?.toISOString().slice(0, 16) || ''}
                onChange={(e) => setTestConfig(prev => ({ 
                  ...prev, 
                  endDate: e.target.value ? new Date(e.target.value) : undefined 
                }))}
              />
            </div>
            
            <div className="form-group">
              <label>Minimum Sample Size</label>
              <input
                type="number"
                min="100"
                value={testConfig.minimumSampleSize}
                onChange={(e) => setTestConfig(prev => ({ 
                  ...prev, 
                  minimumSampleSize: parseInt(e.target.value) 
                }))}
              />
            </div>
            
            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={testConfig.isActive}
                  onChange={(e) => setTestConfig(prev => ({ 
                    ...prev, 
                    isActive: e.target.checked 
                  }))}
                />
                Active
              </label>
            </div>
          </div>
        </div>
        
        <div className="configurator-footer">
          <button onClick={onClose} className="cancel-button">
            Cancel
          </button>
          <button onClick={handleSave} className="save-button">
            {existingTest ? 'Update Test' : 'Create Test'}
          </button>
        </div>
      </div>
    </Modal>
  );
};
```

### A/B Test Configurator Styling

```css
/* A/B Test Configurator */
.ab-test-configurator {
  background: white;
  border-radius: 12px;
  padding: 24px;
  max-width: 800px;
  width: 90vw;
  max-height: 90vh;
  overflow-y: auto;
}

.configurator-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid #e5e7eb;
}

.configurator-header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #1f2937;
}

.close-button {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: #6b7280;
  padding: 4px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.close-button:hover {
  background: #e5e7eb;
}

/* Form sections */
.form-section {
  margin-bottom: 32px;
}

.form-section h3 {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
  color: #374151;
  padding-bottom: 8px;
  border-bottom: 1px solid #f3f4f6;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-size: 14px;
  font-weight: 500;
  color: #374151;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.2s;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #3b82f6;
}

.form-group textarea {
  resize: vertical;
  min-height: 80px;
}

/* Variant configuration */
.variant-config {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
}

.variant-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.variant-header h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}

.remove-variant {
  background: #ef4444;
  color: white;
  border: none;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.remove-variant:hover {
  background: #dc2626;
}

.variant-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.variant-fields .form-group:last-child {
  grid-column: 1 / -1;
}

.add-variant-button {
  background: #10b981;
  color: white;
  border: none;
  padding: 12px 20px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
  width: 100%;
}

.add-variant-button:hover {
  background: #059669;
}

/* Footer */
.configurator-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid #e5e7eb;
}

.cancel-button {
  background: #f3f4f6;
  color: #374151;
  border: 1px solid #d1d5db;
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.cancel-button:hover {
  background: #e5e7eb;
}

.save-button {
  background: #3b82f6;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.save-button:hover {
  background: #2563eb;
}
```

---

## 🔧 Implementation Details

### A/B Test Usage Examples

#### Signup Modal Copy Test
```typescript
const SignupModalWithABTest: React.FC<SignupModalProps> = (props) => {
  const { variant, trackConversion } = useABTest('signup_modal_copy');
  
  const getModalConfig = () => {
    if (!variant) return SIGNUP_MODAL_CONFIGS[props.trigger];
    
    const config = SIGNUP_MODAL_CONFIGS[props.trigger];
    return {
      ...config,
      ...variant.config
    };
  };
  
  const handleSignup = async (method: 'email' | 'google') => {
    // Existing signup logic
    
    // Track conversion
    trackConversion('signup_completed', 1);
  };
  
  const config = getModalConfig();
  
  return (
    <SignupModal
      {...props}
      title={config.title}
      message={config.message}
      ctaText={config.ctaText}
      onSignup={handleSignup}
    />
  );
};
```

#### Feature Flag Usage
```typescript
const NewFeatureComponent: React.FC = () => {
  const { isEnabled } = useFeatureFlag('new_feature_v2');
  
  if (!isEnabled) {
    return <LegacyFeatureComponent />;
  }
  
  return <NewFeatureV2Component />;
};
```

---

## 🧪 Testing Requirements

### Unit Tests
```typescript
describe('A/B Testing & Feature Flags', () => {
  describe('ABTestingService', () => {
    beforeEach(() => {
      (ABTestingService as any).instance = null;
      localStorage.clear();
    });
    
    it('should assign users to variants consistently', () => {
      const abTesting = ABTestingService.getInstance();
      
      const test: ABTestConfig = {
        id: 'test_1',
        name: 'Test 1',
        description: 'Test description',
        variants: [
          { id: 'control', name: 'Control', weight: 50, config: {} },
          { id: 'variant_a', name: 'Variant A', weight: 50, config: {} }
        ],
        trafficSplit: 100,
        targetAudience: 'all',
        startDate: new Date(),
        isActive: true,
        metrics: [],
        minimumSampleSize: 1000
      };
      
      abTesting.registerTest(test);
      
      const variant1 = abTesting.getVariant('test_1', 'user1');
      const variant2 = abTesting.getVariant('test_1', 'user1');
      
      expect(variant1).toEqual(variant2);
    });
    
    it('should respect audience targeting', () => {
      const abTesting = ABTestingService.getInstance();
      
      const test: ABTestConfig = {
        id: 'test_2',
        name: 'Test 2',
        description: 'Test description',
        variants: [
          { id: 'control', name: 'Control', weight: 100, config: {} }
        ],
        trafficSplit: 100,
        targetAudience: 'pro',
        startDate: new Date(),
        isActive: true,
        metrics: [],
        minimumSampleSize: 1000
      };
      
      abTesting.registerTest(test);
      
      // Mock guest user
      const variant = abTesting.getVariant('test_2', 'guest_user');
      expect(variant).toBeNull();
    });
  });
  
  describe('FeatureFlagService', () => {
    beforeEach(() => {
      (FeatureFlagService as any).instance = null;
      localStorage.clear();
    });
    
    it('should respect rollout percentage', () => {
      const featureFlags = FeatureFlagService.getInstance();
      
      const flag: FeatureFlag = {
        id: 'test_flag',
        name: 'Test Flag',
        description: 'Test flag',
        enabled: true,
        rolloutPercentage: 50,
        targetAudience: 'all',
        startDate: new Date()
      };
      
      // Mock flag in service
      (featureFlags as any).flags.set('test_flag', flag);
      
      // Test with multiple users
      const results = [];
      for (let i = 0; i < 100; i++) {
        results.push(featureFlags.isEnabled('test_flag', `user${i}`));
      }
      
      const enabledCount = results.filter(Boolean).length;
      expect(enabledCount).toBeGreaterThan(0);
      expect(enabledCount).toBeLessThan(100);
    });
  });
});
```

---

## 📊 Analytics Events

### A/B Testing Events
```typescript
interface ABTestingEvents {
  'ab_test_assigned': { testId: string; variantId: string; userId?: string; userTier: string; sessionId: string };
  'ab_test_conversion': { testId: string; variantId: string; conversionType: string; value?: number; userTier: string; sessionId: string };
  'feature_flag_accessed': { flagId: string; enabled: boolean; userId?: string; userTier: string; sessionId: string };
}
```

---

## 🚀 Success Criteria

- [ ] A/B tests assign users to variants consistently
- [ ] Feature flags respect rollout percentages and targeting
- [ ] Test configurations can be created and managed via UI
- [ ] Variant assignments persist across sessions
- [ ] Conversion tracking works for all test types
- [ ] Audience targeting filters work correctly
- [ ] Analytics events track test participation and conversions
- [ ] Feature flags enable gradual rollouts
- [ ] Test results can be analyzed and compared
- [ ] System supports multiple concurrent tests

---

## 🔄 Dependencies & Integration

### Input Dependencies
- PRD 2: Feature Gating Architecture (for access gates)
- PRD 3: Signup Flow & Modal Triggers (for copy testing)
- PRD 6: Analytics & Funnel Tracking (for analytics)

### Output Dependencies
- PRD 10: Performance & Error Monitoring (for test monitoring)

### Integration Points
- Analytics service for conversion tracking
- Authentication system for user identification
- Feature gates for flag-based access control
- Signup modals for copy testing
- Local storage for test assignments
- Backend API for test configuration management 