/**
 * Stripe Subscription API Handler
 * Deploy this as a Vercel Serverless Function
 *
 * Environment Variables Required:
 * - STRIPE_SECRET_KEY: Your Stripe secret key
 */

// For Vercel deployment
export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Initialize Stripe
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

    const { paymentMethodId, priceId, email } = req.body;

    if (!paymentMethodId || !priceId) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        // Create or get customer
        let customer;

        if (email) {
            // Check if customer exists
            const existingCustomers = await stripe.customers.list({
                email: email,
                limit: 1
            });

            if (existingCustomers.data.length > 0) {
                customer = existingCustomers.data[0];
                // Update payment method
                await stripe.paymentMethods.attach(paymentMethodId, {
                    customer: customer.id
                });
                await stripe.customers.update(customer.id, {
                    invoice_settings: { default_payment_method: paymentMethodId }
                });
            } else {
                // Create new customer
                customer = await stripe.customers.create({
                    email,
                    payment_method: paymentMethodId,
                    invoice_settings: { default_payment_method: paymentMethodId }
                });
            }
        } else {
            // Create customer without email
            customer = await stripe.customers.create({
                payment_method: paymentMethodId,
                invoice_settings: { default_payment_method: paymentMethodId }
            });
        }

        // Create subscription with 7-day trial
        const subscription = await stripe.subscriptions.create({
            customer: customer.id,
            items: [{ price: priceId }],
            trial_period_days: 7,
            payment_settings: {
                payment_method_types: ['card'],
                save_default_payment_method: 'on_subscription'
            },
            expand: ['latest_invoice.payment_intent']
        });

        // Check subscription status
        if (subscription.status === 'active' || subscription.status === 'trialing') {
            return res.json({
                subscriptionId: subscription.id,
                status: subscription.status,
                currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString()
            });
        }

        // If requires action (3D Secure)
        const invoice = subscription.latest_invoice;
        if (invoice.payment_intent) {
            const paymentIntent = invoice.payment_intent;

            if (paymentIntent.status === 'requires_action') {
                return res.json({
                    subscriptionId: subscription.id,
                    status: 'requires_action',
                    clientSecret: paymentIntent.client_secret
                });
            }
        }

        return res.json({
            subscriptionId: subscription.id,
            status: subscription.status
        });

    } catch (error) {
        console.error('Subscription error:', error);
        return res.status(400).json({
            error: error.message || 'Failed to create subscription'
        });
    }
}

/**
 * For subscription status check endpoint
 * Create separate file: api/subscription-status.js
 */
export async function checkStatus(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const { subscriptionId } = req.body;

    if (!subscriptionId) {
        return res.status(400).json({ error: 'Missing subscription ID' });
    }

    try {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);

        return res.json({
            status: subscription.status,
            currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
            cancelAtPeriodEnd: subscription.cancel_at_period_end
        });
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
}
