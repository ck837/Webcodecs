import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { ModelFormat, RemoteGaussianProviderConfig } from '../../shared/pipeline';
import { config, demoRoot } from '../config';

export interface GaussianGenerationResult {
  outputPath: string;
  format: ModelFormat;
  splatCount?: number;
}

export interface GaussianProvider {
  generate(inputPngPath: string, jobId: string): Promise<GaussianGenerationResult>;
}

export class LocalImageGaussianProvider implements GaussianProvider {
  async generate(inputPngPath: string, jobId: string): Promise<GaussianGenerationResult> {
    const outputPath = path.join(config.dataDir, 'models', `${jobId}.splat`);
    const scriptPath = path.join(demoRoot, 'scripts', 'image_to_splat.py');

    await new Promise<void>((resolve, reject) => {
      const child = spawn(config.pythonBin, [scriptPath, inputPngPath, outputPath], {
        cwd: demoRoot,
        stdio: ['ignore', 'pipe', 'pipe']
      });
      const chunks: string[] = [];
      child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk.toString('utf8')));
      child.stderr.on('data', (chunk: Buffer) => chunks.push(chunk.toString('utf8')));
      child.on('error', reject);
      child.on('close', (code) => {
        if (code === 0) {
          resolve();
          return;
        }
        reject(new Error(`image_to_splat failed with code ${code}: ${chunks.join('').trim()}`));
      });
    });

    const stat = await fs.stat(outputPath);
    return {
      outputPath,
      format: 'splat',
      splatCount: Math.floor(stat.size / 32)
    };
  }
}

export class RemoteApiGaussianProvider implements GaussianProvider {
  constructor(private readonly providerConfig: RemoteGaussianProviderConfig) {}

  async generate(inputPngPath: string, jobId: string): Promise<GaussianGenerationResult> {
    const image = await fs.readFile(inputPngPath);
    const response = await fetch(this.providerConfig.endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'image/png',
        ...(this.providerConfig.apiKey ? { authorization: `Bearer ${this.providerConfig.apiKey}` } : {})
      },
      body: image,
      signal: AbortSignal.timeout(this.providerConfig.timeoutMs)
    });

    if (!response.ok) {
      throw new Error(`3DGS provider failed: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') ?? '';
    const format: ModelFormat = contentType.includes('ply') ? 'ply' : 'splat';
    const outputPath = path.join(config.dataDir, 'models', `${jobId}.${format}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    await fs.writeFile(outputPath, bytes);

    return {
      outputPath,
      format,
      splatCount: format === 'splat' ? Math.floor(bytes.byteLength / 32) : undefined
    };
  }
}

export function createGaussianProvider(kind: 'mock-local' | 'remote-api' = 'mock-local'): GaussianProvider {
  if (kind === 'remote-api') {
    if (!config.aiEndpoint) {
      throw new Error('I23DGS_AI_ENDPOINT is required for remote-api provider');
    }
    return new RemoteApiGaussianProvider({
      endpoint: config.aiEndpoint,
      apiKey: config.aiKey,
      timeoutMs: 15 * 60 * 1000
    });
  }
  return new LocalImageGaussianProvider();
}
