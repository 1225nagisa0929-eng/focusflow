/**
 * Nudge Authentication Module
 * Handles Supabase authentication with Google OAuth and Magic Link
 */

class NudgeAuth {
    constructor() {
        // Supabase configuration - will be loaded from API
        this.supabaseUrl = '';
        this.supabaseAnonKey = '';
        this.supabase = null;
        this.user = null;
        this.session = null;
        this.listeners = [];
        this.configLoaded = false;

        // DOM Elements
        this.elements = {
            loginBtn: document.getElementById('login-btn'),
            userMenu: document.getElementById('user-menu'),
            userAvatar: document.getElementById('user-avatar'),
            userEmail: document.getElementById('user-email'),
            logoutBtn: document.getElementById('logout-btn'),
            authModal: document.getElementById('auth-modal'),
            authModalClose: document.getElementById('auth-modal-close'),
            googleLoginBtn: document.getElementById('google-login-btn'),
            magicLinkForm: document.getElementById('magic-link-form'),
            magicLinkEmail: document.getElementById('magic-link-email'),
            magicLinkBtn: document.getElementById('magic-link-btn'),
            authMessage: document.getElementById('auth-message')
        };

        this.init();
    }

    async loadConfig() {
        // Try multiple sources for configuration
        // 1. First check window globals (for local dev or inline scripts)
        if (window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
            this.supabaseUrl = window.SUPABASE_URL;
            this.supabaseAnonKey = window.SUPABASE_ANON_KEY;
            console.log('Config loaded from window globals');
            return true;
        }

        // 2. Try loading from API endpoint (for Vercel deployment)
        try {
            const response = await fetch('/api/config');
            if (response.ok) {
                const config = await response.json();
                if (config.supabaseUrl && config.supabaseAnonKey) {
                    this.supabaseUrl = config.supabaseUrl;
                    this.supabaseAnonKey = config.supabaseAnonKey;
                    // Also store Stripe key if available
                    if (config.stripePublicKey) {
                        window.STRIPE_PUBLIC_KEY = config.stripePublicKey;
                    }
                    console.log('Config loaded from API');
                    return true;
                }
            }
        } catch (error) {
            console.warn('Failed to load config from API:', error);
        }

        console.error('Supabase configuration not found. Please set environment variables.');
        return false;
    }

    async init() {
        // Load configuration first
        this.configLoaded = await this.loadConfig();

        // Initialize Supabase client
        if (this.configLoaded && this.supabaseUrl && this.supabaseAnonKey) {
            const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
            this.supabase = createClient(this.supabaseUrl, this.supabaseAnonKey);

            // Check for existing session
            await this.checkSession();

            // Listen for auth changes
            this.supabase.auth.onAuthStateChange((event, session) => {
                this.handleAuthChange(event, session);
            });
        }

        this.bindEvents();
    }

    bindEvents() {
        // Login button
        this.elements.loginBtn?.addEventListener('click', () => this.showAuthModal());

        // Close modal
        this.elements.authModalClose?.addEventListener('click', () => this.hideAuthModal());

        // Google login
        this.elements.googleLoginBtn?.addEventListener('click', () => this.signInWithGoogle());

        // Magic link form
        this.elements.magicLinkForm?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.signInWithMagicLink();
        });

        // Logout
        this.elements.logoutBtn?.addEventListener('click', () => this.signOut());

        // Close modal on outside click
        this.elements.authModal?.addEventListener('click', (e) => {
            if (e.target === this.elements.authModal) {
                this.hideAuthModal();
            }
        });
    }

    async checkSession() {
        if (!this.supabase) return;

        const { data: { session } } = await this.supabase.auth.getSession();
        if (session) {
            this.session = session;
            this.user = session.user;
            this.updateUI();
        }
    }

    handleAuthChange(event, session) {
        console.log('Auth event:', event);
        this.session = session;
        this.user = session?.user || null;
        this.updateUI();

        // Notify listeners
        this.listeners.forEach(callback => callback(this.user, event));

        if (event === 'SIGNED_IN') {
            this.hideAuthModal();
            this.showMessage('Welcome! You are now logged in.', 'success');
        } else if (event === 'SIGNED_OUT') {
            this.showMessage('You have been logged out.', 'info');
        }
    }

    async signInWithGoogle() {
        if (!this.supabase) {
            this.showMessage('Authentication not configured', 'error');
            return;
        }

        this.setLoading(true);

        const { error } = await this.supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin
            }
        });

        if (error) {
            this.showMessage(error.message, 'error');
            this.setLoading(false);
        }
    }

    async signInWithMagicLink() {
        if (!this.supabase) {
            this.showMessage('Authentication service is loading... Please try again in a moment.', 'error');
            // Try to reload config
            if (!this.configLoaded) {
                await this.init();
            }
            return;
        }

        const email = this.elements.magicLinkEmail?.value?.trim();
        if (!email) {
            this.showMessage('Please enter your email', 'error');
            return;
        }

        this.setLoading(true);

        const { error } = await this.supabase.auth.signInWithOtp({
            email,
            options: {
                emailRedirectTo: window.location.origin
            }
        });

        this.setLoading(false);

        if (error) {
            this.showMessage(error.message, 'error');
        } else {
            this.showMessage('Check your email for the login link!', 'success');
            this.elements.magicLinkEmail.value = '';
        }
    }

    async signOut() {
        if (!this.supabase) return;

        const { error } = await this.supabase.auth.signOut();
        if (error) {
            this.showMessage(error.message, 'error');
        }
    }

    updateUI() {
        if (this.user) {
            // User is logged in
            this.elements.loginBtn?.classList.add('hidden');
            this.elements.userMenu?.classList.remove('hidden');

            // Set avatar
            const avatarUrl = this.user.user_metadata?.avatar_url ||
                              this.user.user_metadata?.picture ||
                              this.getInitialsAvatar(this.user.email);

            if (this.elements.userAvatar) {
                if (avatarUrl.startsWith('http')) {
                    this.elements.userAvatar.innerHTML = `<img src="${avatarUrl}" alt="Avatar" />`;
                } else {
                    this.elements.userAvatar.innerHTML = avatarUrl;
                }
            }

            // Set email
            if (this.elements.userEmail) {
                this.elements.userEmail.textContent = this.user.email;
            }

            // Check Pro status
            this.checkProStatus();
        } else {
            // User is logged out
            this.elements.loginBtn?.classList.remove('hidden');
            this.elements.userMenu?.classList.add('hidden');
        }
    }

    getInitialsAvatar(email) {
        const initial = email ? email.charAt(0).toUpperCase() : '?';
        return `<span class="avatar-initial">${initial}</span>`;
    }

    checkProStatus() {
        // Check user_metadata or localStorage for Pro status
        const isPro = this.user?.user_metadata?.is_pro ||
                      localStorage.getItem('nudge_is_pro') === 'true';

        if (isPro) {
            document.body.classList.add('is-pro');
            // Update UI elements for Pro users
            const upgradeBtn = document.getElementById('upgrade-btn');
            if (upgradeBtn) {
                upgradeBtn.textContent = 'Pro ✓';
                upgradeBtn.classList.add('btn-pro-active');
                upgradeBtn.disabled = true;
            }
        }

        return isPro;
    }

    showAuthModal() {
        this.elements.authModal?.classList.add('show');
        document.body.style.overflow = 'hidden';
    }

    hideAuthModal() {
        this.elements.authModal?.classList.remove('show');
        document.body.style.overflow = '';
        this.clearMessage();
    }

    showMessage(text, type = 'info') {
        if (this.elements.authMessage) {
            this.elements.authMessage.textContent = text;
            this.elements.authMessage.className = `auth-message ${type}`;
            this.elements.authMessage.classList.remove('hidden');
        }
    }

    clearMessage() {
        if (this.elements.authMessage) {
            this.elements.authMessage.classList.add('hidden');
        }
    }

    setLoading(isLoading) {
        const buttons = [this.elements.googleLoginBtn, this.elements.magicLinkBtn];
        buttons.forEach(btn => {
            if (btn) {
                btn.disabled = isLoading;
                if (isLoading) {
                    btn.dataset.originalText = btn.textContent;
                    btn.textContent = 'Loading...';
                } else if (btn.dataset.originalText) {
                    btn.textContent = btn.dataset.originalText;
                }
            }
        });
    }

    // Subscribe to auth changes
    onAuthChange(callback) {
        this.listeners.push(callback);
        // Return unsubscribe function
        return () => {
            this.listeners = this.listeners.filter(cb => cb !== callback);
        };
    }

    // Get current user
    getUser() {
        return this.user;
    }

    // Check if user is logged in
    isLoggedIn() {
        return !!this.user;
    }

    // Get access token for API calls
    async getAccessToken() {
        if (!this.session) return null;
        return this.session.access_token;
    }
}

// Export for use in other modules
window.NudgeAuth = NudgeAuth;
