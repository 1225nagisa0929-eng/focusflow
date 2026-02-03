/**
 * Nudge - Main Application
 * ADHD-Friendly Focus Timer
 */

class NudgeApp {
    constructor() {
        this.timer = null;
        this.auth = null;
        this.currentView = 'landing'; // 'landing' or 'timer'
    }

    async init() {
        // Initialize storage
        Storage.init();

        // Initialize authentication
        this.auth = new NudgeAuth();
        window.nudgeAuth = this.auth;

        // Wait a bit for auth to initialize
        await new Promise(resolve => setTimeout(resolve, 100));

        // Initialize payment
        Payment.init();

        // Check and update Pro UI
        Payment.updateProUI();

        // Bind navigation events
        this.bindEvents();

        // Request notification permission
        this.requestNotificationPermission();

        // Listen for auth changes
        this.auth.onAuthChange((user, event) => {
            this.handleAuthChange(user, event);
        });
    }

    handleAuthChange(user, event) {
        // Update payment UI when auth changes
        if (Payment.updatePaymentUI) {
            Payment.updatePaymentUI();
        }

        // If user just signed in, check their Pro status
        if (event === 'SIGNED_IN' && user) {
            const isPro = user.user_metadata?.is_pro ||
                         localStorage.getItem('nudge_is_pro') === 'true';
            if (isPro) {
                Payment.updateProUI();
            }
        }
    }

    bindEvents() {
        // Start buttons - show timer section
        const startButtons = [
            document.getElementById('start-hero-btn'),
            document.getElementById('cta-start-btn'),
            document.getElementById('free-plan-btn')
        ];

        startButtons.forEach(btn => {
            if (btn) {
                btn.addEventListener('click', () => this.showTimer());
            }
        });

        // Logo click - return to top/landing
        const navBrand = document.querySelector('.nav-brand');
        if (navBrand) {
            navBrand.addEventListener('click', (e) => {
                e.preventDefault();
                if (this.currentView === 'timer') {
                    this.showLanding();
                }
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        }

        // Nav links with timer view handling
        document.querySelectorAll('.nav-link').forEach(anchor => {
            anchor.addEventListener('click', (e) => {
                const targetId = anchor.getAttribute('href');
                if (targetId === '#' || !targetId) return;

                e.preventDefault();

                // If in timer view, switch to landing first
                if (this.currentView === 'timer') {
                    this.showLanding(true);
                    // Wait for DOM update then scroll
                    setTimeout(() => {
                        const target = document.querySelector(targetId);
                        if (target) {
                            target.scrollIntoView({
                                behavior: 'smooth',
                                block: 'start'
                            });
                        }
                    }, 100);
                } else {
                    const target = document.querySelector(targetId);
                    if (target) {
                        target.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start'
                        });
                    }
                }
            });
        });

        // Footer links with same behavior
        document.querySelectorAll('.footer-links a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', (e) => {
                const targetId = anchor.getAttribute('href');
                if (targetId === '#' || !targetId) return;

                e.preventDefault();

                if (this.currentView === 'timer') {
                    this.showLanding(true);
                    setTimeout(() => {
                        const target = document.querySelector(targetId);
                        if (target) {
                            target.scrollIntoView({
                                behavior: 'smooth',
                                block: 'start'
                            });
                        }
                    }, 100);
                } else {
                    const target = document.querySelector(targetId);
                    if (target) {
                        target.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start'
                        });
                    }
                }
            });
        });

        // Handle browser back button
        window.addEventListener('popstate', (e) => {
            if (e.state && e.state.view === 'timer') {
                this.showTimer(false);
            } else {
                this.showLanding(false);
            }
        });

        // Scroll effect for nav glassmorphism
        window.addEventListener('scroll', () => {
            const nav = document.querySelector('.nav');
            if (nav) {
                if (window.scrollY > 50) {
                    nav.classList.add('scrolled');
                } else {
                    nav.classList.remove('scrolled');
                }
            }
        });

        // User menu dropdown toggle (for mobile)
        const userMenuTrigger = document.getElementById('user-menu-trigger');
        const userDropdown = document.getElementById('user-dropdown');
        if (userMenuTrigger && userDropdown) {
            userMenuTrigger.addEventListener('click', () => {
                userDropdown.classList.toggle('show');
            });

            // Close dropdown when clicking outside
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.user-menu')) {
                    userDropdown.classList.remove('show');
                }
            });
        }
    }

    showTimer(pushState = true) {
        // Hide landing sections
        document.getElementById('hero').style.display = 'none';
        document.querySelector('.features').style.display = 'none';
        document.querySelector('.pricing').style.display = 'none';
        document.querySelector('.testimonials').style.display = 'none';
        document.querySelector('.faq').style.display = 'none';
        document.querySelector('.cta').style.display = 'none';

        // Show timer section
        document.getElementById('timer-section').style.display = 'grid';

        // Initialize timer if not already
        if (!this.timer) {
            this.timer = new FocusTimer();
        }

        // Update URL without reload
        if (pushState) {
            history.pushState({ view: 'timer' }, '', '#timer');
        }

        this.currentView = 'timer';

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    showLanding(pushState = true) {
        // Show landing sections
        document.getElementById('hero').style.display = 'flex';
        document.querySelector('.features').style.display = 'block';
        document.querySelector('.pricing').style.display = 'block';
        document.querySelector('.testimonials').style.display = 'block';
        document.querySelector('.faq').style.display = 'block';
        document.querySelector('.cta').style.display = 'block';

        // Hide timer section
        document.getElementById('timer-section').style.display = 'none';

        // Update URL
        if (pushState) {
            history.pushState({ view: 'landing' }, '', '/');
        }

        this.currentView = 'landing';
    }

    requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            // Ask after user interaction
            const askPermission = () => {
                Notification.requestPermission();
                document.removeEventListener('click', askPermission);
            };

            // Wait for first click
            document.addEventListener('click', askPermission, { once: true });
        }
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new NudgeApp();
    window.app.init();

    // Check URL hash
    if (window.location.hash === '#timer') {
        window.app.showTimer(false);
    }
});

// Handle PWA install prompt
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;

    // Show custom install button (optional)
    // Could add a banner or button to trigger installation
});

// Track successful installation
window.addEventListener('appinstalled', () => {
    console.log('Nudge installed successfully');
    deferredPrompt = null;
});
