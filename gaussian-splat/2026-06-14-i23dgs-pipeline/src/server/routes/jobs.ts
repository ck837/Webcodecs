import fs from 'node:fs/promises';
import path from 'node:path';
import express from 'express';
import multer from 'multer';
import type { CreateJobResponse, GenerateModelRequest, PipelineStatusResponse } from '../../shared/pipeline';
import { config } from '../config';
import { createGaussianProvider } from '../services/gaussian-service';
import { jobStore } from '../services/job-store';
import { runRembgMatting } from '../services/matting-service';
import { createId, toAsset } from '../utils/files';

const upload = multer({
  storage: multer.diskStorage({
    destination: path.join(config.dataDir, 'uploads'),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.png';
      cb(null, `${createId('upload')}${ext}`);
    }
  }),
  limits: { fileSize: 20 * 1024 * 1024 }
});

export const jobsRouter = express.Router();

jobsRouter.post('/jobs', upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'image file is required' });
      return;
    }

    const jobId = createId('job');
    const now = new Date().toISOString();
    const job = jobStore.put({
      id: jobId,
      stage: 'uploaded',
      createdAt: now,
      updatedAt: now,
      source: toAsset(req.file.path, `/api/assets/uploads/${path.basename(req.file.path)}`, req.file.mimetype)
    });

    res.status(202).json({ job } satisfies CreateJobResponse);

    void runMatting(jobId);
  } catch (error) {
    next(error);
  }
});

jobsRouter.get('/jobs/:id', (req, res) => {
  const job = jobStore.get(req.params.id);
  if (!job) {
    res.status(404).json({ error: 'job not found' });
    return;
  }
  res.json({ job } satisfies PipelineStatusResponse);
});

jobsRouter.post('/jobs/:id/generate', async (req, res, next) => {
  try {
    const job = jobStore.get(req.params.id);
    if (!job) {
      res.status(404).json({ error: 'job not found' });
      return;
    }
    const body = req.body as Partial<GenerateModelRequest>;
    const providerKind = body.provider ?? 'mock-local';
    const mattedPath = job.matted?.path;
    if (!mattedPath) {
      res.status(409).json({ error: 'matting output is not ready' });
      return;
    }

    const generating = jobStore.update(job.id, { stage: 'generating' });
    res.status(202).json({ job: generating } satisfies PipelineStatusResponse);

    void runGaussianGeneration(job.id, mattedPath, providerKind);
  } catch (error) {
    next(error);
  }
});

jobsRouter.get('/assets/:bucket/:file', async (req, res, next) => {
  try {
    const bucket = req.params.bucket;
    if (!['uploads', 'matted', 'models'].includes(bucket)) {
      res.status(404).end();
      return;
    }
    const filePath = path.join(config.dataDir, bucket, path.basename(req.params.file));
    await fs.access(filePath);
    res.sendFile(filePath);
  } catch (error) {
    next(error);
  }
});

async function runMatting(jobId: string): Promise<void> {
  const job = jobStore.get(jobId);
  if (!job) return;
  try {
    jobStore.update(jobId, { stage: 'matting' });
    const result = await runRembgMatting(job.source.path, jobId);
    jobStore.update(jobId, {
      stage: 'matted',
      matted: toAsset(result.outputPath, `/api/assets/matted/${path.basename(result.outputPath)}`, 'image/png')
    });
  } catch (error) {
    jobStore.update(jobId, {
      stage: 'failed',
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

async function runGaussianGeneration(
  jobId: string,
  mattedPath: string,
  providerKind: 'mock-local' | 'remote-api'
): Promise<void> {
  try {
    const provider = createGaussianProvider(providerKind);
    const result = await provider.generate(mattedPath, jobId);
    jobStore.update(jobId, {
      stage: 'ready',
      model: {
        ...toAsset(result.outputPath, `/api/assets/models/${path.basename(result.outputPath)}`, 'application/octet-stream'),
        format: result.format,
        splatCount: result.splatCount
      }
    });
  } catch (error) {
    jobStore.update(jobId, {
      stage: 'failed',
      error: error instanceof Error ? error.message : String(error)
    });
  }
}
