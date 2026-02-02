# FocusFlow Deployment Guide

## 🚀 Quick Deploy Options

### Option 1: Vercel (Recommended - Free)

1. **Sign up** at https://vercel.com (free tier available)

2. **Install Vercel CLI**:
   ```bash
   npm install -g vercel
   ```

3. **Deploy**:
   ```bash
   cd focusflow
   vercel
   ```

4. **That's it!** Your app is live at `https://your-project.vercel.app`

### Option 2: Netlify (Free)

1. **Sign up** at https://netlify.com

2. **Drag & Drop Deploy**:
   - Go to https://app.netlify.com/drop
   - Drag the entire `focusflow` folder
   - Done!

3. Or use CLI:
   ```bash
   npm install -g netlify-cli
   netlify deploy --prod --dir=.
   ```

### Option 3: GitHub Pages (Free)

1. **Create GitHub repo** and push code

2. **Enable Pages**:
   - Go to Settings → Pages
   - Select `main` branch
   - Save

3. **Access** at `https://username.github.io/repo-name`

---

## 💳 Setting Up Stripe Payments

### Step 1: Create Stripe Account

1. Sign up at https://dashboard.stripe.com/register
2. Complete business verification

### Step 2: Get API Keys

1. Go to Developers → API keys
2. Copy your **Publishable key** (starts with `pk_`)
3. Copy your **Secret key** (starts with `sk_`) - keep this secret!

### Step 3: Create Products & Prices

1. Go to Products → Add product
2. Create **FocusFlow Pro Monthly**:
   - Price: $4.99/month
   - Billing period: Monthly
   - Copy the **Price ID** (starts with `price_`)

3. Create **FocusFlow Pro Yearly**:
   - Price: $39.99/year
   - Billing period: Yearly
   - Copy the **Price ID**

### Step 4: Update Code

Edit `js/payment.js`:

```javascript
// Line 12 - Replace with your publishable key
STRIPE_PUBLISHABLE_KEY: 'pk_live_YOUR_ACTUAL_KEY',

// Lines 15-18 - Replace with your price IDs
PRICE_IDS: {
    monthly: 'price_YOUR_MONTHLY_PRICE_ID',
    yearly: 'price_YOUR_YEARLY_PRICE_ID'
},
```

### Step 5: Backend API (Required for Real Payments)

You need a simple backend to handle subscriptions securely.

**Option A: Vercel Serverless Functions**

Create `api/create-subscription.js`:

```javascript
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).end();
    }

    const { paymentMethodId, priceId, email } = req.body;

    try {
        // Create customer
        const customer = await stripe.customers.create({
            email,
            payment_method: paymentMethodId,
            invoice_settings: { default_payment_method: paymentMethodId }
        });

        // Create subscription with trial
        const subscription = await stripe.subscriptions.create({
            customer: customer.id,
            items: [{ price: priceId }],
            trial_period_days: 7,
            expand: ['latest_invoice.payment_intent']
        });

        res.json({
            subscriptionId: subscription.id,
            status: subscription.status,
            currentPeriodEnd: subscription.current_period_end
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
}
```

**Option B: Use Stripe Payment Links (No Backend)**

1. Create a Payment Link in Stripe Dashboard
2. Replace the upgrade button to redirect to the link
3. Handle success via webhook or manual verification

---

## 🔧 Environment Variables

For production, set these environment variables:

| Variable | Description |
|----------|-------------|
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key |
| `STRIPE_SECRET_KEY` | Stripe secret key (backend only) |
| `STRIPE_WEBHOOK_SECRET` | For webhook verification |

### Vercel
```bash
vercel env add STRIPE_SECRET_KEY
```

### Netlify
Go to Site settings → Environment variables

---

## 📊 Analytics Setup (Optional but Recommended)

### Google Analytics 4

1. Create property at https://analytics.google.com
2. Get Measurement ID (G-XXXXXXX)
3. Add to `index.html` before `</head>`:

```html
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXX');
</script>
```

### Simple Analytics (Privacy-focused, Paid)
```html
<script async defer src="https://scripts.simpleanalyticscdn.com/latest.js"></script>
```

---

## 🎨 Custom Domain

### Vercel
1. Go to Project Settings → Domains
2. Add your domain
3. Update DNS as instructed

### Netlify
1. Go to Site settings → Domain management
2. Add custom domain
3. Update DNS

### Recommended Domain Ideas
- focusflow.app
- getfocusflow.com
- usefocusflow.com
- tryfocusflow.com

---

## 📱 App Store Submission (Optional)

### Using PWA Builder

1. Go to https://www.pwabuilder.com
2. Enter your deployed URL
3. Generate packages for:
   - Microsoft Store
   - Google Play Store
   - iOS (via App Clips)

### Google Play Store

1. Generate signed APK via PWA Builder
2. Create developer account ($25 one-time)
3. Submit app with:
   - App description
   - Screenshots
   - Privacy policy

---

## 📈 Marketing Checklist

### Pre-Launch
- [ ] Custom domain set up
- [ ] Analytics installed
- [ ] Privacy policy page
- [ ] Terms of service page
- [ ] Social media accounts created

### Launch Channels (Free)
- [ ] Product Hunt - https://producthunt.com
- [ ] Hacker News (Show HN)
- [ ] Reddit - r/ADHD, r/productivity, r/webdev
- [ ] Twitter/X with #buildinpublic
- [ ] IndieHackers - https://indiehackers.com
- [ ] Dev.to blog post

### Paid Marketing (Optional)
- Google Ads (ADHD-related keywords)
- Facebook/Instagram Ads
- Podcast sponsorships (ADHD podcasts)

---

## 🛠 Maintenance

### Weekly
- Check Stripe for failed payments
- Review analytics
- Respond to user feedback

### Monthly
- Update dependencies
- Review and optimize performance
- Add requested features

---

## 📞 Support

For deployment issues:
- Vercel: https://vercel.com/docs
- Netlify: https://docs.netlify.com
- Stripe: https://stripe.com/docs

Good luck with your launch! 🚀
