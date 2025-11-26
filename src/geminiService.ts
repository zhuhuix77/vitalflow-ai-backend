import { GoogleGenAI, Type, Schema } from '@google/genai';
import { GEMINI_API_KEY } from './config';
import type { Exercise, BPReading, HealthAnalysis } from './types';

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS || 25000);

const DEFAULT_EXERCISE: Exercise = {
  name: '隐形椅子',
  description: '背靠墙壁下蹲，像坐在一把隐形的椅子上，坚持 45 秒后缓慢站起，重复 3 组。',
  durationSeconds: 90,
  difficulty: 'Medium',
  funFact: '激活腿部最大肌群，迅速提升血液循环。'
};

const FALLBACK_TIP = '每隔 1 小时站起来伸展 2 分钟，血液就会感谢你。';

const createFallbackAnalysis = (): HealthAnalysis => ({
  trend: 'AI 服务暂不可用',
  advice: '稍后再试，或继续保持良好生活方式。',
  generatedAt: Date.now()
});

const withTimeout = <T>(promise: Promise<T>): Promise<T> => {
  return Promise.race<T>([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Gemini 调用超时')), GEMINI_TIMEOUT_MS)
    )
  ]);
};

const toContents = (text: string) => [
  {
    role: 'user',
    parts: [{ text }]
  }
];

const extractText = (result: any): string => {
  if (!result) return '';
  if (typeof result.text === 'function') {
    try {
      return result.text() || '';
    } catch (error) {
      console.warn('Failed to read response.text()', error);
    }
  }
  if (typeof result.text === 'string') {
    return result.text.trim();
  }
  const parts = result.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) {
    const textPart = parts.find((part: any) => part.text);
    return textPart?.text?.trim() || '';
  }
  return '';
};

const extractInlineImage = (result: any): string | undefined => {
  const parts = result.candidates?.[0]?.content?.parts;
  if (!parts) return undefined;
  const inline = parts.find((part: any) => part.inlineData?.data);
  if (inline?.inlineData?.data) {
    const mime = inline.inlineData.mimeType || 'image/png';
    return `data:${mime};base64,${inline.inlineData.data}`;
  }
  return undefined;
};

const sanitizeJsonPayload = (text: string): string => {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
};

const parseJson = <T>(text: string): T => {
  const cleaned = sanitizeJsonPayload(text);
  return JSON.parse(cleaned) as T;
};

export const generateExercise = async (context: string): Promise<Exercise> => {
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING },
      description: { type: Type.STRING },
      durationSeconds: { type: Type.NUMBER },
      difficulty: { type: Type.STRING },
      funFact: { type: Type.STRING }
    },
    required: ['name', 'description', 'durationSeconds', 'difficulty', 'funFact']
  };

  try {
    const response = await withTimeout(
      ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: toContents(
          `为一位${context}生成一个可以在工位完成的趣味微运动。使用简短的中文返回 JSON，包含 name、description、durationSeconds、difficulty、funFact，语气轻松，时长 60-120 秒。`
        )
      })
    );

    const text = extractText(response);
    const exercise = parseJson<Exercise>(text);

    try {
      const illustration = await withTimeout(
        ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: toContents(
            `Draw a minimalist memphis-style flat illustration for: ${exercise.name}: ${exercise.description}. White background, indigo palette,Do not include any Chinese text in the picture.`
          )
        })
      );
      const imageUrl = extractInlineImage(illustration);
      if (imageUrl) {
        exercise.imageUrl = imageUrl;
      }
    } catch (imageError) {
      console.warn('generateExercise illustration failed', imageError);
    }

    return exercise;
  } catch (error) {
    console.warn('generateExercise fallback', error);
    return { ...DEFAULT_EXERCISE };
  }
};

export const generateHealthTip = async (): Promise<string> => {
  try {
    const response = await withTimeout(
      ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: toContents('Give me one short, witty, and motivating tip about lowering blood pressure or reducing sitting time. Keep it under 30 words. Answer in Chinese (Simplified).')
      })
    );
    const text = extractText(response);
    return text.trim() || FALLBACK_TIP;
  } catch (error) {
    console.warn('generateHealthTip fallback', error);
    return FALLBACK_TIP;
  }
};

export const analyzeBloodPressure = async (readings: BPReading[]): Promise<HealthAnalysis> => {
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

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      trend: { type: Type.STRING },
      advice: { type: Type.STRING }
    },
    required: ['trend', 'advice']
  };

  try {
    const response = await withTimeout(
      ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: toContents(
          `你是一名心血管健康教练，分析以下血压读数并给出趋势和一条具体建议，语气积极，使用简体中文：\n${dataString}`
        )
      })
    );

    const text = extractText(response);
    const parsed = parseJson<{ trend: string; advice: string }>(text);
    return { ...parsed, generatedAt: Date.now() };
  } catch (error) {
    console.warn('analyzeBloodPressure fallback', error);
    return createFallbackAnalysis();
  }
};
