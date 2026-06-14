import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import type { PipelineAsset } from '../../shared/pipeline';
import { config } from '../config';

export function createId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
}

export async function ensureDataDirs(): Promise<void> {
  await Promise.all([
    fs.mkdir(path.join(config.dataDir, 'uploads'), { recursive: true }),
    fs.mkdir(path.join(config.dataDir, 'matted'), { recursive: true }),
    fs.mkdir(path.join(config.dataDir, 'models'), { recursive: true }),
    fs.mkdir(path.join(config.publicDir, 'mock'), { recursive: true })
  ]);
}

export function toAsset(filePath: string, publicPath: string, mimeType: string): PipelineAsset {
  return {
    path: filePath,
    url: publicPath,
    mimeType
  };
}
