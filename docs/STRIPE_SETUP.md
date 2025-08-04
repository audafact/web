# Stripe Subscription Integration Setup

This document outlines the complete setup process for integrating Stripe subscriptions into your Audafact application.

## Prerequisites

- Supabase project with Edge Functions enabled
- Stripe account (test and live modes)
- Node.js and Supabase CLI installed

## 1. Stripe Account Setup

### Create Products and Prices

1. **Log into your Stripe Dashboard**
2. **Create Products:**
   - Go to Products → Add Product
   - Create three products:
     - "Pro Creator Monthly" ($8/month)
     - "Pro Creator Yearly" ($72/year)
     - "Early Adopter Promo" ($64/year)

3. **Create Prices for each product:**
   - For Monthly: $8.00 USD, recurring monthly
   - For Yearly: $72.00 USD, recurring yearly
   - For Early Adopter: $64.00 USD, recurring yearly

4. **Note the Price IDs** - you'll need these for the frontend configuration

### Configure Webhooks

1. **Go to Developers → Webhooks**
2. **Add endpoint:**
   - URL: `https://your-project.supabase.co/functions/v1/stripe-webhook`
   - Events to send:
     - `checkout.session.completed`
     - `customer.subscription.deleted`
     - `customer.subscription.updated`
     - `invoice.payment_failed`

3. **Copy the webhook signing secret** - you'll need this for environment variables

### Get API Keys

1. **Go to Developers → API Keys**
2. **Copy your Secret Key** (starts with `sk_`)
3. **Copy your Publishable Key** (starts with `pk_`)

## 2. Supabase Setup

### Database Migration

Run this SQL in your Supabase SQL Editor:

```sql
-- Add Stripe-related fields to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
ADD COLUMN IF NOT EXISTS access_tier TEXT DEFAULT 'free' CHECK (access_tier IN ('free', 'pro')),
ADD COLUMN IF NOT EXISTS subscription_id TEXT,
ADD COLUMN IF NOT EXISTS plan_interval TEXT CHECK (plan_interval IN ('monthly', 'yearly')),
ADD COLUMN IF NOT EXISTS price_id TEXT;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_users_subscription_id ON users(subscription_id);
CREATE INDEX IF NOT EXISTS idx_users_access_tier ON users(access_tier);
```

### Environment Variables

Add these to your Supabase project settings:

1. **Go to Settings → API**
2. **Add these environment variables:**
   - `STRIPE_SECRET_KEY`: Your Stripe secret key
   - `STRIPE_WEBHOOK_SECRET`: Your webhook signing secret
   - `SUPABASE_URL`: Your Supabase project URL
   - `SUPABASE_SERVICE_ROLE_KEY`: Your service role key

### Deploy Edge Functions

1. **Install Supabase CLI:**
   ```bash
   npm install -g supabase
   ```

2. **Login to Supabase:**
   ```bash
   supabase login
   ```

3. **Link your project:**
   ```bash
   supabase link --project-ref your-project-ref
   ```

4. **Deploy the functions:**
   ```bash
   supabase functions deploy create-checkout-session
   supabase functions deploy stripe-webhook
   supabase functions deploy create-portal-session
   supabase functions deploy cancel-subscription
   ```

## 3. Frontend Configuration

### Update Price IDs

In `src/views/Pricing.tsx`, replace the placeholder price IDs with your actual Stripe price IDs:

```typescript
const plans: PricingPlan[] = [
  {
    id: 'monthly',
    name: 'Pro Creator',
    price: '$8',
    interval: 'monthly',
    features: [...],
    priceId: 'price_1ABC123DEF456' // Replace with your actual price ID
  },
  {
    id: 'yearly',
    name: 'Pro Creator',
    price: '$72',
    originalPrice: '$96',
    interval: 'yearly',
    features: [...],
    popular: true,
    priceId: 'price_1ABC123DEF789' // Replace with your actual price ID
  },
  {
    id: 'early-adopter',
    name: 'Early Adopter',
    price: '$64',
    originalPrice: '$96',
    interval: 'yearly',
    features: [...],
    earlyAdopter: true,
    priceId: 'price_1ABC123DEF012' // Replace with your actual price ID
  }
];
```

### Add Navigation Links

Update your navigation to include the pricing page:

```typescript
// In your Navbar component
<a href="/pricing" className="...">Pricing</a>
```

## 4. Testing

### Test the Integration

1. **Use Stripe test cards:**
   - Success: `4242 4242 4242 4242`
   - Decline: `4000 0000 0000 0002`

2. **Test the flow:**
   - Go to `/pricing`
   - Select a plan
   - Complete checkout with test card
   - Verify user access tier is updated to 'pro'

3. **Test webhooks:**
   - Use Stripe CLI to test webhooks locally
   - Verify subscription events are handled correctly

### Stripe CLI Testing

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to your local environment
stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook
```

## 5. Production Deployment

### Environment Variables

Ensure all environment variables are set in production:

- `STRIPE_SECRET_KEY` (live key)
- `STRIPE_WEBHOOK_SECRET` (live webhook secret)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### Webhook URL

Update your webhook endpoint URL in Stripe dashboard to point to your production Supabase project.

### SSL Certificate

Ensure your domain has a valid SSL certificate for secure checkout.

## 6. Monitoring and Analytics

### Stripe Dashboard

Monitor these metrics in your Stripe dashboard:
- Subscription growth
- Churn rate
- Revenue metrics
- Failed payments

### Supabase Logs

Monitor Edge Function logs in Supabase dashboard for any errors.

## 7. Security Considerations

### Webhook Verification

The webhook handler verifies Stripe signatures to prevent tampering.

### Environment Variables

Never commit API keys to version control. Use environment variables.

### Rate Limiting

Consider implementing rate limiting on your Edge Functions.

## 8. Troubleshooting

### Common Issues

1. **Webhook not receiving events:**
   - Check webhook URL is correct
   - Verify webhook secret is set correctly
   - Check Supabase function logs

2. **Checkout session creation fails:**
   - Verify Stripe secret key is correct
   - Check price ID exists in Stripe
   - Verify user authentication

3. **User access not updated:**
   - Check webhook is receiving events
   - Verify database permissions
   - Check Edge Function logs

### Debug Mode

Enable debug logging in your Edge Functions for troubleshooting:

```typescript
console.log('Debug info:', { userId, customerId, subscriptionId });
```

## 9. Support

For issues with:
- **Stripe integration**: Check Stripe documentation and support
- **Supabase Edge Functions**: Check Supabase documentation
- **Frontend issues**: Check browser console and network tab

## 10. Next Steps

After setup, consider implementing:
- Email notifications for subscription events
- Analytics tracking
- A/B testing for pricing
- Subscription management dashboard
- Usage-based billing features 