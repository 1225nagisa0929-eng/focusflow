/**
 * Get Unstuck API
 * Uses Google Gemini API to suggest a ridiculously simple first step
 * for users who are stuck and can't start their task
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

    // Check for API key
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        console.error('GEMINI_API_KEY not configured');
        // Return fallback message if API key not set
        return res.json({
            message: 'Just open the file. 📂',
            source: 'fallback'
        });
    }

    try {
        // Initialize Gemini AI
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        // Create the prompt
        const taskContext = taskName ? `Their task is: "${taskName}"` : 'They have not specified a task.';

        const prompt = `You are helping someone with ADHD who is completely stuck and cannot start their task.

${taskContext}

Suggest ONE ridiculously simple first action they can take RIGHT NOW. The action should be so easy it feels almost silly - like "open the file", "write just the title", "move your cursor to the document".

Rules:
- Keep it under 20 characters in English
- Be warm and gentle, not pushy
- Include exactly one emoji at the end
- The action must be something they can do in under 10 seconds
- Output ONLY the suggestion, no quotes or explanations

Examples:
- Just open it. 📂
- Write one word. ✏️
- Move your mouse. 🖱️
- Take one breath. 🌬️
- Look at it. 👀`;

        // Generate content
        const result = await model.generateContent(prompt);
        const response = await result.response;
        let message = response.text().trim();

        // Clean up the message (remove quotes if any)
        message = message.replace(/^["「『]|["」』]$/g, '').trim();

        // Ensure message is not too long (20 chars + emoji)
        if (message.length > 25) {
            message = message.substring(0, 22) + '...';
        }

        return res.json({
            message: message,
            source: 'gemini',
            taskName: taskName || null
        });

    } catch (error) {
        console.error('Gemini API error:', error);

        // Return fallback messages
        const fallbackMessages = [
            'Just open it. 📂',
            'Write one word. ✏️',
            'Take a breath. 🌬️',
            'Look at it first. 👀',
            'Move your cursor. 🖱️'
        ];

        const randomMessage = fallbackMessages[Math.floor(Math.random() * fallbackMessages.length)];

        return res.json({
            message: randomMessage,
            source: 'fallback',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}
