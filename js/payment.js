/**
 * Nudge Payment Module
 * Stripe Checkout integration for Pro subscriptions
 */

const Payment = {
    stripe: null,
    auth: null,

    async init() {
        // Initialize Stripe - try window global first, then wait for config from API
        await this.initStripe();

        this.bindEvents();

        // Wait for auth to be ready
        setTimeout(() => {
            this.auth = window.nudgeAuth;
            this.updatePaymentUI();
        }, 100);
    },

    async initStripe() {
        // Try window global first (set by auth.js from API config)
        let stripeKey = window.STRIPE_PUBLISHABLE_KEY || window.STRIPE_PUBLIC_KEY;

        // If not available, wait a bit for auth.js to load config
        if (!stripeKey) {
            await new Promise(resolve => setTimeout(resolve, 500));
            stripeKey = window.STRIPE_PUBLISHABLE_KEY || window.STRIPE_PUBLIC_KEY;
        }

        if (stripeKey && stripeKey !== '' && !stripeKey.includes('VITE_')) {
            try {
                this.stripe = Stripe(stripeKey);
                console.log('Stripe initialized successfully');
            } catch (e) {
                console.log('Stripe initialization failed:', e);
            }
        }
    },

    bindEvents() {
        // Modal triggers
        const upgradeButtons = [
            document.getElementById('upgrade-btn'),
            document.getElementById('upgrade-sidebar-btn'),
            document.getElementById('pro-plan-btn')
        ];

        upgradeButtons.forEach(btn => {
            if (btn) {
                btn.addEventListener('click', () => this.openModal());
            }
        });

        // Close modal
        const closeBtn = document.getElementById('modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeModal());
        }

        // Close on outside click
        const modal = document.getElementById('payment-modal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.closeModal();
            });
        }

        // Submit payment (redirect to Stripe Checkout)
        const submitBtn = document.getElementById('submit-payment');
        if (submitBtn) {
            submitBtn.addEventListener('click', () => this.handleCheckout());
        }

        // Payment login button
        const paymentLoginBtn = document.getElementById('payment-login-btn');
        if (paymentLoginBtn) {
            paymentLoginBtn.addEventListener('click', () => {
                this.closeModal();
                if (window.nudgeAuth) {
                    window.nudgeAuth.showAuthModal();
                }
            });
        }

        // Plan selection
        document.querySelectorAll('input[name="plan"]').forEach(input => {
            input.addEventListener('change', () => this.updatePlanUI());
        });

        // Close on Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeModal();
        });
    },

    openModal() {
        // Check Pro status first
        if (Storage.isPro()) {
            this.showAlreadyProMessage();
            return;
        }

        const modal = document.getElementById('payment-modal');
        if (modal) {
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
            this.updatePaymentUI();
        }
    },

    closeModal() {
        const modal = document.getElementById('payment-modal');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = '';
        }
    },

    updatePaymentUI() {
        const loginPrompt = document.getElementById('payment-login-prompt');
        const paymentPlans = document.getElementById('payment-plans');
        const submitBtn = document.getElementById('submit-payment');

        const isLoggedIn = this.auth?.isLoggedIn() || false;

        if (loginPrompt && paymentPlans && submitBtn) {
            if (isLoggedIn) {
                loginPrompt.classList.add('hidden');
                paymentPlans.classList.remove('hidden');
                submitBtn.classList.remove('hidden');
            } else {
                loginPrompt.classList.remove('hidden');
                paymentPlans.classList.add('hidden');
                submitBtn.classList.add('hidden');
            }
        }
    },

    updatePlanUI() {
        const selectedPlan = document.querySelector('input[name="plan"]:checked')?.value;
        const submitBtn = document.getElementById('submit-payment');

        if (submitBtn) {
            submitBtn.textContent = 'Start Free Trial';
        }
    },

    async handleCheckout() {
        const submitBtn = document.getElementById('submit-payment');
        const selectedPlan = document.querySelector('input[name="plan"]:checked')?.value || 'monthly';

        // Check if user is logged in
        if (!this.auth?.isLoggedIn()) {
            this.closeModal();
            this.auth?.showAuthModal();
            return;
        }

        // Demo mode if Stripe not configured
        if (!this.stripe) {
            await this.handleDemoCheckout(selectedPlan);
            return;
        }

        // Start loading
        submitBtn.disabled = true;
        submitBtn.textContent = 'Redirecting to checkout...';

        try {
            const user = this.auth.getUser();

            // Call backend to create Checkout Session
            const response = await fetch('/api/checkout_sessions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    plan: selectedPlan,
                    userId: user?.id || null,
                    userEmail: user?.email || null,
                }),
            });

            const data = await response.json();

            if (data.error) {
                throw new Error(data.error);
            }

            // Redirect to Stripe Checkout
            if (data.url) {
                window.location.href = data.url;
            } else if (data.sessionId) {
                const { error } = await this.stripe.redirectToCheckout({
                    sessionId: data.sessionId,
                });
                if (error) {
                    throw error;
                }
            }

        } catch (error) {
            console.error('Checkout error:', error);
            alert('Failed to start checkout. Please try again.');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Start Free Trial';
        }
    },

    async handleDemoCheckout(selectedPlan) {
        const submitBtn = document.getElementById('submit-payment');

        submitBtn.disabled = true;
        submitBtn.textContent = 'Processing...';

        // Simulate processing
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Set demo Pro status
        Storage.setProStatus({
            isPro: true,
            plan: selectedPlan,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        });

        // Also set in localStorage for quick check
        localStorage.setItem('nudge_is_pro', 'true');

        this.closeModal();
        this.showSuccessMessage();
        this.updateProUI();

        submitBtn.disabled = false;
        submitBtn.textContent = 'Start Free Trial';
    },

    showAlreadyProMessage() {
        const toast = document.createElement('div');
        toast.className = 'toast toast-success';
        toast.innerHTML = `
            <span class="toast-icon">✨</span>
            <div class="toast-content">
                <strong>You're already Pro!</strong>
                <p>Enjoy all your premium features.</p>
            </div>
        `;

        document.body.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    showSuccessMessage() {
        const toast = document.createElement('div');
        toast.className = 'toast toast-success';
        toast.innerHTML = `
            <span class="toast-icon">🎉</span>
            <div class="toast-content">
                <strong>Welcome to Pro!</strong>
                <p>Your 7-day free trial has started.</p>
            </div>
        `;

        document.body.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    },

    updateProUI() {
        const isPro = Storage.isPro();

        // Update upgrade buttons
        const upgradeBtn = document.getElementById('upgrade-btn');
        if (upgradeBtn && isPro) {
            upgradeBtn.textContent = 'Pro ✓';
            upgradeBtn.disabled = true;
            upgradeBtn.classList.add('btn-pro-active');
        }

        const sidebarBtn = document.getElementById('upgrade-sidebar-btn');
        if (sidebarBtn && isPro) {
            sidebarBtn.textContent = 'Pro Member ✓';
            sidebarBtn.disabled = true;
            sidebarBtn.classList.add('btn-disabled');
        }

        const proPlanBtn = document.getElementById('pro-plan-btn');
        if (proPlanBtn && isPro) {
            proPlanBtn.textContent = 'Current Plan ✓';
            proPlanBtn.disabled = true;
            proPlanBtn.classList.add('btn-disabled');
        }

        // Update pro teaser in sidebar
        const proTeaser = document.getElementById('pro-teaser');
        if (proTeaser && isPro) {
            proTeaser.innerHTML = `
                <h4>✨ Pro Member</h4>
                <p class="pro-thanks">Thank you for supporting Nudge!</p>
                <ul>
                    <li>✓ Weekly focus reports</li>
                    <li>✓ Custom ambient sounds</li>
                    <li>✓ Focus goals & reminders</li>
                    <li>✓ Dark mode</li>
                    <li>✓ Sync across devices</li>
                </ul>
            `;
        }

        // Add body class for Pro users
        if (isPro) {
            document.body.classList.add('is-pro');
            this.enableProFeatures();
        }
    },

    enableProFeatures() {
        // Enable dark mode toggle
        const settings = Storage.getSettings();
        if (settings.darkMode) {
            document.body.classList.add('dark-mode');
        }
        console.log('Pro features enabled');
    }
};

// Export
window.Payment = Payment;
