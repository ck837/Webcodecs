import { spawn } from 'node:child_process';
import path from 'node:path';
import { config, demoRoot } from '../config';

export interface MattingResult {
  outputPath: string;
}

export function runRembgMatting(inputPath: string, jobId: string): Promise<MattingResult> {
  const outputPath = path.join(config.dataDir, 'matted', `${jobId}.png`);
  const scriptPath = path.join(demoRoot, 'scripts', 'rembg_matting.py');

  return new Promise((resolve, reject) => {
    const child = spawn(config.pythonBin, [scriptPath, inputPath, outputPath], {
      cwd: demoRoot,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    const chunks: string[] = [];
    child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk.toString('utf8')));
    child.stderr.on('data', (chunk: Buffer) => chunks.push(chunk.toString('utf8')));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ outputPath });
        return;
      }
      reject(new Error(`rembg failed with code ${code}: ${chunks.join('').trim()}`));
    });
  });
}
