import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// Deno needs async webhooks + SubtleCrypto provider (see Supabase Stripe example)
import Stripe from 'https://esm.sh/stripe@14.21.0?target=denonext'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2023-10-16',
})

/** Required for constructEventAsync in Deno / Supabase Edge (Web Crypto is async-only) */
const cryptoProvider = Stripe.createSubtleCryptoProvider()

const endpointSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? ''

/** Map Stripe interval (month/year) to DB format (monthly/yearly) */
function toPlanInterval(stripeInterval: string | null | undefined): 'monthly' | 'yearly' {
  if (stripeInterval === 'year') return 'yearly'
  return 'monthly' // 'month', 'day', 'week', or missing
}

serve(async (req) => {
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return new Response('No signature', { status: 400 })
  }

  try {
    const body = await req.text()
    const event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      endpointSecret,
      undefined,
      cryptoProvider
    )

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const supabaseUserId = session.metadata?.supabase_user_id

        console.log('[checkout.session.completed] metadata:', JSON.stringify(session.metadata), 'subscription:', session.subscription)

        if (!supabaseUserId) {
          console.error('Missing session.metadata.supabase_user_id - cannot update user')
          return new Response('Missing metadata.supabase_user_id', { status: 400 })
        }

        if (!session.subscription) {
          console.error('Missing session.subscription - expected for subscription checkout')
          return new Response('Missing subscription', { status: 400 })
        }

        const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
        const priceId = subscription.items.data[0].price.id
        const starterPriceId = Deno.env.get('STRIPE_STARTER_PRICE_ID') ?? ''
        const access_tier =
          starterPriceId && priceId === starterPriceId ? 'starter' : 'pro'

        const planInterval = toPlanInterval(subscription.items.data[0].price.recurring?.interval)

        const { data: updatedRows, error } = await supabase
          .from('users')
          .update({
            access_tier,
            subscription_id: subscription.id,
            plan_interval: planInterval,
            price_id: priceId,
          })
          .eq('id', supabaseUserId)
          .select('id, access_tier')

        if (error) {
          console.error('Error updating user access:', error.message, JSON.stringify(error))
          return new Response(`Error updating user: ${error.message}`, { status: 500 })
        }

        if (!updatedRows || updatedRows.length === 0) {
          console.error('No user row updated for id:', supabaseUserId, '- user may not exist in public.users')
          return new Response('User not found in public.users', { status: 404 })
        }

        console.log('Updated user', supabaseUserId, 'to access_tier:', access_tier)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        
        // Downgrade user to free tier
        const { error } = await supabase
          .from('users')
          .update({
            access_tier: 'free',
            subscription_id: null,
            plan_interval: null,
            price_id: null,
          })
          .eq('subscription_id', subscription.id)

        if (error) {
          console.error('Error downgrading user:', error)
          return new Response('Error downgrading user', { status: 500 })
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        
        // Optionally handle failed payments
        // You might want to send an email notification or update user status
        console.log('Payment failed for subscription:', invoice.subscription)
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const priceId = subscription.items.data[0].price.id
        const starterPriceId = Deno.env.get('STRIPE_STARTER_PRICE_ID') ?? ''
        const access_tier =
          starterPriceId && priceId === starterPriceId ? 'starter' : 'pro'
        const planInterval = toPlanInterval(subscription.items.data[0].price.recurring?.interval)

        const { error } = await supabase
          .from('users')
          .update({
            plan_interval: planInterval,
            price_id: priceId,
            access_tier,
          })
          .eq('subscription_id', subscription.id)

        if (error) {
          console.error('Error updating subscription:', error)
          return new Response('Error updating subscription', { status: 500 })
        }
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Webhook error:', error)
    return new Response(
      `Webhook Error: ${error.message}`,
      { status: 400 }
    )
  }
}) 