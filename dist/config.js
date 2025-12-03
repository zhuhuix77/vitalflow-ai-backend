"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALLOWED_ORIGINS = exports.QWEN_API_KEY = exports.PORT = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const required = (value, name) => {
    if (!value) {
        throw new Error(`Environment variable ${name} is required.`);
    }
    return value;
};
exports.PORT = Number(process.env.PORT || 4000);
exports.QWEN_API_KEY = required(process.env.QWEN_API_KEY, 'QWEN_API_KEY');
exports.ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
