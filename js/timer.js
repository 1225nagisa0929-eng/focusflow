/**
 * FocusFlow Timer Module
 * ADHD-friendly timer with flexible adjustments and gentle transitions
 */

class FocusTimer {
    constructor() {
        // Timer settings (in minutes)
        this.settings = {
            focusDuration: 25,
            shortBreakDuration: 5,
            longBreakDuration: 15,
            sessionsBeforeLongBreak: 4
        };

        // Timer state
        this.state = {
            isRunning: false,
            isPaused: false,
            currentMode: 'focus', // 'focus', 'shortBreak', 'longBreak'
            timeRemaining: this.settings.focusDuration * 60, // in seconds
            totalTime: this.settings.focusDuration * 60,
            currentSession: 1,
            completedSessions: 0
        };

        // DOM elements
        this.elements = {
            minutesDisplay: document.getElementById('timer-minutes'),
            secondsDisplay: document.getElementById('timer-seconds'),
            startBtn: document.getElementById('start-btn'),
            pauseBtn: document.getElementById('pause-btn'),
            skipBtn: document.getElementById('skip-btn'),
            stuckBtn: document.getElementById('stuck-btn'),
            modeBadge: document.getElementById('mode-badge'),
            sessionCount: document.getElementById('session-count'),
            progressCircle: document.getElementById('progress-circle'),
            motivationMessage: document.getElementById('motivation-message'),
            taskInput: document.getElementById('task-input'),
            aiMessage: document.getElementById('ai-message'),
            aiMessageText: document.getElementById('ai-message-text')
        };

        // Interval reference
        this.timerInterval = null;

        // Progress ring circumference
        this.circumference = 2 * Math.PI * 90;

        // Ambient background state
        this.currentAmbientClass = null;

        // Initialize
        this.init();
    }

    init() {
        this.bindEvents();
        this.updateDisplay();
        this.setProgressRing();
        this.loadState();
    }

    bindEvents() {
        // Start button
        this.elements.startBtn.addEventListener('click', () => this.start());

        // Pause button
        this.elements.pauseBtn.addEventListener('click', () => this.pause());

        // Skip button
        this.elements.skipBtn.addEventListener('click', () => this.skip());

        // I'm stuck button
        this.elements.stuckBtn?.addEventListener('click', () => this.getUnstuck());

        // Quick adjust buttons
        document.querySelectorAll('.adjust-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const adjustment = parseInt(e.target.dataset.adjust);
                this.adjustTime(adjustment);
            });
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT') return;

            if (e.code === 'Space') {
                e.preventDefault();
                if (this.state.isRunning) {
                    this.pause();
                } else {
                    this.start();
                }
            }
        });

        // Save task on blur
        this.elements.taskInput?.addEventListener('blur', () => {
            this.saveState();
        });

        // Visibility change - pause when tab hidden (ADHD-friendly)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.state.isRunning) {
                // Keep running but show notification when back
                this.notifyWhenVisible = true;
            } else if (!document.hidden && this.notifyWhenVisible) {
                this.showMotivation('Welcome back! Keep going! 💪');
                this.notifyWhenVisible = false;
            }
        });
    }

    start() {
        if (this.state.isRunning) return;

        this.state.isRunning = true;
        this.state.isPaused = false;

        // Play start sound
        this.playSound('focus-start');

        // Update UI
        this.elements.startBtn.style.display = 'none';
        this.elements.pauseBtn.style.display = 'inline-flex';

        // Show encouraging message
        this.showMotivation(this.getStartMessage());

        // Fetch AI encouragement message
        this.fetchAIMessage();

        // Start the countdown
        this.timerInterval = setInterval(() => this.tick(), 1000);

        // Set ambient background for focus start
        this.updateAmbientBackground();

        // Save state
        this.saveState();

        // Update document title
        this.updateTitle();
    }

    // Fetch "Get Unstuck" suggestion from Gemini API
    async getUnstuck() {
        const taskName = this.elements.taskInput?.value?.trim() || '';

        // Show loading state in AI message bubble
        if (this.elements.aiMessage) {
            this.elements.aiMessage.classList.add('show', 'loading');
            if (this.elements.aiMessageText) {
                this.elements.aiMessageText.textContent = '🤔 Finding a tiny first step...';
            }
        }

        try {
            const response = await fetch('/api/get-unstuck', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ taskName })
            });

            if (!response.ok) {
                throw new Error('API request failed');
            }

            const data = await response.json();

            // Display the suggestion
            if (this.elements.aiMessage && this.elements.aiMessageText) {
                this.elements.aiMessage.classList.remove('loading');
                this.elements.aiMessageText.textContent = `💡 ${data.message}`;

                // Keep visible longer for stuck users
                setTimeout(() => {
                    this.elements.aiMessage.classList.remove('show');
                }, 15000);
            }

        } catch (error) {
            console.error('Failed to fetch unstuck suggestion:', error);

            // Show fallback message
            if (this.elements.aiMessage && this.elements.aiMessageText) {
                this.elements.aiMessage.classList.remove('loading');
                this.elements.aiMessageText.textContent = '💡 Just open it. 📂';

                setTimeout(() => {
                    this.elements.aiMessage.classList.remove('show');
                }, 15000);
            }
        }
    }

    // Fetch AI-generated encouragement message from Gemini API
    async fetchAIMessage() {
        const taskName = this.elements.taskInput?.value?.trim() || '';

        // Show loading state
        if (this.elements.aiMessage) {
            this.elements.aiMessage.classList.add('show', 'loading');
            if (this.elements.aiMessageText) {
                this.elements.aiMessageText.textContent = '🤖 AI is thinking of encouragement...';
            }
        }

        try {
            const response = await fetch('/api/generate-message', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ taskName })
            });

            if (!response.ok) {
                throw new Error('API request failed');
            }

            const data = await response.json();

            // Display the AI message
            if (this.elements.aiMessage && this.elements.aiMessageText) {
                this.elements.aiMessage.classList.remove('loading');
                this.elements.aiMessageText.textContent = `🤖 ${data.message}`;

                // Hide after 10 seconds
                setTimeout(() => {
                    this.elements.aiMessage.classList.remove('show');
                }, 10000);
            }

        } catch (error) {
            console.error('Failed to fetch AI message:', error);

            // Show fallback message
            if (this.elements.aiMessage && this.elements.aiMessageText) {
                this.elements.aiMessage.classList.remove('loading');
                this.elements.aiMessageText.textContent = '🤖 Just try for 1 minute! 🌱';

                setTimeout(() => {
                    this.elements.aiMessage.classList.remove('show');
                }, 10000);
            }
        }
    }

    pause() {
        if (!this.state.isRunning) return;

        this.state.isRunning = false;
        this.state.isPaused = true;

        // Stop interval
        clearInterval(this.timerInterval);

        // Update UI
        this.elements.startBtn.style.display = 'inline-flex';
        this.elements.startBtn.innerHTML = '<span class="btn-icon">▶</span> Resume';
        this.elements.pauseBtn.style.display = 'none';

        // Gentle message
        this.showMotivation('Taking a breather? That\'s okay! Resume when ready. 🌱');

        // Reset ambient background on pause
        this.setAmbientClass(null);

        // Save state
        this.saveState();

        // Update title
        document.title = 'Paused - FocusFlow';
    }

    tick() {
        if (this.state.timeRemaining > 0) {
            this.state.timeRemaining--;
            this.updateDisplay();
            this.updateProgress();
            this.updateTitle();
            this.updateAmbientBackground();

            // Periodic encouragement (every 5 minutes)
            if (this.state.timeRemaining > 0 && this.state.timeRemaining % 300 === 0) {
                this.showMotivation(this.getEncouragementMessage());
            }
        } else {
            this.complete();
        }
    }

    complete() {
        // Stop timer
        clearInterval(this.timerInterval);
        this.state.isRunning = false;

        // Play completion sound
        this.playSound('session-complete');

        // Update stats
        if (this.state.currentMode === 'focus') {
            this.state.completedSessions++;
            Storage.addFocusTime(this.settings.focusDuration);
            Storage.incrementSessions();
        }

        // Show celebration message
        this.showMotivation(this.getCompletionMessage());

        // Send browser notification
        this.sendNotification();

        // Transition to next mode
        setTimeout(() => this.transitionToNextMode(), 2000);

        // Save state
        this.saveState();
    }

    transitionToNextMode() {
        if (this.state.currentMode === 'focus') {
            // Check if time for long break
            if (this.state.completedSessions % this.settings.sessionsBeforeLongBreak === 0) {
                this.setMode('longBreak');
            } else {
                this.setMode('shortBreak');
            }
        } else {
            // After break, go back to focus
            this.state.currentSession++;
            this.setMode('focus');
        }

        // Update UI but don't auto-start (ADHD-friendly: let user control)
        this.elements.startBtn.style.display = 'inline-flex';
        this.elements.startBtn.innerHTML = '<span class="btn-icon">▶</span> Start ' +
            (this.state.currentMode === 'focus' ? 'Focus' : 'Break');
        this.elements.pauseBtn.style.display = 'none';

        // Play transition sound
        this.playSound(this.state.currentMode === 'focus' ? 'focus-start' : 'break-start');
    }

    setMode(mode) {
        this.state.currentMode = mode;

        const durations = {
            focus: this.settings.focusDuration,
            shortBreak: this.settings.shortBreakDuration,
            longBreak: this.settings.longBreakDuration
        };

        this.state.timeRemaining = durations[mode] * 60;
        this.state.totalTime = durations[mode] * 60;

        // Update mode badge
        const modeLabels = {
            focus: 'Focus Time',
            shortBreak: 'Short Break',
            longBreak: 'Long Break'
        };

        this.elements.modeBadge.textContent = modeLabels[mode];
        this.elements.modeBadge.className = `mode-badge ${mode}`;

        // Update session count
        this.elements.sessionCount.textContent =
            `Session ${this.state.currentSession} of ${this.settings.sessionsBeforeLongBreak}`;

        // Update skip button text
        this.elements.skipBtn.textContent =
            mode === 'focus' ? 'Skip to Break →' : 'Skip to Focus →';

        // Update display
        this.updateDisplay();
        this.updateProgress();
    }

    skip() {
        // Gentle confirmation for focus sessions
        if (this.state.currentMode === 'focus' && this.state.isRunning) {
            // Still give partial credit (ADHD-friendly)
            const minutesFocused = Math.floor((this.state.totalTime - this.state.timeRemaining) / 60);
            if (minutesFocused > 0) {
                Storage.addFocusTime(minutesFocused);
                this.showMotivation(`Great job on ${minutesFocused} minutes! Every bit counts. 🌟`);
            }
        }

        // Stop current timer
        clearInterval(this.timerInterval);
        this.state.isRunning = false;

        // Reset ambient background
        this.setAmbientClass(null);

        // Transition
        this.transitionToNextMode();
    }

    adjustTime(minutes) {
        const adjustment = minutes * 60;
        const newTime = this.state.timeRemaining + adjustment;

        // Minimum 1 minute, maximum 60 minutes
        if (newTime >= 60 && newTime <= 3600) {
            this.state.timeRemaining = newTime;
            this.state.totalTime = Math.max(this.state.totalTime, newTime);
            this.updateDisplay();
            this.updateProgress();

            // Positive feedback
            const action = minutes > 0 ? 'Added' : 'Removed';
            this.showMotivation(`${action} ${Math.abs(minutes)} minute${Math.abs(minutes) > 1 ? 's' : ''}. You're in control! ✨`);

            // Haptic feedback on mobile
            if (navigator.vibrate) {
                navigator.vibrate(50);
            }
        }
    }

    updateDisplay() {
        const minutes = Math.floor(this.state.timeRemaining / 60);
        const seconds = this.state.timeRemaining % 60;

        this.elements.minutesDisplay.textContent = String(minutes).padStart(2, '0');
        this.elements.secondsDisplay.textContent = String(seconds).padStart(2, '0');
    }

    updateProgress() {
        const progress = this.state.timeRemaining / this.state.totalTime;
        const offset = this.circumference * progress;

        this.elements.progressCircle.style.strokeDasharray = `${this.circumference}`;
        this.elements.progressCircle.style.strokeDashoffset = `${this.circumference - offset}`;
    }

    setProgressRing() {
        this.elements.progressCircle.style.strokeDasharray = `${this.circumference}`;
        this.elements.progressCircle.style.strokeDashoffset = '0';
    }

    // Calm Technology: Update ambient background based on timer state
    updateAmbientBackground() {
        if (!this.state.isRunning) {
            this.setAmbientClass(null);
            return;
        }

        const progress = 1 - (this.state.timeRemaining / this.state.totalTime);

        if (this.state.currentMode === 'focus') {
            // Focus mode: transition from calm blue to warm orange as time runs out
            if (progress < 0.5) {
                // First half: calm blue
                this.setAmbientClass('ambient-focus-start');
            } else if (progress < 0.8) {
                // Middle: neutral transition
                this.setAmbientClass('ambient-focus-mid');
            } else {
                // Final stretch: warm orange to signal completion approaching
                this.setAmbientClass('ambient-focus-end');
            }
        } else if (this.state.currentMode === 'shortBreak') {
            this.setAmbientClass('ambient-break');
        } else if (this.state.currentMode === 'longBreak') {
            this.setAmbientClass('ambient-long-break');
        }
    }

    setAmbientClass(className) {
        // Remove all ambient classes
        const ambientClasses = [
            'ambient-focus-start',
            'ambient-focus-mid',
            'ambient-focus-end',
            'ambient-break',
            'ambient-long-break'
        ];

        if (this.currentAmbientClass !== className) {
            ambientClasses.forEach(cls => document.body.classList.remove(cls));

            if (className) {
                document.body.classList.add(className);
            }

            this.currentAmbientClass = className;
        }
    }

    updateTitle() {
        const minutes = Math.floor(this.state.timeRemaining / 60);
        const seconds = this.state.timeRemaining % 60;
        const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        const modeStr = this.state.currentMode === 'focus' ? '🎯' : '☕';
        document.title = `${timeStr} ${modeStr} FocusFlow`;
    }

    showMotivation(message) {
        this.elements.motivationMessage.textContent = message;
        this.elements.motivationMessage.classList.add('show');

        setTimeout(() => {
            this.elements.motivationMessage.classList.remove('show');
        }, 4000);
    }

    getStartMessage() {
        const messages = [
            "You've got this! One moment at a time. 💪",
            "Let's do this! Your future self will thank you. 🚀",
            "Starting is the hardest part. You did it! ⭐",
            "Focus mode: activated. You're amazing! 🌟",
            "Here we go! Small steps, big progress. 🎯"
        ];
        return messages[Math.floor(Math.random() * messages.length)];
    }

    getEncouragementMessage() {
        const messages = [
            "You're doing great! Keep it up! 🌈",
            "Still going strong! Proud of you! 💜",
            "Halfway there! You've got momentum! 🔥",
            "Your brain is working hard. Respect! 🧠",
            "Look at you, focusing! Amazing! ✨"
        ];
        return messages[Math.floor(Math.random() * messages.length)];
    }

    getCompletionMessage() {
        const messages = [
            "You did it! Time for a well-deserved break! 🎉",
            "Session complete! Your brain thanks you! 🧠💜",
            "Amazing work! Every session makes you stronger! 💪",
            "Fantastic! You showed up and that's what counts! ⭐",
            "Completed! Progress over perfection, always! 🌟"
        ];
        return messages[Math.floor(Math.random() * messages.length)];
    }

    playSound(soundId) {
        const audio = document.getElementById(`${soundId}-sound`);
        if (audio) {
            audio.volume = 0.5; // Gentle volume
            audio.currentTime = 0;
            audio.play().catch(() => {}); // Ignore autoplay errors
        }
    }

    sendNotification() {
        if (!('Notification' in window)) return;

        if (Notification.permission === 'granted') {
            const title = this.state.currentMode === 'focus'
                ? '🎉 Focus Session Complete!'
                : '☕ Break Time Over!';
            const body = this.state.currentMode === 'focus'
                ? 'Great work! Time for a break.'
                : 'Ready to focus again?';

            new Notification(title, {
                body,
                icon: '/assets/icon-192.png',
                badge: '/assets/icon-192.png',
                silent: true // We play our own sound
            });
        } else if (Notification.permission !== 'denied') {
            Notification.requestPermission();
        }
    }

    saveState() {
        const state = {
            ...this.state,
            task: this.elements.taskInput?.value || ''
        };
        localStorage.setItem('focusflow_timer_state', JSON.stringify(state));
    }

    loadState() {
        const saved = localStorage.getItem('focusflow_timer_state');
        if (saved) {
            const state = JSON.parse(saved);
            // Only restore if not in middle of session
            if (!state.isRunning) {
                this.state.currentSession = state.currentSession || 1;
                this.state.completedSessions = state.completedSessions || 0;
                if (this.elements.taskInput && state.task) {
                    this.elements.taskInput.value = state.task;
                }
            }
        }

        // Update session display
        this.elements.sessionCount.textContent =
            `Session ${this.state.currentSession} of ${this.settings.sessionsBeforeLongBreak}`;
    }

    // Reset everything
    reset() {
        clearInterval(this.timerInterval);
        this.state = {
            isRunning: false,
            isPaused: false,
            currentMode: 'focus',
            timeRemaining: this.settings.focusDuration * 60,
            totalTime: this.settings.focusDuration * 60,
            currentSession: 1,
            completedSessions: 0
        };
        this.updateDisplay();
        this.updateProgress();
        this.setMode('focus');
        this.elements.startBtn.style.display = 'inline-flex';
        this.elements.startBtn.innerHTML = '<span class="btn-icon">▶</span> Start Focus';
        this.elements.pauseBtn.style.display = 'none';
        document.title = 'FocusFlow - ADHD-Friendly Focus Timer';

        // Reset ambient background
        this.setAmbientClass(null);
    }
}

// Export for use in app.js
window.FocusTimer = FocusTimer;
