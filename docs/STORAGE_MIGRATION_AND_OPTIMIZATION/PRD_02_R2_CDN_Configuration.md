# PRD: Phase 2 - R2 CDN Configuration

## Overview

Configure Cloudflare R2 and CDN settings to optimize media delivery, implement proper caching strategies, and establish security controls for the media.audafact.com domain.

## Objectives

- Configure optimal caching rules for different asset types
- Implement hotlink protection and security measures
- Set up R2 lifecycle policies for cost optimization
- Establish proper cache headers and TTL settings

## Success Criteria

- [ ] CDN caching rules configured for library and user assets
- [ ] Hotlink protection implemented and tested
- [ ] R2 lifecycle policies configured
- [ ] Cache headers properly set for different asset types
- [ ] Performance improvements measurable

## Technical Requirements

### CDN Cache Rules Configuration

#### Library Assets (Immutable)

```
Pattern: media.audafact.com/library/*
Cache Setting: "Respect origin headers"
Edge Cache TTL: 1 year (31536000 seconds)
Browser Cache TTL: 1 year
Cache Key: Include query string
```

#### User Uploads (Potentially Mutable)

```
Pattern: media.audafact.com/users/*
Cache Setting: "Override origin cache"
Edge Cache TTL: 1 hour (3600 seconds)
Browser Cache TTL: 1 hour
Cache Key: Include query string
```

#### Session Recordings (Temporary)

```
Pattern: media.audafact.com/sessions/*
Cache Setting: "Override origin cache"
Edge Cache TTL: 15 minutes (900 seconds)
Browser Cache TTL: 15 minutes
Cache Key: Include query string
```

### Cache Headers Configuration

#### Immutable Assets (Library)

```
Cache-Control: public, max-age=31536000, immutable
ETag: Strong ETag based on content hash
```

#### Mutable Assets (User Uploads)

```
Cache-Control: public, max-age=3600, must-revalidate
ETag: Weak ETag based on last modified
```

#### Temporary Assets (Sessions)

```
Cache-Control: public, max-age=900, no-cache
ETag: Weak ETag based on timestamp
```

### Hotlink Protection Rules

#### Firewall Rules

```
Rule 1: Block empty referers for media assets
- Field: Referer
- Operator: is empty
- Action: Block

Rule 2: Allow only audafact.com domains
- Field: Referer
- Operator: matches regex
- Value: .*\.audafact\.com.*
- Action: Allow

Rule 3: Block all other referers
- Field: Referer
- Operator: does not match regex
- Value: .*\.audafact\.com.*
- Action: Block
```

#### Rate Limiting

```
Rule: Media asset rate limiting
- Field: URI path
- Operator: starts with
- Value: /library/ or /users/
- Rate: 1000 requests per minute per IP
- Action: Challenge (JS challenge)
```

### R2 Lifecycle Policies

#### Storage Class Transitions

```
Rule 1: Move to IA after 30 days
- Object age: 30 days
- Transition to: Infrequent Access

Rule 2: Move to Glacier after 90 days
- Object age: 90 days
- Transition to: Glacier

Rule 3: Delete after 1 year (for temporary assets)
- Object age: 365 days
- Action: Delete
```

#### Cleanup Policies

```
Rule 1: Delete failed uploads
- Object age: 24 hours
- Tag: status=failed
- Action: Delete

Rule 2: Delete temporary session files
- Object age: 7 days
- Prefix: sessions/
- Action: Delete
```

## Implementation Steps

### Step 1: Cloudflare Dashboard Configuration

1. Navigate to media.audafact.com domain settings
2. Configure cache rules for each asset pattern
3. Set up firewall rules for hotlink protection
4. Configure rate limiting rules

### Step 2: R2 Bucket Configuration

1. Set up lifecycle policies in R2 dashboard
2. Configure object tagging for cleanup
3. Set default cache headers for new objects
4. Test lifecycle policy execution

### Step 3: Cache Header Implementation

1. Update Worker to set appropriate cache headers
2. Implement ETag generation logic
3. Test cache behavior with different asset types
4. Verify CDN respects origin headers

### Step 4: Security Testing

1. Test hotlink protection with various referers
2. Verify rate limiting works correctly
3. Test empty referer blocking
4. Validate CORS configuration

## Dependencies

- Phase 1: Database Schema & Models (for understanding asset types)

## Risks & Mitigation

- **Risk**: Over-aggressive caching breaking user experience
  - **Mitigation**: Start with conservative TTLs and adjust based on usage
- **Risk**: Hotlink protection blocking legitimate users
  - **Mitigation**: Test thoroughly with real user scenarios
- **Risk**: Lifecycle policies deleting important assets
  - **Mitigation**: Implement proper tagging and review policies

## Testing Requirements

- [ ] Cache rules applied correctly for each asset type
- [ ] Hotlink protection blocks unauthorized referers
- [ ] Rate limiting prevents abuse
- [ ] Lifecycle policies execute as expected
- [ ] Cache headers respected by CDN
- [ ] Performance improvements measurable

## Performance Metrics

- Cache hit ratio target: >90% for library assets
- First byte time improvement: >50% for cached assets
- Bandwidth savings: >70% for library assets
- Error rate: <0.1% for legitimate requests

## Definition of Done

- [ ] All CDN cache rules configured and tested
- [ ] Hotlink protection implemented and validated
- [ ] R2 lifecycle policies configured
- [ ] Cache headers properly set in Worker
- [ ] Performance improvements measured and documented
- [ ] Security testing completed
- [ ] Documentation updated with configuration details
