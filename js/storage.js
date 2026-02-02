/**
 * FocusFlow Storage Module
 * Handles local data persistence for stats and user preferences
 */

const Storage = {
    KEYS: {
        STATS: 'focusflow_stats',
        SETTINGS: 'focusflow_settings',
        STREAK: 'focusflow_streak',
        PRO_STATUS: 'focusflow_pro'
    },

    // Initialize storage with defaults
    init() {
        if (!this.getStats()) {
            this.setStats({
                totalFocusTime: 0,
                totalSessions: 0,
                todayFocusTime: 0,
                todaySessions: 0,
                lastActiveDate: new Date().toDateString(),
                weeklyData: {},
                allTimeSessions: 0
            });
        }

        // Check if it's a new day
        this.checkNewDay();

        // Update UI with stats
        this.updateStatsDisplay();
    },

    // Get stats object
    getStats() {
        const stats = localStorage.getItem(this.KEYS.STATS);
        return stats ? JSON.parse(stats) : null;
    },

    // Set stats object
    setStats(stats) {
        localStorage.setItem(this.KEYS.STATS, JSON.stringify(stats));
    },

    // Check if it's a new day and reset daily stats
    checkNewDay() {
        const stats = this.getStats();
        const today = new Date().toDateString();

        if (stats.lastActiveDate !== today) {
            // Save yesterday's data to weekly
            const yesterday = stats.lastActiveDate;
            stats.weeklyData[yesterday] = {
                focusTime: stats.todayFocusTime,
                sessions: stats.todaySessions
            };

            // Keep only last 7 days
            const dates = Object.keys(stats.weeklyData).sort();
            while (dates.length > 7) {
                delete stats.weeklyData[dates.shift()];
            }

            // Update streak
            this.updateStreak(stats.todayFocusTime > 0);

            // Reset daily stats
            stats.todayFocusTime = 0;
            stats.todaySessions = 0;
            stats.lastActiveDate = today;

            this.setStats(stats);
        }
    },

    // Add focus time (in minutes)
    addFocusTime(minutes) {
        const stats = this.getStats();
        stats.totalFocusTime += minutes;
        stats.todayFocusTime += minutes;
        this.setStats(stats);
        this.updateStatsDisplay();
    },

    // Increment completed sessions
    incrementSessions() {
        const stats = this.getStats();
        stats.totalSessions++;
        stats.todaySessions++;
        stats.allTimeSessions++;
        this.setStats(stats);
        this.updateStatsDisplay();
    },

    // Streak management
    getStreak() {
        const streak = localStorage.getItem(this.KEYS.STREAK);
        return streak ? JSON.parse(streak) : { current: 0, longest: 0, lastDate: null };
    },

    updateStreak(wasActive) {
        const streak = this.getStreak();
        const today = new Date();
        const lastDate = streak.lastDate ? new Date(streak.lastDate) : null;

        if (wasActive) {
            if (lastDate) {
                const diffDays = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));
                if (diffDays === 1) {
                    // Consecutive day
                    streak.current++;
                } else if (diffDays > 1) {
                    // Streak broken
                    streak.current = 1;
                }
            } else {
                streak.current = 1;
            }

            streak.longest = Math.max(streak.longest, streak.current);
            streak.lastDate = today.toISOString();
        } else {
            // No activity, streak broken
            streak.current = 0;
        }

        localStorage.setItem(this.KEYS.STREAK, JSON.stringify(streak));
    },

    // Check streak on app load
    checkStreak() {
        const streak = this.getStreak();
        if (streak.lastDate) {
            const lastDate = new Date(streak.lastDate);
            const today = new Date();
            const diffDays = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));

            // If more than 1 day has passed, streak is broken
            if (diffDays > 1) {
                streak.current = 0;
                localStorage.setItem(this.KEYS.STREAK, JSON.stringify(streak));
            }
        }
        return streak;
    },

    // Update stats display in UI
    updateStatsDisplay() {
        const stats = this.getStats();
        const streak = this.checkStreak();

        // Update DOM elements if they exist
        const totalFocusEl = document.getElementById('total-focus-time');
        const completedSessionsEl = document.getElementById('completed-sessions');
        const currentStreakEl = document.getElementById('current-streak');

        if (totalFocusEl) {
            totalFocusEl.textContent = stats.todayFocusTime;
        }
        if (completedSessionsEl) {
            completedSessionsEl.textContent = stats.todaySessions;
        }
        if (currentStreakEl) {
            currentStreakEl.textContent = streak.current;
        }
    },

    // Get weekly report data (Pro feature)
    getWeeklyReport() {
        const stats = this.getStats();
        const today = new Date();
        const weekData = [];

        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = date.toDateString();

            if (dateStr === today.toDateString()) {
                weekData.push({
                    date: dateStr,
                    focusTime: stats.todayFocusTime,
                    sessions: stats.todaySessions
                });
            } else {
                const dayData = stats.weeklyData[dateStr] || { focusTime: 0, sessions: 0 };
                weekData.push({
                    date: dateStr,
                    ...dayData
                });
            }
        }

        return weekData;
    },

    // Settings management
    getSettings() {
        const settings = localStorage.getItem(this.KEYS.SETTINGS);
        return settings ? JSON.parse(settings) : {
            focusDuration: 25,
            shortBreakDuration: 5,
            longBreakDuration: 15,
            sessionsBeforeLongBreak: 4,
            soundEnabled: true,
            notificationsEnabled: true,
            darkMode: false
        };
    },

    saveSettings(settings) {
        localStorage.setItem(this.KEYS.SETTINGS, JSON.stringify(settings));
    },

    // Pro status management
    getProStatus() {
        const pro = localStorage.getItem(this.KEYS.PRO_STATUS);
        return pro ? JSON.parse(pro) : { isPro: false, expiresAt: null, plan: null };
    },

    setProStatus(status) {
        localStorage.setItem(this.KEYS.PRO_STATUS, JSON.stringify(status));
    },

    isPro() {
        const status = this.getProStatus();
        if (!status.isPro) return false;
        if (status.expiresAt && new Date(status.expiresAt) < new Date()) {
            // Subscription expired
            this.setProStatus({ isPro: false, expiresAt: null, plan: null });
            return false;
        }
        return true;
    },

    // Export all data (for backup)
    exportData() {
        return {
            stats: this.getStats(),
            streak: this.getStreak(),
            settings: this.getSettings(),
            exportedAt: new Date().toISOString()
        };
    },

    // Import data (from backup)
    importData(data) {
        if (data.stats) this.setStats(data.stats);
        if (data.streak) localStorage.setItem(this.KEYS.STREAK, JSON.stringify(data.streak));
        if (data.settings) this.saveSettings(data.settings);
        this.updateStatsDisplay();
    },

    // Clear all data
    clearAll() {
        localStorage.removeItem(this.KEYS.STATS);
        localStorage.removeItem(this.KEYS.STREAK);
        localStorage.removeItem(this.KEYS.SETTINGS);
        localStorage.removeItem(this.KEYS.PRO_STATUS);
        this.init();
    }
};

// Export
window.Storage = Storage;
