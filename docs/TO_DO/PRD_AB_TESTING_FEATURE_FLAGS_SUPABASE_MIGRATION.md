# 🧪 PRD: A/B Testing & Feature Flags Migration to Supabase Edge Functions

## 📋 Overview

**Scope:** Migration of A/B testing and feature flag logic from client-side localStorage to centralized Supabase Edge Functions with database persistence

**Dependencies:** Existing analytics service, user tier system, Supabase infrastructure  
**Parallelizable:** Yes  
**Estimated Timeline:** 2-3 weeks

---

## 🎯 Objectives

- **Centralized Management:** Move all A/B test and feature flag configuration to Supabase database
- **Cross-Device Consistency:** Ensure users receive the same experience across all devices and sessions
- **Enhanced Security:** Prevent client-side tampering with test assignments and flag states
- **Improved Analytics:** Unified event logging and test analysis capabilities
- **Scalable Architecture:** Support multiple concurrent tests and large user bases
- **Real-time Updates:** Instant configuration changes without code deployments

---

## 🏗️ Technical Requirements

### 1.1 Database Schema

#### A/B Tests Table
```sql
CREATE TABLE ab_tests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  variants JSONB NOT NULL, -- Array of variant objects
  traffic_split INTEGER DEFAULT 100, -- Percentage of users to include
  target_audience VARCHAR(50) DEFAULT 'all', -- 'all', 'guests', 'free', 'pro'
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT false,
  metrics TEXT[], -- Array of metric names to track
  minimum_sample_size INTEGER DEFAULT 1000,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for active tests
CREATE INDEX idx_ab_tests_active ON ab_tests(is_active, start_date, end_date);
CREATE INDEX idx_ab_tests_audience ON ab_tests(target_audience);
```

#### A/B Test Assignments Table
```sql
CREATE TABLE ab_test_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  test_id UUID REFERENCES ab_tests(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  anonymous_id VARCHAR(255), -- For guest users
  variant_id VARCHAR(100) NOT NULL,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(test_id, user_id),
  UNIQUE(test_id, anonymous_id)
);

-- Indexes for efficient lookups
CREATE INDEX idx_ab_assignments_test_user ON ab_test_assignments(test_id, user_id);
CREATE INDEX idx_ab_assignments_test_anonymous ON ab_test_assignments(test_id, anonymous_id);
CREATE INDEX idx_ab_assignments_variant ON ab_test_assignments(variant_id);
```

#### Feature Flags Table
```sql
CREATE TABLE feature_flags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  enabled BOOLEAN DEFAULT false,
  rollout_percentage INTEGER DEFAULT 0, -- 0-100
  target_audience VARCHAR(50) DEFAULT 'all',
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE,
  conditions JSONB, -- Array of condition objects
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for active flags
CREATE INDEX idx_feature_flags_active ON feature_flags(enabled, start_date, end_date);
CREATE INDEX idx_feature_flags_audience ON feature_flags(target_audience);
```

#### A/B Test Events Table
```sql
CREATE TABLE ab_test_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  test_id UUID REFERENCES ab_tests(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  anonymous_id VARCHAR(255),
  variant_id VARCHAR(100) NOT NULL,
  event_type VARCHAR(100) NOT NULL, -- 'exposure', 'conversion'
  conversion_type VARCHAR(100), -- For conversion events
  value NUMERIC, -- For conversion events with values
  session_id VARCHAR(255),
  user_tier VARCHAR(50),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for analytics queries
CREATE INDEX idx_ab_events_test_variant ON ab_test_events(test_id, variant_id);
CREATE INDEX idx_ab_events_user ON ab_test_events(user_id, anonymous_id);
CREATE INDEX idx_ab_events_timestamp ON ab_test_events(timestamp);
CREATE INDEX idx_ab_events_type ON ab_test_events(event_type);
```

### 1.2 Edge Functions

#### A/B Test Assignment Function
```typescript
// supabase/functions/ab-test-assignment/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AssignmentRequest {
  testId: string;
  userId?: string;
  anonymousId?: string;
  userTier: 'guest' | 'free' | 'pro';
}

interface AssignmentResponse {
  variantId: string;
  variantConfig: Record<string, any>;
  isInTest: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { testId, userId, anonymousId, userTier }: AssignmentRequest = await req.json()
    
    if (!testId || (!userId && !anonymousId)) {
      throw new Error('Missing required parameters')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get test configuration
    const { data: test, error: testError } = await supabase
      .from('ab_tests')
      .select('*')
      .eq('id', testId)
      .eq('is_active', true)
      .single()

    if (testError || !test) {
      return new Response(
        JSON.stringify({ isInTest: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Check if test is active and user is in target audience
    const now = new Date()
    if (now < new Date(test.start_date) || 
        (test.end_date && now > new Date(test.end_date)) ||
        (test.target_audience !== 'all' && test.target_audience !== userTier)) {
      return new Response(
        JSON.stringify({ isInTest: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Check for existing assignment
    const assignmentKey = userId || anonymousId
    const { data: existingAssignment } = await supabase
      .from('ab_test_assignments')
      .select('variant_id')
      .eq('test_id', testId)
      .eq(userId ? 'user_id' : 'anonymous_id', assignmentKey)
      .single()

    let variantId: string
    let variantConfig: Record<string, any> = {}

    if (existingAssignment) {
      variantId = existingAssignment.variant_id
    } else {
      // Assign new variant
      const variants = test.variants
      variantId = assignVariant(variants, assignmentKey + testId)
      
      // Save assignment
      await supabase
        .from('ab_test_assignments')
        .insert({
          test_id: testId,
          user_id: userId,
          anonymous_id: anonymousId,
          variant_id: variantId
        })

      // Track exposure
      await supabase
        .from('ab_test_events')
        .insert({
          test_id: testId,
          user_id: userId,
          anonymous_id: anonymousId,
          variant_id: variantId,
          event_type: 'exposure',
          user_tier: userTier
        })
    }

    // Get variant config
    const variant = test.variants.find((v: any) => v.id === variantId)
    if (variant) {
      variantConfig = variant.config || {}
    }

    return new Response(
      JSON.stringify({
        variantId,
        variantConfig,
        isInTest: true
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('A/B test assignment error:', error)
    return new Response(
      JSON.stringify({ error: error.message, isInTest: false }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

function assignVariant(variants: any[], seed: string): string {
  const hash = hashString(seed)
  const random = hash % 100
  let cumulativeWeight = 0
  
  for (const variant of variants) {
    cumulativeWeight += variant.weight
    if (random <= cumulativeWeight) {
      return variant.id
    }
  }
  
  return variants[0].id
}

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash)
}
```

#### Feature Flag Evaluation Function
```typescript
// supabase/functions/feature-flag-evaluation/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface FlagRequest {
  flagId: string;
  userId?: string;
  anonymousId?: string;
  userTier: 'guest' | 'free' | 'pro';
  userData?: Record<string, any>; // Additional user context
}

interface FlagResponse {
  isEnabled: boolean;
  reason?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { flagId, userId, anonymousId, userTier, userData }: FlagRequest = await req.json()
    
    if (!flagId) {
      throw new Error('Missing flag ID')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get flag configuration
    const { data: flag, error: flagError } = await supabase
      .from('feature_flags')
      .select('*')
      .eq('id', flagId)
      .single()

    if (flagError || !flag) {
      return new Response(
        JSON.stringify({ isEnabled: false, reason: 'Flag not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Check if flag is enabled
    if (!flag.enabled) {
      return new Response(
        JSON.stringify({ isEnabled: false, reason: 'Flag disabled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Check date range
    const now = new Date()
    if (now < new Date(flag.start_date) || 
        (flag.end_date && now > new Date(flag.end_date))) {
      return new Response(
        JSON.stringify({ isEnabled: false, reason: 'Outside date range' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Check audience targeting
    if (flag.target_audience !== 'all' && flag.target_audience !== userTier) {
      return new Response(
        JSON.stringify({ isEnabled: false, reason: 'Not in target audience' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Check custom conditions
    if (flag.conditions && !evaluateConditions(flag.conditions, userTier, userId, userData)) {
      return new Response(
        JSON.stringify({ isEnabled: false, reason: 'Conditions not met' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Check rollout percentage
    const assignmentKey = userId || anonymousId || 'anonymous'
    const hash = hashString(assignmentKey + flagId)
    const isInRollout = (hash % 100) < flag.rollout_percentage

    return new Response(
      JSON.stringify({
        isEnabled: isInRollout,
        reason: isInRollout ? 'In rollout' : 'Not in rollout percentage'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('Feature flag evaluation error:', error)
    return new Response(
      JSON.stringify({ error: error.message, isEnabled: false }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

function evaluateConditions(conditions: any[], userTier: string, userId?: string, userData?: Record<string, any>): boolean {
  return conditions.every(condition => {
    switch (condition.type) {
      case 'user_tier':
        return evaluateCondition(userTier, condition)
      case 'user_id':
        return evaluateCondition(userId, condition)
      case 'custom':
        return evaluateCustomCondition(condition, userData)
      default:
        return true
    }
  })
}

function evaluateCondition(value: any, condition: any): boolean {
  switch (condition.operator) {
    case 'equals':
      return value === condition.value
    case 'not_equals':
      return value !== condition.value
    case 'greater_than':
      return value > condition.value
    case 'less_than':
      return value < condition.value
    case 'contains':
      return String(value).includes(String(condition.value))
    default:
      return true
  }
}

function evaluateCustomCondition(condition: any, userData?: Record<string, any>): boolean {
  // Implementation for custom conditions based on userData
  return true
}

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash)
}
```

#### Analytics Event Logging Function
```typescript
// supabase/functions/analytics-event/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AnalyticsEvent {
  event: string;
  userId?: string;
  anonymousId?: string;
  sessionId: string;
  timestamp: number;
  properties: Record<string, any>;
  userTier: 'guest' | 'free' | 'pro';
  version: string;
  platform: 'web' | 'mobile';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const eventData: AnalyticsEvent = await req.json()
    
    if (!eventData.event || !eventData.sessionId) {
      throw new Error('Missing required event data')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Store analytics event
    const { error: insertError } = await supabase
      .from('analytics_events')
      .insert({
        event: eventData.event,
        user_id: eventData.userId,
        anonymous_id: eventData.anonymousId,
        session_id: eventData.sessionId,
        timestamp: new Date(eventData.timestamp),
        properties: eventData.properties,
        user_tier: eventData.userTier,
        version: eventData.version,
        platform: eventData.platform
      })

    if (insertError) {
      throw new Error(`Failed to store analytics event: ${insertError.message}`)
    }

    // Handle A/B test conversion events
    if (eventData.event === 'ab_test_conversion') {
      const { testId, variantId, conversionType, value } = eventData.properties
      
      if (testId && variantId) {
        await supabase
          .from('ab_test_events')
          .insert({
            test_id: testId,
            user_id: eventData.userId,
            anonymous_id: eventData.anonymousId,
            variant_id: variantId,
            event_type: 'conversion',
            conversion_type: conversionType,
            value: value,
            session_id: eventData.sessionId,
            user_tier: eventData.userTier
          })
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('Analytics event error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
```

### 1.3 Frontend Integration

#### Updated A/B Testing Hook
```typescript
// src/hooks/useABTest.ts
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useUserTier } from './useUserTier';
import { useAnalytics } from './useAnalytics';

interface ABTestVariant {
  id: string;
  name: string;
  weight: number;
  config: Record<string, any>;
}

interface ABTestResult {
  variant: ABTestVariant | null;
  isLoading: boolean;
  isInTest: boolean;
  trackConversion: (conversionType: string, value?: number) => void;
}

export const useABTest = (testId: string): ABTestResult => {
  const [variant, setVariant] = useState<ABTestVariant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInTest, setIsInTest] = useState(false);
  const { user } = useAuth();
  const { tier } = useUserTier();
  const { trackEvent } = useAnalytics();

  useEffect(() => {
    const fetchVariant = async () => {
      if (!testId) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        
        const response = await fetch('/api/ab-test-assignment', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${user?.access_token}`
          },
          body: JSON.stringify({
            testId,
            userId: user?.id,
            anonymousId: getAnonymousId(),
            userTier: tier.id
          })
        });

        const data = await response.json();
        
        if (data.isInTest && data.variantId) {
          setVariant({
            id: data.variantId,
            name: data.variantId, // Could be enhanced with variant metadata
            weight: 0, // Not needed for client
            config: data.variantConfig || {}
          });
          setIsInTest(true);
        } else {
          setVariant(null);
          setIsInTest(false);
        }
      } catch (error) {
        console.error('Failed to fetch A/B test variant:', error);
        setVariant(null);
        setIsInTest(false);
      } finally {
        setIsLoading(false);
      }
    };

    fetchVariant();
  }, [testId, user?.id, tier.id]);

  const trackConversion = useCallback((conversionType: string, value?: number) => {
    if (!isInTest || !variant) return;

    trackEvent('ab_test_conversion', {
      testId,
      variantId: variant.id,
      conversionType,
      value
    });
  }, [isInTest, variant, testId, trackEvent]);

  return {
    variant,
    isLoading,
    isInTest,
    trackConversion
  };
};

function getAnonymousId(): string {
  let anonymousId = localStorage.getItem('anonymous_id');
  if (!anonymousId) {
    anonymousId = `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('anonymous_id', anonymousId);
  }
  return anonymousId;
}
```

#### Updated Feature Flag Hook
```typescript
// src/hooks/useFeatureFlag.ts
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useUserTier } from './useUserTier';

interface FeatureFlagResult {
  isEnabled: boolean;
  isLoading: boolean;
  reason?: string;
}

export const useFeatureFlag = (flagId: string): FeatureFlagResult => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [reason, setReason] = useState<string>();
  const { user } = useAuth();
  const { tier } = useUserTier();

  useEffect(() => {
    const checkFlag = async () => {
      if (!flagId) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        
        const response = await fetch('/api/feature-flag-evaluation', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${user?.access_token}`
          },
          body: JSON.stringify({
            flagId,
            userId: user?.id,
            anonymousId: getAnonymousId(),
            userTier: tier.id,
            userData: {
              // Additional context that could be used in conditions
              sessionCount: getSessionCount(),
              lastLoginDate: user?.last_sign_in_at
            }
          })
        });

        const data = await response.json();
        
        setIsEnabled(data.isEnabled);
        setReason(data.reason);
      } catch (error) {
        console.error('Failed to check feature flag:', error);
        setIsEnabled(false);
        setReason('Error checking flag');
      } finally {
        setIsLoading(false);
      }
    };

    checkFlag();
  }, [flagId, user?.id, tier.id]);

  return {
    isEnabled,
    isLoading,
    reason
  };
};

function getAnonymousId(): string {
  let anonymousId = localStorage.getItem('anonymous_id');
  if (!anonymousId) {
    anonymousId = `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('anonymous_id', anonymousId);
  }
  return anonymousId;
}

function getSessionCount(): number {
  // Implementation to get user's session count
  return parseInt(localStorage.getItem('session_count') || '0');
}
```

#### Updated Analytics Service
```typescript
// src/services/analyticsService.ts (updated)
// ... existing code ...

private async sendEvent(eventData: AnalyticsEvent) {
  try {
    const response = await fetch('/api/analytics-event', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.getAuthToken()}`
      },
      body: JSON.stringify({
        ...eventData,
        anonymousId: this.getAnonymousId()
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Analytics request failed: ${response.status}`);
    }
  } catch (error) {
    console.error('Failed to send analytics event:', error);
    this.storeForRetry(eventData);
  }
}

private getAnonymousId(): string {
  let anonymousId = localStorage.getItem('anonymous_id');
  if (!anonymousId) {
    anonymousId = `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('anonymous_id', anonymousId);
  }
  return anonymousId;
}

// ... rest of existing code ...
```

---

## 🎨 UI/UX Requirements

### 1.4 Admin Dashboard Components

#### A/B Test Management Interface
```typescript
// src/components/admin/ABTestManager.tsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';

interface ABTestManagerProps {
  // Component for managing A/B tests
}

export const ABTestManager: React.FC<ABTestManagerProps> = () => {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTests();
  }, []);

  const fetchTests = async () => {
    const { data, error } = await supabase
      .from('ab_tests')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setTests(data);
    }
    setLoading(false);
  };

  const createTest = async (testConfig: any) => {
    const { error } = await supabase
      .from('ab_tests')
      .insert(testConfig);

    if (!error) {
      fetchTests();
    }
  };

  const updateTest = async (id: string, updates: any) => {
    const { error } = await supabase
      .from('ab_tests')
      .update(updates)
      .eq('id', id);

    if (!error) {
      fetchTests();
    }
  };

  return (
    <div className="ab-test-manager">
      <h2>A/B Test Management</h2>
      {/* Test list and management UI */}
    </div>
  );
};
```

#### Feature Flag Management Interface
```typescript
// src/components/admin/FeatureFlagManager.tsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';

interface FeatureFlagManagerProps {
  // Component for managing feature flags
}

export const FeatureFlagManager: React.FC<FeatureFlagManagerProps> = () => {
  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFlags();
  }, []);

  const fetchFlags = async () => {
    const { data, error } = await supabase
      .from('feature_flags')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setFlags(data);
    }
    setLoading(false);
  };

  const toggleFlag = async (id: string, enabled: boolean) => {
    const { error } = await supabase
      .from('feature_flags')
      .update({ enabled })
      .eq('id', id);

    if (!error) {
      fetchFlags();
    }
  };

  return (
    <div className="feature-flag-manager">
      <h2>Feature Flag Management</h2>
      {/* Flag list and management UI */}
    </div>
  );
};
```

---

## 🧪 Testing Requirements

### 1.5 Test Coverage

#### Unit Tests
```typescript
// test/services/ABTestingService.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useABTest } from '../../src/hooks/useABTest';

describe('A/B Testing Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should assign consistent variants for same user', async () => {
    // Test implementation
  });

  it('should respect traffic split percentages', async () => {
    // Test implementation
  });

  it('should handle anonymous users correctly', async () => {
    // Test implementation
  });
});
```

#### Integration Tests
```typescript
// test/integration/ABTesting.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

describe('A/B Testing Integration', () => {
  let supabase: any;

  beforeAll(() => {
    supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  });

  it('should create and assign A/B test variants', async () => {
    // Test implementation
  });

  it('should track conversion events', async () => {
    // Test implementation
  });
});
```

---

## 🚀 Implementation Plan

### Phase 1: Database Setup (Week 1)
1. Create database schema for A/B tests, assignments, events, and feature flags
2. Set up Row Level Security (RLS) policies
3. Create database indexes for performance
4. Migrate existing test configurations from localStorage

### Phase 2: Edge Functions (Week 1-2)
1. Implement A/B test assignment function
2. Implement feature flag evaluation function
3. Implement analytics event logging function
4. Add error handling and retry logic
5. Set up CORS and authentication

### Phase 3: Frontend Integration (Week 2)
1. Update `useABTest` hook to use edge functions
2. Update `useFeatureFlag` hook to use edge functions
3. Update analytics service to use edge functions
4. Add loading states and error handling
5. Implement fallback to client-side logic during migration

### Phase 4: Admin Interface (Week 2-3)
1. Create A/B test management dashboard
2. Create feature flag management dashboard
3. Add analytics reporting interface
4. Implement real-time updates

### Phase 5: Testing & Migration (Week 3)
1. Comprehensive testing of all components
2. Performance testing and optimization
3. Gradual rollout to production
4. Monitor and validate results
5. Deprecate client-side logic

---

## 📊 Success Metrics

### Technical Metrics
- **Latency:** Edge function response time < 200ms
- **Availability:** 99.9% uptime for edge functions
- **Data Consistency:** 100% cross-device assignment consistency
- **Error Rate:** < 0.1% failed requests

### Business Metrics
- **Test Reliability:** Improved statistical significance due to consistent assignments
- **Feature Rollout Speed:** Reduced time from 24 hours to 5 minutes for flag changes
- **Analytics Quality:** 100% event capture rate vs. previous 85%
- **User Experience:** Zero assignment inconsistencies across devices

---

## 🔧 Configuration Examples

### A/B Test Configuration
```json
{
  "id": "signup_modal_copy_v2",
  "name": "Signup Modal Copy Test",
  "description": "Testing different copy variations for signup modal",
  "variants": [
    {
      "id": "control",
      "name": "Control",
      "weight": 50,
      "config": {
        "title": "Start Creating Today",
        "message": "Join thousands of creators"
      }
    },
    {
      "id": "variant_a",
      "name": "Urgency",
      "weight": 25,
      "config": {
        "title": "Limited Time Access",
        "message": "Join before we close registration"
      }
    },
    {
      "id": "variant_b",
      "name": "Social Proof",
      "weight": 25,
      "config": {
        "title": "Join the Community",
        "message": "10,000+ creators trust Audafact"
      }
    }
  ],
  "traffic_split": 100,
  "target_audience": "all",
  "start_date": "2024-01-01T00:00:00Z",
  "is_active": true,
  "metrics": ["signup_completed", "upgrade_clicked"]
}
```

### Feature Flag Configuration
```json
{
  "id": "new_upload_interface",
  "name": "New Upload Interface",
  "description": "Rolling out new drag-and-drop upload interface",
  "enabled": true,
  "rollout_percentage": 25,
  "target_audience": "pro",
  "start_date": "2024-01-01T00:00:00Z",
  "conditions": [
    {
      "type": "user_tier",
      "field": "tier",
      "operator": "equals",
      "value": "pro"
    }
  ]
}
```

---

## 🔒 Security Considerations

### Data Protection
- All user data encrypted at rest and in transit
- Row Level Security (RLS) policies enforce data access controls
- Anonymous user data handled with appropriate privacy measures
- GDPR compliance for user data processing

### Access Control
- Edge functions require valid authentication tokens
- Admin interfaces restricted to authorized personnel
- Audit logging for all configuration changes
- Rate limiting to prevent abuse

### Privacy
- Anonymous IDs used for guest users
- No personally identifiable information in test assignments
- Data retention policies for analytics events
- User consent mechanisms for data collection

---

## 📈 Monitoring & Alerting

### Key Metrics to Monitor
- Edge function response times and error rates
- Database query performance
- A/B test assignment distribution
- Feature flag evaluation patterns
- Analytics event processing rates

### Alerting Rules
- Edge function availability < 99%
- Response time > 500ms
- Error rate > 1%
- Database connection issues
- Unusual test assignment patterns

### Dashboard Requirements
- Real-time system health monitoring
- A/B test performance metrics
- Feature flag usage analytics
- User engagement patterns
- Error tracking and resolution

---

## 🔄 Migration Strategy

### Gradual Rollout
1. **Phase 1:** Deploy edge functions alongside existing client-side logic
2. **Phase 2:** Route 10% of traffic to new system
3. **Phase 3:** Increase to 50% and monitor performance
4. **Phase 4:** Full migration with fallback capability
5. **Phase 5:** Remove client-side logic after validation

### Data Migration
- Export existing localStorage test assignments
- Import to Supabase with user mapping
- Validate assignment consistency
- Monitor for any data discrepancies

### Rollback Plan
- Maintain client-side logic during transition
- Feature flag to switch between systems
- Database backup and restore procedures
- Emergency rollback procedures

---

## 📚 Documentation Requirements

### Technical Documentation
- Edge function API specifications
- Database schema documentation
- Frontend integration guide
- Admin interface user manual
- Troubleshooting guide

### Operational Documentation
- Deployment procedures
- Monitoring and alerting setup
- Backup and recovery procedures
- Security incident response
- Performance optimization guide

---

## 🎯 Conclusion

This migration will transform the A/B testing and feature flag system from a client-side implementation to a robust, scalable, and secure server-side solution. The benefits include:

- **Consistency:** Users receive the same experience across all devices
- **Security:** Server-side logic prevents tampering
- **Scalability:** Supports large user bases and multiple concurrent tests
- **Analytics:** Unified event logging for reliable experiment analysis
- **Management:** Centralized configuration with instant updates
- **Reliability:** Improved data integrity and reduced edge cases

The implementation follows existing codebase patterns and integrates seamlessly with the current analytics, authentication, and user tier systems while providing a foundation for future growth and experimentation capabilities. 