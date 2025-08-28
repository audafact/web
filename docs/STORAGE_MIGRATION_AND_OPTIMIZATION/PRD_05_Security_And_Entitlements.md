# PRD: Phase 5 - Security & Entitlements

## Overview

Implement comprehensive security measures, quota enforcement, and entitlement management to protect the media system from abuse while ensuring legitimate users have appropriate access. This phase establishes the security foundation for production deployment.

## Objectives

- Implement daily upload size limits and preview/download rate limiting
- Add concurrent session limits and quota enforcement
- Rotate any remaining Supabase S3 credentials
- Implement comprehensive input validation and security hardening
- Add JWT refresh handling and CORS configuration

## Success Criteria

- [ ] Upload quotas enforced for all user tiers
- [ ] Rate limiting prevents abuse without blocking legitimate users
- [ ] All security vulnerabilities addressed
- [ ] JWT validation robust and secure
- [ ] Input validation comprehensive
- [ ] CORS properly configured

## Technical Requirements

### Quota Enforcement System

#### Daily Upload Limits

```typescript
interface UploadQuota {
  free: {
    dailySize: number; // 100MB
    dailyCount: number; // 5 files
    maxFileSize: number; // 25MB
  };
  pro: {
    dailySize: number; // 1GB
    dailyCount: number; // 50 files
    maxFileSize: number; // 100MB
  };
  enterprise: {
    dailySize: number; // 10GB
    dailyCount: number; // 500 files
    maxFileSize: number; // 500MB
  };
}
```

#### Quota Checking Implementation

```typescript
async function checkUploadQuota(
  userId: string,
  fileSize: number
): Promise<QuotaResult> {
  const userTier = await getUserTier(userId);
  const quota = UPLOAD_QUOTAS[userTier];

  // Check daily size limit
  const dailySize = await getDailyUploadSize(userId);
  if (dailySize + fileSize > quota.dailySize) {
    return {
      allowed: false,
      reason: "Daily size limit exceeded",
      limit: quota.dailySize,
      used: dailySize,
      requested: fileSize,
    };
  }

  // Check daily count limit
  const dailyCount = await getDailyUploadCount(userId);
  if (dailyCount >= quota.dailyCount) {
    return {
      allowed: false,
      reason: "Daily upload count limit exceeded",
      limit: quota.dailyCount,
      used: dailyCount,
    };
  }

  // Check individual file size limit
  if (fileSize > quota.maxFileSize) {
    return {
      allowed: false,
      reason: "File size exceeds limit",
      limit: quota.maxFileSize,
      requested: fileSize,
    };
  }

  return { allowed: true };
}
```

### Rate Limiting Implementation

#### Preview/Download Rate Limits

```typescript
interface RateLimitConfig {
  free: {
    previewsPerHour: number; // 100
    downloadsPerDay: number; // 10
    concurrentUrls: number; // 3
  };
  pro: {
    previewsPerHour: number; // 1000
    downloadsPerDay: number; // 100
    concurrentUrls: number; // 10
  };
  enterprise: {
    previewsPerHour: number; // 10000
    downloadsPerDay: number; // 1000
    concurrentUrls: number; // 50
  };
}
```

#### Rate Limiting Logic

```typescript
class RateLimiter {
  private limits: Map<string, RateLimitData> = new Map();

  async checkLimit(userId: string, action: string): Promise<boolean> {
    const key = `${userId}:${action}`;
    const now = Date.now();
    const userTier = await getUserTier(userId);
    const config = RATE_LIMITS[userTier];

    if (!this.limits.has(key)) {
      this.limits.set(key, {
        count: 0,
        resetTime: now + this.getResetInterval(action),
      });
    }

    const data = this.limits.get(key)!;

    // Reset if time has passed
    if (now > data.resetTime) {
      data.count = 0;
      data.resetTime = now + this.getResetInterval(action);
    }

    // Check limit
    const limit = this.getLimitForAction(action, config);
    if (data.count >= limit) {
      return false;
    }

    data.count++;
    return true;
  }
}
```

### Security Hardening

#### Input Validation

```typescript
interface ValidationRules {
  key: {
    maxLength: number; // 500 characters
    allowedPrefixes: string[]; // ['library/', 'users/', 'sessions/']
    forbiddenPatterns: RegExp[]; // [/\\.\\./, /\/\//]
  };
  filename: {
    maxLength: number; // 255 characters
    allowedExtensions: string[]; // ['.mp3', '.wav', '.m4a']
    forbiddenCharacters: string[]; // ['<', '>', ':', '"', '|', '?', '*']
  };
  contentType: {
    allowedTypes: string[]; // ['audio/mpeg', 'audio/wav', 'audio/mp4']
  };
}

function validateInput(input: any, rules: ValidationRules): ValidationResult {
  // Implement comprehensive validation for each field
  // Return detailed error messages for failed validation
}
```

#### JWT Security

```typescript
interface JWTSecurityConfig {
  maxAge: number; // 1 hour
  refreshThreshold: number; // 15 minutes
  requireRefresh: boolean; // true
}

class JWTSecurityManager {
  async validateToken(token: string): Promise<JWTValidationResult> {
    try {
      // Verify token with Supabase
      const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: SUPABASE_ANON_KEY,
        },
      });

      if (!response.ok) {
        return { valid: false, reason: "Invalid token" };
      }

      const user = await response.json();
      return { valid: true, user };
    } catch (error) {
      return { valid: false, reason: "Token validation failed" };
    }
  }

  async refreshTokenIfNeeded(token: string): Promise<string | null> {
    // Implement token refresh logic
    // Return new token if refresh successful
    // Return null if refresh failed
  }
}
```

### CORS Configuration

#### CORS Policy

```typescript
const CORS_CONFIG = {
  allowedOrigins: [
    "https://audafact.com",
    "https://www.audafact.com",
    "https://staging.audafact.com",
  ],
  allowedMethods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Authorization", "Content-Type", "X-Requested-With"],
  exposedHeaders: [
    "X-RateLimit-Limit",
    "X-RateLimit-Remaining",
    "X-RateLimit-Reset",
  ],
  maxAge: 86400, // 24 hours
  credentials: true,
};

function handleCORS(request: Request): Response {
  const origin = request.headers.get("Origin");

  if (!origin || !CORS_CONFIG.allowedOrigins.includes(origin)) {
    return new Response("Forbidden", { status: 403 });
  }

  const response = new Response();
  response.headers.set("Access-Control-Allow-Origin", origin);
  response.headers.set(
    "Access-Control-Allow-Methods",
    CORS_CONFIG.allowedMethods.join(", ")
  );
  response.headers.set(
    "Access-Control-Allow-Headers",
    CORS_CONFIG.allowedHeaders.join(", ")
  );
  response.headers.set(
    "Access-Control-Expose-Headers",
    CORS_CONFIG.exposedHeaders.join(", ")
  );
  response.headers.set("Access-Control-Max-Age", CORS_CONFIG.maxAge.toString());
  response.headers.set("Access-Control-Allow-Credentials", "true");

  return response;
}
```

## Implementation Steps

### Step 1: Quota System Implementation

1. Implement daily upload size limits
2. Add daily upload count limits
3. Implement individual file size limits
4. Add quota checking to upload endpoint
5. Test quota enforcement

### Step 2: Rate Limiting

1. Implement preview rate limiting per hour
2. Add download rate limiting per day
3. Implement concurrent URL limits
4. Add rate limit headers to responses
5. Test rate limiting behavior

### Step 3: Security Hardening

1. Implement comprehensive input validation
2. Add JWT refresh handling
3. Rotate any remaining credentials
4. Implement security headers
5. Add request logging

### Step 4: CORS and Configuration

1. Configure CORS policy
2. Test CORS with different origins
3. Validate security headers
4. Test JWT validation
5. Implement error handling

## Dependencies

- Phase 3: Worker API Core (for endpoint implementation)
- Phase 4: Frontend Integration (for understanding usage patterns)

## Risks & Mitigation

- **Risk**: Over-aggressive rate limiting blocking legitimate users
  - **Mitigation**: Start with generous limits and adjust based on usage data
- **Risk**: Security vulnerabilities in input validation
  - **Mitigation**: Comprehensive testing and security review
- **Risk**: JWT refresh failures breaking user experience
  - **Mitigation**: Graceful fallback and clear error messages

## Testing Requirements

- [ ] Quota enforcement works for all user tiers
- [ ] Rate limiting prevents abuse without blocking legitimate users
- [ ] Input validation blocks malicious requests
- [ ] JWT validation robust and secure
- [ ] CORS configuration works correctly
- [ ] Security headers properly set
- [ ] Error handling comprehensive

## Security Requirements

- All endpoints require valid JWT
- Input validation on all parameters
- Rate limiting per user and action
- CORS properly configured
- No credential exposure
- Comprehensive logging

## Definition of Done

- [ ] Quota system fully implemented
- [ ] Rate limiting operational
- [ ] Security measures validated
- [ ] JWT handling robust
- [ ] CORS properly configured
- [ ] All security tests passing
- [ ] Credentials rotated
- [ ] Documentation updated
- [ ] Security review completed
