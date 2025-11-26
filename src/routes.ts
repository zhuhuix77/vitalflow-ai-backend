import { Router } from 'express';
import { analyzeBloodPressure, generateExercise, generateHealthTip } from './geminiService';
import type { BPReading } from './types';

const router = Router();

router.post('/exercise', async (req, res, next) => {
  try {
    const { context = 'office worker' } = req.body || {};
    const exercise = await generateExercise(context);
    res.json(exercise);
  } catch (error) {
    next(error);
  }
});

router.get('/health-tip', async (_req, res, next) => {
  try {
    const tip = await generateHealthTip();
    res.json({ tip });
  } catch (error) {
    next(error);
  }
});

router.post('/bp-analysis', async (req, res, next) => {
  try {
    const readings = (req.body?.readings || []) as BPReading[];
    if (!Array.isArray(readings) || readings.length === 0) {
      return res.status(400).json({ message: 'readings 字段必须是非空数组' });
    }
    const analysis = await analyzeBloodPressure(readings);
    res.json(analysis);
  } catch (error) {
    next(error);
  }
});

export default router;
