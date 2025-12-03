import type { Exercise, BPReading, HealthAnalysis } from './types';
import { QWEN_API_KEY } from './config';

const DASH_SCOPE_CHAT_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
const DASH_SCOPE_IMAGE_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';
const QWEN_TEXT_MODEL = process.env.QWEN_TEXT_MODEL || process.env.QWEN_MODEL || 'qwen3-max';
const QWEN_IMAGE_MODEL = process.env.QWEN_IMAGE_MODEL || QWEN_TEXT_MODEL;
const QWEN_IMAGE_SIZE = process.env.QWEN_IMAGE_SIZE || '1664*928';
const QWEN_TIMEOUT_MS = Number(process.env.QWEN_TIMEOUT_MS || 30000);

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
      setTimeout(() => reject(new Error('Qwen 调用超时')), QWEN_TIMEOUT_MS)
    )
  ]);
};

type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type DashScopeTextPart = {
  type?: string;
  text?: string;
};

type DashScopeChoice = {
  message?: {
    content?: string | DashScopeTextPart[];
  };
};

type DashScopeResponse = {
  choices?: DashScopeChoice[];
};

type DashScopeImageDatum = {
  url?: string;
  b64_json?: string;
  mime_type?: string;
};

type DashScopeImageResponse = {
  data?: DashScopeImageDatum[];
  output?: {
    results?: DashScopeImageDatum[];
  };
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

const extractMessageText = (payload: DashScopeResponse): string => {
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content === 'string') {
    return content.trim();
  }
  if (Array.isArray(content)) {
    const textChunk = content.find((chunk) => chunk.type === 'text');
    return textChunk?.text?.trim() || '';
  }
  return '';
};

const extractImageUrl = (payload: DashScopeImageResponse): string | undefined => {
  //console.log(payload.output.choices);
  const candidate = payload.output.choices?.[0] ;
  if (!candidate) {
    return undefined;
  }

  if (candidate.message) {
    const img= candidate.message.content?.[0];
    //console.log(img)
    if (img && img.image) {

      return img.image;

    }
  }
 
  return undefined;
};

const callQwenChat = async (
  messages: ChatMessage[],
  options: { responseFormat?: 'json_object'; temperature?: number } = {}
): Promise<string> => {
  const body: Record<string, unknown> = {
    model: QWEN_TEXT_MODEL,
    messages
  };

  if (typeof options.temperature === 'number') {
    body.temperature = options.temperature;
  }

  if (options.responseFormat) {
    body.response_format = { type: options.responseFormat };
  }

  const response = await withTimeout(
    fetch(DASH_SCOPE_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${QWEN_API_KEY}`
      },
      body: JSON.stringify(body)
    })
  );

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Qwen 请求失败：${response.status} ${errorText}`);
  }

  const data = (await response.json()) as DashScopeResponse;
  const text = extractMessageText(data);
  if (!text) {
    throw new Error('Qwen 返回内容为空');
  }
  return text;
};

const callQwenImage = async (prompt: string): Promise<string | undefined> => {
  const body = {
    model: QWEN_IMAGE_MODEL,
    input: {
      messages: [
            {
                role: 'user',
                content: [
                    {
                        text: prompt
                    }
                ]
            }
        ]
    },
    parameters: {
      size: QWEN_IMAGE_SIZE,
      n: 1
    }
  };

  const response = await withTimeout(
    fetch(DASH_SCOPE_IMAGE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${QWEN_API_KEY}`
      },
      body: JSON.stringify(body)
    })
  );

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Qwen 图像请求失败：${response.status} ${errorText}`);
  }

  const data = (await response.json()) as DashScopeImageResponse;
  return extractImageUrl(data);
};

export const generateExercise = async (context: string): Promise<Exercise> => {
  try {
    const text = await callQwenChat(
      [
        {
          role: 'system',
          content:
            '你是一名擅长设计工位微运动的健身教练，只能用简体中文输出 JSON 对象。'
        },
        {
          role: 'user',
          content: `为一位${context}生成一个可以在工位完成的趣味微运动。字段需包含 name、description、durationSeconds、difficulty、funFact，且时长控制在 60-120 秒。`
        }
      ],
      { responseFormat: 'json_object', temperature: 0.7 }
    );

    const exercise = parseJson<Exercise>(text);

    try {
      const illustrationPrompt = `Draw a clean flat illustration that shows "${exercise.name}" (${exercise.description}). Style: memphis, white background, indigo accent, no Chinese text.`;
      const imageUrl = await callQwenImage(illustrationPrompt);
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
    const tip = await callQwenChat(
      [
        {
          role: 'system',
          content: '你是一名活泼幽默的健康教练，回答要简短、鼓励性、用简体中文。'
        },
        {
          role: 'user',
          content:
            '请给出一句 30 字以内、关于降低血压或减少久坐的小贴士，语气轻松。'
        }
      ],
      { temperature: 0.8 }
    );
    return tip.trim() || FALLBACK_TIP;
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

  try {
    const text = await callQwenChat(
      [
        {
          role: 'system',
          content:
            '你是一名心血管健康教练，只能返回 JSON，对血压趋势给出积极的分析和建议。'
        },
        {
          role: 'user',
          content: `请根据下面的血压记录，输出 trend 和 advice 两个字段：\n${dataString}`
        }
      ],
      { responseFormat: 'json_object', temperature: 0.4 }
    );

    const parsed = parseJson<{ trend: string; advice: string }>(text);
    return { ...parsed, generatedAt: Date.now() };
  } catch (error) {
    console.warn('analyzeBloodPressure fallback', error);
    return createFallbackAnalysis();
  }
};
