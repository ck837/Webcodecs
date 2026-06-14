import cors from 'cors';
import express from 'express';
import { config } from './config';
import { jobsRouter } from './routes/jobs';
import { ensureDataDirs } from './utils/files';

await ensureDataDirs();

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use('/api', jobsRouter);
app.use('/models', express.static(`${config.dataDir}/models`));
app.use('/matted', express.static(`${config.dataDir}/matted`));

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : String(error);
  res.status(500).json({ error: message });
});

app.listen(config.port, () => {
  console.log(`i23DGS API listening on http://127.0.0.1:${config.port}`);
});
