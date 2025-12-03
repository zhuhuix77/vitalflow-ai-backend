import dotenv from 'dotenv';

dotenv.config();

const required = (value: string | undefined, name: string): string => {
  if (!value) {
    throw new Error(`Environment variable ${name} is required.`);
  }
  return value;
};

export const PORT = Number(process.env.PORT || 4000);
export const QWEN_API_KEY = required(process.env.QWEN_API_KEY, 'QWEN_API_KEY');
export const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
