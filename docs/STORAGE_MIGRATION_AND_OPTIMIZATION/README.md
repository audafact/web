# Storage Migration and Optimization - Master Plan

## Overview

This document provides a comprehensive overview of the R2 storage migration and optimization project, outlining the 7-phase approach to migrate from Supabase storage to Cloudflare R2 with a Worker-based media API.

## What Has Been Done

### Storage & CDN Migration ✅

- **Migrated objects** from Supabase → Cloudflare R2
- **Established R2 layout** for library assets: `audafact/library/originals/<trackId>-<shortHash>.<ext>`
- **Created Cloudflare custom domain** for media delivery: `media.audafact.com`
- **Delegated DNS** to Cloudflare
- **Issued R2 API credentials** with bucket-scoped permissions (server-side only in Worker)

### Worker (Backend-less Media API) ✅

- **Deployed Cloudflare Worker** with:
  - Auth via Supabase JWT (calls `/auth/v1/user` with anon key)
  - File signing for playback: `/api/sign-file?key=...` → short-lived HTTPS URL for R2 object
  - Delete endpoint: `/api/delete-file` (JSON `{ key }`) → deletes R2 object after auth
  - Range streaming support: `/api/stream` (presign is preferred path)

### Database Alignment ✅

- **Tracks table backfilled** with `content_hash`, `size_bytes`, `content_type`
- **`file_key` adopted** in DB and app models
- **`file_url` treated as legacy/fallback** (normalized to a key when encountered)

### Frontend Integration ✅

- **Canonical identifier** is now `fileKey`, not a public URL
- **SidePanel refactor** to single audio element pattern:
  - Centralized play/stop/toggle; no leaking object URLs
  - Previews for both library and user uploads now sign the `fileKey` on demand
- **Drag-and-drop payloads** now carry `fileKey` (instead of file URL)
- **Legacy public-URL usage removed** from preview paths (no more `getPublicUrl()` for library)

### Current Architecture Snapshot (Source of Truth) ✅

- **Auth & DB**: Supabase (Edge Functions retained for Stripe)
- **Media storage**: R2 (private buckets)
- **Delivery**: Cloudflare CDN via `media.audafact.com`
- **Media API**: Cloudflare Worker (sign GET, sign PUT [to implement], delete, optional stream)
- **Frontend**: Vite React TS; media retrieved by signing `fileKey` through Worker

### Conventions & Standards (Keep These Consistent) ✅

- **Object addressing**: Always store and pass R2 object keys (e.g., `library/originals/…`, `users/<uid>/uploads/…`)
- **Mutability**: Treat library originals as immutable by embedding a short hash (or version tag) in the filename; updates create a new object/key
- **Preview vs original**: Previews (if/when generated) live under `library/previews/` with identical `<trackId>-<hash>` basename
- **Signing**: Client never sees R2 credentials; it requests short-lived URLs from the Worker
- **Caching**: Immutable assets must ship `Cache-Control: public, max-age=31536000, immutable`
- **Security**: All Worker routes require a valid Supabase JWT; authorization rules (e.g., pro-only tracks) enforced at the Worker before signing

### Files and Functions Added ✅

**Web (audafact/web)**

- **Hooks**:

  - `src/hooks/useSingleAudio.ts` — central playback controller (one `<audio>` element, stop/cleanup, toggle, signed URL handling)
  - `src/hooks/usePreviewAudio.ts` (refactored to Worker signing + usePreviewFromProvider)
  - `src/audio/usePreviewFromProvider.ts` — preview/loop/cue playback on a shared AudioContext from AudioProvider
  - `src/context/AudioContext.tsx` — AudioProvider / useAudioContext for shared AudioContext management

- **Services**:

  - `src/services/libraryService.ts` (modified) — now outputs `fileKey` instead of `file_url`
  - `src/lib/keys.ts` — helpers for constructing canonical R2 keys
  - `src/lib/api.ts` — `signFile(key: string)` and `deleteByKey(key: string)` for Worker API calls

- **Components**:
  - `SidePanel.tsx` (refactored) — now uses `useSingleAudio.toggle()` and drag-and-drop with `fileKey`
  - `LibraryTrackItem.tsx` — preview calls `handlePreviewPlay(track, false)` and drag payload includes `fileKey`

**Worker (audafact/worker)**

- **Configuration**: `wrangler.toml` with Worker name "audafact-api" and R2 bindings
- **Code**: `src/index.ts` with routes for sign-file, sign-upload (stub), delete-file, and stream support
- **Helpers**: JWT verification, presigned URL builders, CORS handling, and range streaming

## Project Goals

- **Migrate** from Supabase storage to Cloudflare R2 for better performance and cost control
- **Implement** secure Worker-based media API for all media operations
- **Establish** proper CDN caching and security measures
- **Optimize** media delivery and user experience
- **Remove** legacy dependencies and technical debt

## Architecture Overview

### Current State (Pre-Migration)

- **Storage**: Supabase S3-compatible storage
- **Media API**: Direct storage access from frontend
- **Security**: Basic authentication, public URLs
- **Performance**: Limited CDN optimization

### Target State (Post-Migration)

- **Storage**: Cloudflare R2 with lifecycle management
- **Media API**: Cloudflare Worker with JWT auth and presigned URLs
- **Security**: Comprehensive access control, rate limiting, quotas
- **Performance**: Global CDN with intelligent caching

## Current Status

### ✅ Completed

- **Infrastructure Setup**: Basic R2 migration, Worker deployment, DNS configuration
- **Core Worker API**: Basic endpoints (sign-file, delete-file, stream)
- **Frontend Foundation**: Basic fileKey adoption and audio refactoring

### 🚧 In Progress

- **Phase 3**: Worker API Core (upload signing endpoint needs completion)
- **Phase 4**: Frontend Integration (some components still need updates)

### ❌ Not Started

- **Phase 1**: Database Schema & Models (uploads table, preview_key, quota functions)
- **Phase 2**: R2 CDN Configuration (cache rules, hotlink protection, lifecycle policies)
- **Phase 5**: Security & Entitlements
- **Phase 6**: Testing & Observability
- **Phase 7**: Rollout & Cleanup

## Phase Dependencies

```
Phase 1: Database Schema & Models ❌ (Not Started)
    ↓
Phase 2: R2 CDN Configuration ❌ (Not Started)
    ↓
Phase 3: Worker API Core 🚧 (Core Complete, Upload Endpoint Pending)
    ↓
Phase 4: Frontend Integration 🚧 (Basic Complete, Full Integration Pending)
    ↓
Phase 5: Security & Entitlements ❌ (Not Started)
    ↓
Phase 6: Testing & Observability ❌ (Not Started)
    ↓
Phase 7: Rollout & Cleanup ❌ (Not Started)
```

## Phase Summaries

### Phase 1: Database Schema & Models

**Duration**: 1-2 weeks  
**Dependencies**: None  
**Key Deliverables**:

- Uploads table for user content
- Enhanced library tracks with preview support
- Quota and access control functions
- Proper indexing and constraints

**Risk Level**: Low  
**Team**: Backend/Database

### Phase 2: R2 CDN Configuration

**Duration**: 1 week  
**Dependencies**: Phase 1  
**Key Deliverables**:

- CDN cache rules for different asset types
- Hotlink protection and security measures
- R2 lifecycle policies
- Cache header configuration

**Risk Level**: Low  
**Team**: DevOps/Infrastructure

### Phase 3: Worker API Core

**Duration**: 2-3 weeks  
**Dependencies**: Phase 1, Phase 2  
**Key Deliverables**:

- Upload signing endpoint
- Access control system
- Rate limiting implementation
- Telemetry and logging

**Risk Level**: Medium  
**Team**: Backend/Worker

### Phase 4: Frontend Integration

**Duration**: 2-3 weeks  
**Dependencies**: Phase 3  
**Key Deliverables**:

- Upload flow using Worker API
- Preview flow with signed URLs
- LibraryService cleanup
- Drag-and-drop updates

**Risk Level**: Medium  
**Team**: Frontend

### Phase 5: Security & Entitlements

**Duration**: 1-2 weeks  
**Dependencies**: Phase 3, Phase 4  
**Key Deliverables**:

- Quota enforcement system
- Rate limiting per user tier
- Security hardening
- CORS configuration

**Risk Level**: Medium  
**Team**: Security/Backend

### Phase 6: Testing & Observability

**Duration**: 2 weeks  
**Dependencies**: Phase 3, Phase 4, Phase 5  
**Key Deliverables**:

- Comprehensive test suite
- Monitoring and alerting
- Cost tracking and analytics
- Error monitoring

**Risk Level**: Low  
**Team**: QA/DevOps

### Phase 7: Rollout & Cleanup

**Duration**: 1-2 weeks  
**Dependencies**: Phase 6  
**Key Deliverables**:

- Staging validation
- Production cutover
- Legacy system cleanup
- Documentation archival

**Risk Level**: High  
**Team**: DevOps/All Teams

## Timeline Overview

```
Week 1-2:   Phase 1 (Database)
Week 3:      Phase 2 (CDN)
Week 4-6:    Phase 3 (Worker API)
Week 7-9:    Phase 4 (Frontend)
Week 10-11:  Phase 5 (Security)
Week 12-13:  Phase 6 (Testing)
Week 14-15:  Phase 7 (Rollout)
```

**Total Duration**: 14-15 weeks  
**Critical Path**: Phases 1 → 3 → 4 → 6 → 7

## Resource Requirements

### Team Composition

- **Backend Developer**: 1 FTE (Phases 1, 3, 5)
- **Frontend Developer**: 1 FTE (Phase 4)
- **DevOps Engineer**: 0.5 FTE (Phases 2, 6, 7)
- **QA Engineer**: 0.5 FTE (Phase 6)
- **Security Engineer**: 0.25 FTE (Phase 5)

### Infrastructure

- **Cloudflare R2**: Storage and CDN
- **Cloudflare Worker**: Media API
- **Supabase**: Database and auth (retained)
- **Monitoring**: Cloudflare Analytics + Custom dashboards

## Risk Assessment

### High Risk

- **Production Cutover**: Complex deployment with multiple systems
  - _Mitigation_: Comprehensive staging validation, rollback procedures
- **Data Migration**: Moving existing assets to R2
  - _Mitigation_: Incremental migration, validation scripts

### Medium Risk

- **Worker API Performance**: New system under load
  - _Mitigation_: Performance testing, monitoring, optimization
- **Frontend Integration**: Breaking changes to existing functionality
  - _Mitigation_: Gradual rollout, fallback mechanisms

### Low Risk

- **Database Schema Changes**: Well-defined migrations
- **CDN Configuration**: Standard Cloudflare setup

## Success Metrics

### Technical Metrics

- **Performance**: <200ms Worker response time, >90% CDN cache hit
- **Reliability**: 99.9% uptime, <0.1% error rate
- **Security**: Zero credential exposure, comprehensive access control
- **Cost**: <$50/day storage costs, predictable pricing

### Business Metrics

- **User Experience**: No regression in media operations
- **Developer Experience**: Cleaner API, better error handling
- **Operational**: Reduced storage costs, better monitoring

## Rollback Strategy

### Immediate Rollback (5 minutes)

- Revert Worker deployment
- Point DNS back to old system

### Full Rollback (15 minutes)

- Restore Supabase storage access
- Revert all frontend changes
- Restore database schema

### Data Recovery

- R2 objects remain accessible
- Database changes can be reverted
- User uploads preserved

## Communication Plan

### Stakeholder Updates

- **Weekly**: Progress updates to product team
- **Bi-weekly**: Technical deep-dives for engineering
- **Monthly**: Executive summary for leadership

### Team Coordination

- **Daily**: Standup updates on current phase
- **Weekly**: Phase completion reviews
- **Bi-weekly**: Cross-phase dependency planning

## Post-Migration Benefits

### Immediate Benefits

- **Performance**: Global CDN distribution, faster media delivery
- **Cost**: Predictable R2 pricing, reduced bandwidth costs
- **Security**: No credential exposure, comprehensive access control

### Long-term Benefits

- **Scalability**: Worker-based architecture, easy scaling
- **Maintainability**: Cleaner codebase, better separation of concerns
- **Monitoring**: Comprehensive observability, proactive issue detection

## What Remains To Be Done

### Immediate Next Steps (Next 2-4 weeks)

1. **Start Database Schema & Models** (Phase 1):

   - Create uploads table for user content
   - Add preview_key column to library tracks
   - Implement quota and access control functions
   - Add proper indexing and constraints

2. **Start R2 CDN Configuration** (Phase 2):

   - Configure CDN cache rules for different asset types
   - Implement hotlink protection and security measures
   - Set up R2 lifecycle policies for cost optimization
   - Configure cache headers and TTL settings

3. **Complete Worker API Core** (Phase 3):

   - Finish upload signing endpoint (`/api/sign-file`)
   - Implement multipart upload support for large files
   - Add comprehensive access control and authorization
   - Implement rate limiting and quota enforcement

4. **Complete Frontend Integration** (Phase 4):
   - Update remaining components to use Worker signing
   - Implement upload flow with Worker API
   - Ensure all preview operations use signed URLs
   - Test drag-and-drop functionality end-to-end

### Medium Term (Next 4-8 weeks)

3. **Security & Entitlements** (Phase 5):

   - Implement comprehensive quota system
   - Add rate limiting per user tier
   - Security hardening and input validation
   - CORS configuration and security headers

4. **Testing & Observability** (Phase 6):
   - Comprehensive test suite implementation
   - Monitoring and alerting setup
   - Cost tracking and analytics
   - Performance validation

### Long Term (Next 8-12 weeks)

5. **Rollout & Cleanup** (Phase 7):
   - Staging environment validation
   - Production cutover execution
   - Legacy system cleanup
   - Documentation archival

## Next Steps

1. **Review and Approve**: Stakeholder review of this master plan
2. **Team Assignment**: Assign team members to phases
3. **Start Phase 1**: Begin database schema work
4. **Start Phase 2**: Begin R2 CDN configuration
5. **Complete Phase 3**: Finish Worker API implementation
6. **Complete Phase 4**: Finish frontend integration
7. **Regular Reviews**: Weekly progress tracking and phase transitions

## Document Structure

- `README.md` - This master overview
- `PRD_01_Database_Schema_And_Models.md` - Phase 1 details
- `PRD_02_R2_CDN_Configuration.md` - Phase 2 details
- `PRD_03_Worker_API_Core.md` - Phase 3 details
- `PRD_04_Frontend_Integration.md` - Phase 4 details
- `PRD_05_Security_And_Entitlements.md` - Phase 5 details
- `PRD_06_Testing_And_Observability.md` - Phase 6 details
- `PRD_07_Rollout_And_Cleanup.md` - Phase 7 details

Each PRD contains detailed technical requirements, implementation steps, and success criteria for that specific phase.
