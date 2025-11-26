"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeBloodPressure = exports.generateHealthTip = exports.generateExercise = void 0;
const genai_1 = require("@google/genai");
const config_1 = require("./config");
const ai = new genai_1.GoogleGenAI({ apiKey: config_1.GEMINI_API_KEY });
const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS || 25000);
const DEFAULT_EXERCISE = {
    name: '隐形椅子',
    description: '背靠墙壁下蹲，像坐在一把隐形的椅子上，坚持 45 秒后缓慢站起，重复 3 组。',
    durationSeconds: 90,
    difficulty: 'Medium',
    funFact: '激活腿部最大肌群，迅速提升血液循环。'
};
const FALLBACK_TIP = '每隔 1 小时站起来伸展 2 分钟，血液就会感谢你。';
const createFallbackAnalysis = () => ({
    trend: 'AI 服务暂不可用',
    advice: '稍后再试，或继续保持良好生活方式。',
    generatedAt: Date.now()
});
const withTimeout = (promise) => {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Gemini 调用超时')), GEMINI_TIMEOUT_MS))
    ]);
};
const toContents = (text) => [
    {
        role: 'user',
        parts: [{ text }]
    }
];
const extractText = (result) => {
    if (!result)
        return '';
    if (typeof result.text === 'function') {
        try {
            return result.text() || '';
        }
        catch (error) {
            console.warn('Failed to read response.text()', error);
        }
    }
    if (typeof result.text === 'string') {
        return result.text.trim();
    }
    const parts = result.candidates?.[0]?.content?.parts;
    if (Array.isArray(parts)) {
        const textPart = parts.find((part) => part.text);
        return textPart?.text?.trim() || '';
    }
    return '';
};
const extractInlineImage = (result) => {
    const parts = result.candidates?.[0]?.content?.parts;
    if (!parts)
        return undefined;
    const inline = parts.find((part) => part.inlineData?.data);
    if (inline?.inlineData?.data) {
        const mime = inline.inlineData.mimeType || 'image/png';
        return `data:${mime};base64,${inline.inlineData.data}`;
    }
    return undefined;
};
const sanitizeJsonPayload = (text) => {
    return text
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
};
const parseJson = (text) => {
    const cleaned = sanitizeJsonPayload(text);
    return JSON.parse(cleaned);
};
const generateExercise = async (context) => {
    const schema = {
        type: genai_1.Type.OBJECT,
        properties: {
            name: { type: genai_1.Type.STRING },
            description: { type: genai_1.Type.STRING },
            durationSeconds: { type: genai_1.Type.NUMBER },
            difficulty: { type: genai_1.Type.STRING },
            funFact: { type: genai_1.Type.STRING }
        },
        required: ['name', 'description', 'durationSeconds', 'difficulty', 'funFact']
    };
    try {
        const response = await withTimeout(ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: toContents(`为一位${context}生成一个可以在工位完成的趣味微运动。使用简短的中文返回 JSON，包含 name、description、durationSeconds、difficulty、funFact，语气轻松，时长 60-120 秒。`),
            responseMimeType: 'application/json',
            responseSchema: schema,
            generationConfig: {
                temperature: 1.05
            }
        }));
        const text = extractText(response);
        const exercise = parseJson(text);
        try {
            const illustration = await withTimeout(ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: toContents(`Draw a minimalist memphis-style flat illustration for: ${exercise.name}: ${exercise.description}. White background, indigo palette,Do not include any Chinese text in the picture.`),
                generationConfig: {
                    imageGenerationConfig: {
                        aspectRatio: '4:3'
                    }
                }
            }));
            const imageUrl = extractInlineImage(illustration);
            if (imageUrl) {
                exercise.imageUrl = imageUrl;
            }
        }
        catch (imageError) {
            console.warn('generateExercise illustration failed', imageError);
        }
        return exercise;
    }
    catch (error) {
        console.warn('generateExercise fallback', error);
        return { ...DEFAULT_EXERCISE };
    }
};
exports.generateExercise = generateExercise;
const generateHealthTip = async () => {
    try {
        const response = await withTimeout(ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: toContents('Give me one short, witty, and motivating tip about lowering blood pressure or reducing sitting time. Keep it under 30 words. Answer in Chinese (Simplified).'),
            generationConfig: {
                temperature: 0.9
            }
        }));
        const text = extractText(response);
        return text.trim() || FALLBACK_TIP;
    }
    catch (error) {
        console.warn('generateHealthTip fallback', error);
        return FALLBACK_TIP;
    }
};
exports.generateHealthTip = generateHealthTip;
const analyzeBloodPressure = async (readings) => {
    if (!readings.length) {
        return {
            trend: '暂无数据',
            advice: '请先记录几条血压数据再试。',
            generatedAt: Date.now()
        };
    }
    const dataString = readings
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(-10)
        .map((reading) => `${new Date(reading.timestamp).toLocaleDateString()}: ${reading.systolic}/${reading.diastolic}`)
        .join('\n');
    const schema = {
        type: genai_1.Type.OBJECT,
        properties: {
            trend: { type: genai_1.Type.STRING },
            advice: { type: genai_1.Type.STRING }
        },
        required: ['trend', 'advice']
    };
    try {
        const response = await withTimeout(ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: toContents(`你是一名心血管健康教练，分析以下血压读数并给出趋势和一条具体建议，语气积极，使用简体中文：\n${dataString}`),
            responseMimeType: 'application/json',
            responseSchema: schema
        }));
        const text = extractText(response);
        const parsed = parseJson(text);
        return { ...parsed, generatedAt: Date.now() };
    }
    catch (error) {
        console.warn('analyzeBloodPressure fallback', error);
        return createFallbackAnalysis();
    }
};
exports.analyzeBloodPressure = analyzeBloodPressure;
