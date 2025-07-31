# Stripe Subscription Integration for Audafact

This document provides a complete overview of the Stripe subscription integration implemented in Audafact.

## 🎯 Overview

The integration enables subscription-based payments using Stripe Checkout for access to the Pro Creator tier. Users can choose between monthly and yearly billing cycles, with a special early adopter promotional plan.

## 📋 Features Implemented

### ✅ Core Features
- **Pricing Page**: Beautiful, responsive pricing page with three subscription tiers
- **Stripe Checkout**: Secure, hosted checkout experience
- **Subscription Management**: Users can manage billing and cancel subscriptions
- **Access Control**: Premium features gated behind subscription checks
- **Webhook Handling**: Automatic subscription status updates
- **User Profile**: Complete profile page with subscription management

### ✅ Subscription Plans
| Plan | Price | Billing | Features |
|------|-------|---------|----------|
| Pro Creator Monthly | $8/month | Monthly | Full access to all features |
| Pro Creator Yearly | $72/year | Annual | 25% discount + early access |
| Early Adopter | $64/year | Annual | Limited time promotional offer |

## 🏗️ Architecture

### Frontend Components
- `Pricing.tsx` - Main pricing page with plan selection
- `SubscriptionManager.tsx` - Subscription management interface
- `PremiumFeature.tsx` - Component to gate premium features
- `CheckoutResult.tsx` - Success/cancel page after checkout
- `Profile.tsx` - User profile with subscription details

### Backend Services
- `stripeService.ts` - Frontend service for Stripe API calls
- `useUserAccess.ts` - Hook for checking user subscription status

### Supabase Edge Functions
- `create-checkout-session` - Creates Stripe checkout sessions
- `stripe-webhook` - Handles Stripe webhook events
- `create-portal-session` - Creates customer portal sessions
- `cancel-subscription` - Cancels user subscriptions

## 🚀 Quick Start

### 1. Prerequisites
- Supabase project with Edge Functions enabled
- Stripe account (test mode for development)
- Node.js and Supabase CLI

### 2. Stripe Setup
1. Create products and prices in Stripe Dashboard
2. Configure webhooks pointing to your Supabase Edge Functions
3. Get your API keys and webhook secrets

### 3. Database Setup
Run the SQL migration in your Supabase SQL Editor:
```sql
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
ADD COLUMN IF NOT EXISTS access_tier TEXT DEFAULT 'free' CHECK (access_tier IN ('free', 'pro')),
ADD COLUMN IF NOT EXISTS subscription_id TEXT,
ADD COLUMN IF NOT EXISTS plan_interval TEXT CHECK (plan_interval IN ('monthly', 'yearly')),
ADD COLUMN IF NOT EXISTS price_id TEXT;
```

### 4. Environment Variables
Set these in your Supabase project:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### 5. Deploy Edge Functions
```bash
supabase functions deploy create-checkout-session
supabase functions deploy stripe-webhook
supabase functions deploy create-portal-session
supabase functions deploy cancel-subscription
```

### 6. Update Price IDs
Replace placeholder price IDs in `src/views/Pricing.tsx` with your actual Stripe price IDs.

## 🔧 Usage Examples

### Gating Premium Features
```tsx
import { PremiumFeature } from '../components/PremiumFeature';

<PremiumFeature>
  <AdvancedAudioAnalysis />
</PremiumFeature>
```

### Checking User Access
```tsx
import { useUserAccess } from '../hooks/useUserAccess';

const { accessTier, loading } = useUserAccess();

if (accessTier === 'pro') {
  // Show premium features
}
```

### Creating Checkout Sessions
```tsx
import { createCheckoutSession } from '../services/stripeService';

const handleSubscribe = async (priceId: string) => {
  const { url, error } = await createCheckoutSession(priceId);
  if (url) {
    window.location.href = url;
  }
};
```

## 🔄 Webhook Events Handled

- `checkout.session.completed` - Activates user subscription
- `customer.subscription.deleted` - Downgrades user to free tier
- `customer.subscription.updated` - Updates subscription details
- `invoice.payment_failed` - Handles failed payments

## 🛡️ Security Features

- **Webhook Signature Verification**: All webhooks are verified using Stripe signatures
- **Environment Variables**: API keys stored securely in Supabase
- **User Authentication**: All subscription operations require user authentication
- **Database Constraints**: Proper constraints on subscription data

## 🧪 Testing

### Test Cards
- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`

### Testing Flow
1. Navigate to `/pricing`
2. Select a subscription plan
3. Complete checkout with test card
4. Verify user access tier updates to 'pro'
5. Test subscription management in profile

### Stripe CLI Testing
```bash
stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook
```

## 📊 Monitoring

### Stripe Dashboard
- Monitor subscription metrics
- Track revenue and churn
- View failed payments

### Supabase Logs
- Monitor Edge Function execution
- Check for webhook errors
- Track database operations

## 🐛 Troubleshooting

### Common Issues

1. **Webhook Not Receiving Events**
   - Verify webhook URL is correct
   - Check webhook secret is set
   - Monitor Supabase function logs

2. **Checkout Session Creation Fails**
   - Verify Stripe secret key
   - Check price ID exists
   - Ensure user is authenticated

3. **User Access Not Updated**
   - Check webhook is receiving events
   - Verify database permissions
   - Check Edge Function logs

### Debug Mode
Enable logging in Edge Functions:
```typescript
console.log('Debug:', { userId, customerId, subscriptionId });
```

## 📈 Analytics & Metrics

Track these key metrics:
- Subscription conversion rate
- Monthly recurring revenue (MRR)
- Churn rate
- Average revenue per user (ARPU)
- Failed payment rate

## 🔮 Future Enhancements

- Email notifications for subscription events
- Usage-based billing features
- A/B testing for pricing
- Advanced analytics dashboard
- Subscription upgrade/downgrade flows
- Prorated billing for plan changes

## 📚 Resources

- [Stripe Documentation](https://stripe.com/docs)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Stripe Webhooks](https://stripe.com/docs/webhooks)
- [Stripe Checkout](https://stripe.com/docs/payments/checkout)

## 🤝 Support

For issues with:
- **Stripe Integration**: Check Stripe documentation
- **Supabase Functions**: Check Supabase documentation
- **Frontend Issues**: Check browser console and network tab

## 📄 License

This integration is part of the Audafact project and follows the same licensing terms. 