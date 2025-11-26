"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const routes_1 = __importDefault(require("./routes"));
const config_1 = require("./config");
const app = (0, express_1.default)();
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        if (!origin || config_1.ALLOWED_ORIGINS.length === 0 || config_1.ALLOWED_ORIGINS.includes(origin)) {
            return callback(null, origin);
        }
        return callback(new Error(`Origin ${origin} is not allowed by CORS settings`));
    }
}));
app.use(express_1.default.json({ limit: '1mb' }));
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api', routes_1.default);
// Error handler
app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ message: err.message || '服务器内部错误' });
});
app.listen(config_1.PORT, () => {
    console.log(`VitalFlow backend is running on port ${config_1.PORT}`);
});
