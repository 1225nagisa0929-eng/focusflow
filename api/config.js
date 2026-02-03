/**
 * API endpoint to provide public configuration to the client
 * This safely exposes only public keys (anon key is safe to expose)
 */

export default function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Return public configuration
    // Note: Supabase anon key is safe to expose - it's meant for client-side use
    // Row Level Security (RLS) in Supabase protects your data
    res.status(200).json({
        supabaseUrl: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
        supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '',
        stripePublicKey: process.env.VITE_STRIPE_PUBLIC_KEY || process.env.STRIPE_PUBLIC_KEY || ''
    });
}
