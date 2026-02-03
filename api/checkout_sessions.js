/**
 * Stripe Checkout Session API
 * Creates a Checkout Session for Pro subscription
 *
 * Environment Variables Required:
 * - STRIPE_SECRET_KEY: Your Stripe secret key
 * - STRIPE_PRICE_MONTHLY: Price ID for monthly subscription
 * - STRIPE_PRICE_YEARLY: Price ID for yearly subscription
 */

import Stripe from 'stripe';

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Check for Stripe secret key
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
        console.error('STRIPE_SECRET_KEY not configured');
        return res.status(500).json({ error: 'Payment system not configured' });
    }

    const stripe = new Stripe(stripeSecretKey);

    try {
        const { plan, userId, userEmail } = req.body;

        if (!plan || !['monthly', 'yearly'].includes(plan)) {
            return res.status(400).json({ error: 'Invalid plan selected' });
        }

        // Get price ID based on plan
        const priceId = plan === 'monthly'
            ? process.env.STRIPE_PRICE_MONTHLY
            : process.env.STRIPE_PRICE_YEARLY;

        if (!priceId) {
            console.error(`STRIPE_PRICE_${plan.toUpperCase()} not configured`);
            return res.status(500).json({ error: 'Price not configured' });
        }

        // Get the origin for redirect URLs
        const origin = req.headers.origin || req.headers.referer?.replace(/\/$/, '') || 'https://nudge.app';

        // Create Checkout Session
        const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            payment_method_types: ['card'],
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            // 7-day free trial
            subscription_data: {
                trial_period_days: 7,
                metadata: {
                    userId: userId || 'anonymous',
                },
            },
            // Customer info
            customer_email: userEmail || undefined,
            // Redirect URLs
            success_url: `${origin}/success.html?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${origin}/#pricing`,
            // Metadata
            metadata: {
                userId: userId || 'anonymous',
                plan: plan,
            },
            // Allow promotion codes
            allow_promotion_codes: true,
        });

        return res.status(200).json({
            sessionId: session.id,
            url: session.url,
        });

    } catch (error) {
        console.error('Stripe checkout error:', error);
        return res.status(500).json({
            error: 'Failed to create checkout session',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        });
    }
}
