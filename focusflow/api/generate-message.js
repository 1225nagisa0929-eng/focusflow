/**
 * AI Encouragement Message Generator
 * Uses Google Gemini API to generate ADHD-friendly motivational messages
 *
 * Environment Variables Required:
 * - GEMINI_API_KEY: Your Google Gemini API key
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

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

    const { taskName } = req.body;

    if (!taskName || taskName.trim() === '') {
        // Return a default message if no task name provided
        return res.json({
            message: 'One step at a time! 🌱',
            source: 'default'
        });
    }

    // Check for API key
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        console.error('GEMINI_API_KEY not configured');
        // Return fallback message if API key not set
        return res.json({
            message: 'You got this! ✨',
            source: 'fallback'
        });
    }

    try {
        // Initialize Gemini AI
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        // Create the prompt
        const prompt = `You are an expert at gently supporting people with ADHD tendencies.

The user is about to start a task called "${taskName}".

Generate ONE short encouragement message following these rules:
- Respond in English, keep it under 20 words.
- Use phrases that lower the barrier (e.g., "just for a minute", "start small")
- Be gentle and avoid pressure
- Include exactly one emoji
- Output ONLY the message itself, no quotes or explanations

Examples:
- Just 1 minute to start! 🌱
- Deep breath, then begin ✨
- Do what you can, that's enough 💪
- Small steps count! 🚀
- You've already started by being here 🌟`;

        // Generate content
        const result = await model.generateContent(prompt);
        const response = await result.response;
        let message = response.text().trim();

        // Clean up the message (remove quotes if any)
        message = message.replace(/^["「『]|["」』]$/g, '').trim();

        // Ensure message is not too long
        if (message.length > 30) {
            message = message.substring(0, 30);
        }

        return res.json({
            message: message,
            source: 'gemini',
            taskName: taskName
        });

    } catch (error) {
        console.error('Gemini API error:', error);

        // Return fallback messages based on common tasks
        const fallbackMessages = [
            'Just try for 1 minute! 🌱',
            'Start small, win big ✨',
            'Do what you can, that\'s enough 💪',
            'One step at a time 🌈',
            'You\'ve got this today! ⭐'
        ];

        const randomMessage = fallbackMessages[Math.floor(Math.random() * fallbackMessages.length)];

        return res.json({
            message: randomMessage,
            source: 'fallback',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}
