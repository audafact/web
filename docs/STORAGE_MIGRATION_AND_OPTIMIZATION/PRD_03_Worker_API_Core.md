# PRD: Phase 3 - Worker API Core

## Overview

Implement the core Worker API endpoints for media lifecycle management, including upload signing, access control, and telemetry logging. This phase establishes the backend infrastructure for secure media operations.

## Objectives

- Implement POST /api/sign-upload with JWT verification
- Add comprehensive access control for library and user files
- Implement telemetry and rate limiting
- Ensure security and input validation

## Success Criteria

- [ ] Upload signing endpoint fully functional
- [ ] Access control properly enforced for all file types
- [ ] Rate limiting implemented and tested
- [ ] Telemetry logging operational
- [ ] Security measures validated

## Technical Requirements

### Upload Endpoint (POST /api/sign-upload)

#### Request Format

```typescript
interface SignUploadRequest {
  filename: string;
  contentType: string;
  sizeBytes: number;
  title?: string;
  userId: string; // Extracted from JWT
}
```

#### Response Format

```typescript
interface SignUploadResponse {
  key: string;
  url: string;
  expiresAt: string;
  fields?: Record<string, string>; // For multipart uploads
}
```

#### Implementation Details

```typescript
// Key construction logic
const key = `users/${userId}/uploads/${uuid()}-${slugify(
  title || filename
)}.${extension}`;

// Quota checking
const quotaCheck = await checkUserUploadQuota(userId, sizeBytes);
if (!quotaCheck) {
  return json({ error: "Daily upload quota exceeded" }, 400);
}

// Presigned URL generation
const presignedUrl = await presignPut(key, contentType, expiresIn);
```

### Access Control Implementation

#### Library File Access

```typescript
async function checkLibraryAccess(
  userId: string,
  trackId: string
): Promise<boolean> {
  // Query database for track access rules
  const track = await queryLibraryTrack(trackId);

  if (!track.is_pro_only) {
    return true; // Free tracks accessible to all
  }

  // Check user tier for pro tracks
  const userProfile = await queryUserProfile(userId);
  return userProfile.tier === "pro" || userProfile.tier === "enterprise";
}
```

#### User File Ownership

```typescript
async function checkUserFileOwnership(
  userId: string,
  fileKey: string
): Promise<boolean> {
  // Extract user ID from file key
  const keyParts = fileKey.split("/");
  if (keyParts[0] !== "users" || keyParts[1] !== userId) {
    return false;
  }

  return true;
}
```

#### Key Validation

```typescript
const ALLOWED_PREFIXES = ["library/", "users/", "sessions/"];

function validateKey(key: string): boolean {
  // Check for path traversal attempts
  if (key.includes("..") || key.includes("//")) {
    return false;
  }

  // Check if key starts with allowed prefix
  return ALLOWED_PREFIXES.some((prefix) => key.startsWith(prefix));
}
```

### Rate Limiting Implementation

#### Per-User Rate Limits

```typescript
interface RateLimitConfig {
  previewsPerHour: number;
  uploadsPerDay: number;
  concurrentUrls: number;
}

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  free: {
    previewsPerHour: 100,
    uploadsPerDay: 5,
    concurrentUrls: 3,
  },
  pro: {
    previewsPerHour: 1000,
    uploadsPerDay: 50,
    concurrentUrls: 10,
  },
};
```

#### Rate Limiting Logic

```typescript
async function checkRateLimit(
  userId: string,
  action: string
): Promise<boolean> {
  const userTier = await getUserTier(userId);
  const limits = RATE_LIMITS[userTier] || RATE_LIMITS.free;

  switch (action) {
    case "preview":
      return await checkHourlyLimit(userId, "preview", limits.previewsPerHour);
    case "upload":
      return await checkDailyLimit(userId, "upload", limits.uploadsPerDay);
    case "concurrent":
      return await checkConcurrentLimit(userId, limits.concurrentUrls);
  }
}
```

### Telemetry and Logging

#### Log Structure

```typescript
interface TelemetryLog {
  timestamp: string;
  userId: string;
  action: "preview" | "download" | "upload" | "delete";
  fileKey: string;
  userTier: string;
  responseTime: number;
  status: number;
  metadata: Record<string, any>;
}
```

#### Logging Implementation

```typescript
async function logTelemetry(log: TelemetryLog): Promise<void> {
  // Store in Supabase for analytics
  await supabase.from("media_telemetry").insert(log);

  // Also log to Cloudflare for monitoring
  console.log(JSON.stringify(log));
}
```

## Implementation Steps

### Step 1: Core Upload Endpoint

1. Implement JWT verification middleware
2. Add user ID extraction from JWT
3. Implement key construction logic
4. Add quota checking
5. Generate presigned PUT URLs

### Step 2: Access Control System

1. Implement library access checking
2. Add user file ownership validation
3. Implement key validation and sanitization
4. Add comprehensive input validation

### Step 3: Rate Limiting

1. Implement per-user rate limiting
2. Add concurrent URL limits
3. Implement daily/hourly quotas
4. Add rate limit headers to responses

### Step 4: Telemetry and Security

1. Implement comprehensive logging
2. Add security headers
3. Implement CORS configuration
4. Add error handling and monitoring

## Dependencies

- Phase 1: Database Schema & Models (for quota and access functions)
- Phase 2: R2 CDN Configuration (for understanding asset types)

## Risks & Mitigation

- **Risk**: Rate limiting too aggressive for legitimate users
  - **Mitigation**: Start with generous limits and adjust based on usage data
- **Risk**: Security vulnerabilities in access control
  - **Mitigation**: Comprehensive testing and security review
- **Risk**: Performance impact of database queries
  - **Mitigation**: Implement caching and optimize queries

## Testing Requirements

- [ ] Upload endpoint handles all valid requests correctly
- [ ] Access control blocks unauthorized access
- [ ] Rate limiting prevents abuse without blocking legitimate users
- [ ] Telemetry logs all required data
- [ ] Security measures block common attack vectors
- [ ] Performance meets latency requirements

## Performance Requirements

- Response time: <200ms for simple operations
- Concurrent users: Support 100+ simultaneous users
- Error rate: <0.1% for valid requests
- Availability: 99.9% uptime

## Definition of Done

- [ ] All API endpoints implemented and tested
- [ ] Access control system validated
- [ ] Rate limiting operational
- [ ] Telemetry logging functional
- [ ] Security testing completed
- [ ] Performance requirements met
- [ ] Documentation updated
- [ ] Error handling comprehensive
