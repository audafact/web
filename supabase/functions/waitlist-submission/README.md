# Beta access / marketing form submission (Edge Function)

This Supabase Edge Function validates Turnstile and forwards submissions to HubSpot for beta access updates (legacy function name: `waitlist-submission`).

## Features

- ✅ **Turnstile Validation**: Validates tokens with Cloudflare before processing
- ✅ **Bot Protection**: Prevents automated submissions
- ✅ **HubSpot Integration**: Submits verified data to HubSpot
- ✅ **Error Handling**: Comprehensive error responses
- ✅ **Analytics Tracking**: Includes verification timestamps

## Environment Variables Required

```bash
TURNSTILE_SECRET_KEY=your_turnstile_secret_key
```

## Deployment

```bash
# Deploy the function
supabase functions deploy waitlist-submission

# Set environment variable
supabase secrets set TURNSTILE_SECRET_KEY=your_secret_key
```

## Usage

The function expects a POST request with the following payload:

```typescript
{
  firstName: string;
  email: string;
  role?: string;
  daw?: string;
  genres?: string[];
  experience?: string;
  referralSource?: string;
  agreeUpdates: boolean;
  agreeStorage: boolean;
  earlyAccess: boolean;
  turnstileToken: string;
  referrerUrl?: string;
  signupPage?: string;
  utmParams?: Record<string, string>;
}
```

## Response

### Success (200)

```json
{
  "success": true,
  "message": "Successfully added to waitlist!",
  "turnstileVerified": true,
  "hubspotSubmitted": true
}
```

### Error (400/500)

```json
{
  "error": "Error message",
  "details": "Additional error details"
}
```

## Security

- Validates Turnstile tokens with Cloudflare's API
- Only processes submissions with valid tokens
- Includes client IP in verification request
- Comprehensive error logging

## HubSpot follow-up (after copy or `pageName` changes)

1. In HubSpot, open the form used by this integration and check post-submit emails, thank-you text, and any workflow enrolled on form submit.
2. Search workflows, sequences, and marketing emails for “waitlist” and align wording with **beta access** / **early access** on the site.
3. Send a test submission from staging or production; confirm the contact timeline shows `pageName` **Audafact Beta Access (Verified)** and the expected automation still runs.
