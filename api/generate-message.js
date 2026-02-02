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
            message: '一歩ずつ、大丈夫！',
            source: 'default'
        });
    }

    // Check for API key
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        console.error('GEMINI_API_KEY not configured');
        // Return fallback message if API key not set
        return res.json({
            message: '今日も頑張ろう！✨',
            source: 'fallback'
        });
    }

    try {
        // Initialize Gemini AI
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        // Create the prompt
        const prompt = `あなたは、ADHDの傾向がある人を優しくサポートする励ましのエキスパートです。

ユーザーはこれから「${taskName}」というタスクを始めようとしています。

以下の条件で、励ましメッセージを1つだけ生成してください：
- 日本語で書く
- 20文字以内（絵文字含む）
- ハードルを下げる表現を使う（「まずは」「ちょっとだけ」など）
- 優しく、プレッシャーを与えない
- 絵文字を1つ含める
- 「」や説明文は含めず、メッセージ本文のみを出力

例：
- まず1分だけ！🌱
- 深呼吸、そしてスタート✨
- できるとこだけでOK💪`;

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
            'まず1分だけ試そう🌱',
            '小さく始めよう✨',
            'できる範囲でOK💪',
            '一歩ずつ、大丈夫🌈',
            '今日のあなたならできる⭐'
        ];

        const randomMessage = fallbackMessages[Math.floor(Math.random() * fallbackMessages.length)];

        return res.json({
            message: randomMessage,
            source: 'fallback',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}
