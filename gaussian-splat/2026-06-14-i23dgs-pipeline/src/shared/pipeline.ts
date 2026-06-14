export type PipelineStage = 'uploaded' | 'matting' | 'matted' | 'generating' | 'ready' | 'failed';

export type ModelFormat = 'splat' | 'ply';

export interface PipelineAsset {
  url: string;
  path: string;
  mimeType: string;
}

export interface PipelineJob {
  id: string;
  stage: PipelineStage;
  createdAt: string;
  updatedAt: string;
  source: PipelineAsset;
  matted?: PipelineAsset;
  model?: PipelineAsset & {
    format: ModelFormat;
    splatCount?: number;
  };
  error?: string;
}

export interface CreateJobResponse {
  job: PipelineJob;
}

export interface PipelineStatusResponse {
  job: PipelineJob;
}

export interface GenerateModelRequest {
  jobId: string;
  provider?: 'mock-local' | 'remote-api';
}

export interface RemoteGaussianProviderConfig {
  endpoint: string;
  apiKey?: string;
  timeoutMs: number;
}
