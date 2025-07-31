import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@12.0.0'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2023-10-16',
})

const endpointSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? ''

serve(async (req) => {
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return new Response('No signature', { status: 400 })
  }

  try {
    const body = await req.text()
    const event = stripe.webhooks.constructEvent(body, signature, endpointSecret)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
        
        // Update user access tier
        const { error } = await supabase
          .from('users')
          .update({
            access_tier: 'pro',
            subscription_id: subscription.id,
            plan_interval: subscription.items.data[0].price.recurring?.interval || 'monthly',
            price_id: subscription.items.data[0].price.id,
          })
          .eq('id', session.metadata?.supabase_user_id)

        if (error) {
          console.error('Error updating user access:', error)
          return new Response('Error updating user', { status: 500 })
        }
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
        
        // Update subscription details if needed
        const { error } = await supabase
          .from('users')
          .update({
            plan_interval: subscription.items.data[0].price.recurring?.interval || 'monthly',
            price_id: subscription.items.data[0].price.id,
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