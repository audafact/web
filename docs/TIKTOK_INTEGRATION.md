# TikTok Integration Documentation

This document describes the complete TikTok integration for tracking user signups and conversions.

## Overview

The TikTok integration consists of:

1. **Client-side tracking** - DataLayer events for GTM TikTok tags
2. **Server-side tracking** - Supabase Edge Function for TikTok Events API
3. **Attribution tracking** - ttclid cookie capture for server-side attribution

## Components

### 1. Supabase Edge Function

**Location**: `/supabase/functions/tiktok-complete-registration/`

**Purpose**: Sends CompleteRegistration events to TikTok Events API

**Environment Variables Required**:

- `TIKTOK_PIXEL_ID` - Your TikTok Pixel ID
- `TIKTOK_ACCESS_TOKEN` - Your TikTok Access Token

**API Endpoint**: `POST /functions/v1/tiktok-complete-registration`

**Request Body**:

```json
{
  "event_id": "unique-event-id",
  "email": "user@example.com", // optional, will be hashed
  "ttclid": "tiktok-click-id" // optional
}
```

### 2. Client-side Utilities

**Location**: `/src/utils/tiktokUtils.ts`

**Functions**:

- `setTtclidCookieFromURL()` - Captures ttclid from URL parameters
- `onSignupSuccess(email, eventId)` - Pushes event to dataLayer
- `sendTikTokCompleteRegistration(eventId, email, ttclid)` - Sends to server
- `getTtclidFromCookie()` - Reads ttclid from cookie
- `generateEventId()` - Creates unique event IDs

### 3. Integration Points

#### App Bootstrap

**Location**: `/src/main.tsx`

- Automatically captures ttclid on app load

#### Signup Success Flow

**Location**: `/src/services/postSignupFlowHandler.ts`

- Triggers TikTok tracking after successful signup
- Sends both client-side (dataLayer) and server-side (Events API) events
- Uses same event_id for deduplication

## Setup Instructions

### 1. Environment Variables

Add to your Supabase Edge Function environment:

```bash
TIKTOK_PIXEL_ID=your_pixel_id
TIKTOK_ACCESS_TOKEN=your_access_token
```

### 2. GTM Configuration

Configure your GTM TikTok event tag:

- **Event**: Custom Event = `complete_registration`
- **Event ID**: Data Layer Variable `event_id`
- **Email**: Data Layer Variable `user_email` (optional)

### 3. Testing

Use the test script to verify integration:

```javascript
// Run in browser console
import("./test-tiktok-integration.js");
```

## Event Flow

1. **User lands on site with ttclid** → Cookie is set automatically
2. **User completes signup** → Triggers signup success handler
3. **Client-side tracking** → Event pushed to dataLayer for GTM
4. **Server-side tracking** → Event sent to TikTok Events API via Supabase
5. **Deduplication** → Same event_id used for both to prevent double-counting

## Error Handling

- TikTok tracking failures don't break the signup flow
- All errors are logged to console
- Edge function returns detailed error messages
- Client-side tracking is resilient to network issues

## Security Notes

- Email addresses are SHA-256 hashed before sending to TikTok
- CORS headers are properly configured
- Environment variables are required for server-side tracking
- No sensitive data is exposed in client-side code

## Monitoring

Check these logs for tracking status:

- **Browser Console**: Client-side tracking logs
- **Supabase Edge Function Logs**: Server-side tracking logs
- **TikTok Events Manager**: Verify events are received

## Troubleshooting

### Common Issues

1. **No ttclid cookie**

   - Check if user came from TikTok ads
   - Verify URL parameter `?ttclid=...` is present

2. **Edge function errors**

   - Verify environment variables are set
   - Check Supabase function logs
   - Ensure TikTok credentials are valid

3. **GTM not firing**
   - Verify dataLayer events are being pushed
   - Check GTM TikTok tag configuration
   - Ensure trigger is set to `complete_registration`

### Debug Steps

1. Run the test script in browser console
2. Check Supabase Edge Function logs
3. Verify TikTok Events Manager shows received events
4. Test with TikTok's Test Events feature
