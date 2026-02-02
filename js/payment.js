/**
 * FocusFlow Payment Module
 * Stripe integration for Pro subscriptions
 */

const Payment = {
    stripe: null,
    elements: null,
    cardElement: null,

    // Stripe publishable key - REPLACE with your actual key
    // Test key for development, live key for production
    STRIPE_PUBLISHABLE_KEY: 'pk_test_YOUR_STRIPE_PUBLISHABLE_KEY',

    // Price IDs from Stripe Dashboard - REPLACE with your actual IDs
    PRICE_IDS: {
        monthly: 'price_monthly_YOUR_PRICE_ID',
        yearly: 'price_yearly_YOUR_PRICE_ID'
    },

    // Your backend API URL - REPLACE with your actual endpoint
    API_URL: '/api', // or 'https://your-backend.com/api'

    init() {
        // Initialize Stripe
        try {
            this.stripe = Stripe(this.STRIPE_PUBLISHABLE_KEY);
        } catch (e) {
            console.log('Stripe not initialized - add your API key');
        }

        this.bindEvents();
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

        // Submit payment
        const submitBtn = document.getElementById('submit-payment');
        if (submitBtn) {
            submitBtn.addEventListener('click', () => this.handleSubmit());
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
        const modal = document.getElementById('payment-modal');
        if (modal) {
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
            this.mountCardElement();
        }
    },

    closeModal() {
        const modal = document.getElementById('payment-modal');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = '';
            this.unmountCardElement();
        }
    },

    mountCardElement() {
        if (!this.stripe) {
            // Show demo message if Stripe not configured
            const cardContainer = document.getElementById('stripe-card-element');
            if (cardContainer) {
                cardContainer.innerHTML = `
                    <div class="demo-notice">
                        <p>💳 Payment demo mode</p>
                        <p class="small">Configure Stripe keys in payment.js to enable real payments</p>
                    </div>
                `;
            }
            return;
        }

        if (this.cardElement) return; // Already mounted

        this.elements = this.stripe.elements({
            fonts: [
                {
                    cssSrc: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500&display=swap'
                }
            ]
        });

        this.cardElement = this.elements.create('card', {
            style: {
                base: {
                    fontSize: '16px',
                    fontFamily: 'Inter, system-ui, sans-serif',
                    color: '#1f2937',
                    '::placeholder': {
                        color: '#9ca3af'
                    }
                },
                invalid: {
                    color: '#ef4444',
                    iconColor: '#ef4444'
                }
            }
        });

        this.cardElement.mount('#stripe-card-element');

        // Handle errors
        this.cardElement.on('change', (event) => {
            const displayError = document.getElementById('card-errors');
            if (event.error) {
                displayError.textContent = event.error.message;
            } else {
                displayError.textContent = '';
            }
        });
    },

    unmountCardElement() {
        if (this.cardElement) {
            this.cardElement.unmount();
            this.cardElement = null;
        }
    },

    updatePlanUI() {
        const selectedPlan = document.querySelector('input[name="plan"]:checked').value;
        const submitBtn = document.getElementById('submit-payment');

        if (submitBtn) {
            const price = selectedPlan === 'yearly' ? '$39.99/year' : '$4.99/month';
            submitBtn.textContent = `Start Free Trial`;
        }
    },

    async handleSubmit() {
        const submitBtn = document.getElementById('submit-payment');
        const errorDisplay = document.getElementById('card-errors');
        const selectedPlan = document.querySelector('input[name="plan"]:checked').value;

        // Demo mode - simulate success
        if (!this.stripe) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Processing...';

            // Simulate processing
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Set demo Pro status
            Storage.setProStatus({
                isPro: true,
                plan: selectedPlan,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 day trial
            });

            this.closeModal();
            this.showSuccessMessage();
            this.updateProUI();

            submitBtn.disabled = false;
            submitBtn.textContent = 'Start Free Trial';
            return;
        }

        // Real Stripe integration
        submitBtn.disabled = true;
        submitBtn.textContent = 'Processing...';

        try {
            // Create payment method
            const { error, paymentMethod } = await this.stripe.createPaymentMethod({
                type: 'card',
                card: this.cardElement
            });

            if (error) {
                errorDisplay.textContent = error.message;
                submitBtn.disabled = false;
                submitBtn.textContent = 'Start Free Trial';
                return;
            }

            // Send to backend to create subscription
            const response = await fetch(`${this.API_URL}/create-subscription`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    paymentMethodId: paymentMethod.id,
                    priceId: this.PRICE_IDS[selectedPlan]
                })
            });

            const data = await response.json();

            if (data.error) {
                errorDisplay.textContent = data.error;
                submitBtn.disabled = false;
                submitBtn.textContent = 'Start Free Trial';
                return;
            }

            // Handle subscription states
            if (data.status === 'active' || data.status === 'trialing') {
                // Success!
                Storage.setProStatus({
                    isPro: true,
                    plan: selectedPlan,
                    subscriptionId: data.subscriptionId,
                    expiresAt: data.currentPeriodEnd
                });

                this.closeModal();
                this.showSuccessMessage();
                this.updateProUI();
            } else if (data.clientSecret) {
                // Requires additional authentication (3D Secure)
                const { error: confirmError } = await this.stripe.confirmCardPayment(data.clientSecret);

                if (confirmError) {
                    errorDisplay.textContent = confirmError.message;
                } else {
                    Storage.setProStatus({
                        isPro: true,
                        plan: selectedPlan,
                        subscriptionId: data.subscriptionId,
                        expiresAt: data.currentPeriodEnd
                    });

                    this.closeModal();
                    this.showSuccessMessage();
                    this.updateProUI();
                }
            }
        } catch (err) {
            errorDisplay.textContent = 'An error occurred. Please try again.';
            console.error('Payment error:', err);
        }

        submitBtn.disabled = false;
        submitBtn.textContent = 'Start Free Trial';
    },

    showSuccessMessage() {
        // Create toast notification
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

        // Animate in
        setTimeout(() => toast.classList.add('show'), 10);

        // Remove after 5 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    },

    updateProUI() {
        const isPro = Storage.isPro();

        // Update upgrade buttons
        const upgradeButtons = document.querySelectorAll('#upgrade-btn, #upgrade-sidebar-btn, #pro-plan-btn');
        upgradeButtons.forEach(btn => {
            if (btn && isPro) {
                btn.textContent = 'Pro Member ✓';
                btn.disabled = true;
                btn.classList.add('btn-disabled');
            }
        });

        // Hide pro teaser in sidebar
        const proTeaser = document.getElementById('pro-teaser');
        if (proTeaser && isPro) {
            proTeaser.innerHTML = `
                <h4>✨ Pro Member</h4>
                <p class="pro-thanks">Thank you for supporting FocusFlow!</p>
                <ul>
                    <li>✓ Weekly focus reports</li>
                    <li>✓ Custom ambient sounds</li>
                    <li>✓ Focus goals & reminders</li>
                    <li>✓ Dark mode</li>
                    <li>✓ Sync across devices</li>
                </ul>
            `;
        }

        // Enable Pro features
        if (isPro) {
            this.enableProFeatures();
        }
    },

    enableProFeatures() {
        // Enable dark mode toggle
        const settings = Storage.getSettings();
        if (settings.darkMode) {
            document.body.classList.add('dark-mode');
        }

        // Add dark mode toggle to settings
        // Add ambient sounds player
        // Enable weekly reports
        console.log('Pro features enabled');
    },

    // Check subscription status with backend
    async checkSubscriptionStatus() {
        const proStatus = Storage.getProStatus();

        if (!proStatus.subscriptionId) return;

        try {
            const response = await fetch(`${this.API_URL}/subscription-status`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    subscriptionId: proStatus.subscriptionId
                })
            });

            const data = await response.json();

            if (data.status === 'active' || data.status === 'trialing') {
                Storage.setProStatus({
                    ...proStatus,
                    expiresAt: data.currentPeriodEnd
                });
            } else {
                // Subscription cancelled or expired
                Storage.setProStatus({
                    isPro: false,
                    expiresAt: null,
                    plan: null
                });
            }
        } catch (err) {
            console.error('Error checking subscription:', err);
        }
    }
};

// Export
window.Payment = Payment;
