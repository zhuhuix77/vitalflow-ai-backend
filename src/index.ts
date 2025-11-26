import express from 'express';
import cors from 'cors';
import router from './routes';
import { ALLOWED_ORIGINS, PORT } from './config';

const app = express();

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin)) {
        return callback(null, origin);
      }
      return callback(new Error(`Origin ${origin} is not allowed by CORS settings`));
    }
  })
);

app.use(express.json({ limit: '1mb' }));
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api', router);

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ message: err.message || '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`VitalFlow backend is running on port ${PORT}`);
});
