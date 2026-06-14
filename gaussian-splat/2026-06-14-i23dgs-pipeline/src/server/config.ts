import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const demoRoot = path.resolve(__dirname, '../..');

export const config = {
  port: Number(process.env.I23DGS_PORT ?? 8787),
  pythonBin: process.env.I23DGS_PYTHON ?? 'python',
  aiEndpoint: process.env.I23DGS_AI_ENDPOINT ?? '',
  aiKey: process.env.I23DGS_AI_KEY,
  dataDir: path.join(demoRoot, 'data'),
  publicDir: path.join(demoRoot, 'public'),
  mockSplatPath: path.join(demoRoot, 'public', 'mock', 'product.splat')
} as const;
