"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const geminiService_1 = require("./geminiService");
const router = (0, express_1.Router)();
router.post('/exercise', async (req, res, next) => {
    try {
        const { context = 'office worker' } = req.body || {};
        const exercise = await (0, geminiService_1.generateExercise)(context);
        res.json(exercise);
    }
    catch (error) {
        next(error);
    }
});
router.get('/health-tip', async (_req, res, next) => {
    try {
        const tip = await (0, geminiService_1.generateHealthTip)();
        res.json({ tip });
    }
    catch (error) {
        next(error);
    }
});
router.post('/bp-analysis', async (req, res, next) => {
    try {
        const readings = (req.body?.readings || []);
        if (!Array.isArray(readings) || readings.length === 0) {
            return res.status(400).json({ message: 'readings 字段必须是非空数组' });
        }
        const analysis = await (0, geminiService_1.analyzeBloodPressure)(readings);
        res.json(analysis);
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
