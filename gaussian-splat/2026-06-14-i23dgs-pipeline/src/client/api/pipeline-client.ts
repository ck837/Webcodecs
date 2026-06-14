import type {
  CreateJobResponse,
  GenerateModelRequest,
  PipelineJob,
  PipelineStatusResponse
} from '../../shared/pipeline';

export async function uploadProductImage(file: File): Promise<PipelineJob> {
  const form = new FormData();
  form.append('image', file);
  const response = await fetch('/api/jobs', { method: 'POST', body: form });
  if (!response.ok) throw new Error(await readError(response));
  const data = (await response.json()) as CreateJobResponse;
  return data.job;
}

export async function getJob(jobId: string): Promise<PipelineJob> {
  const response = await fetch(`/api/jobs/${jobId}`);
  if (!response.ok) throw new Error(await readError(response));
  const data = (await response.json()) as PipelineStatusResponse;
  return data.job;
}

export async function requestModelGeneration(
  jobId: string,
  provider: GenerateModelRequest['provider'] = 'mock-local'
): Promise<PipelineJob> {
  const response = await fetch(`/api/jobs/${jobId}/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jobId, provider })
  });
  if (!response.ok) throw new Error(await readError(response));
  const data = (await response.json()) as PipelineStatusResponse;
  return data.job;
}

async function readError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string };
    return data.error ?? response.statusText;
  } catch {
    return response.statusText;
  }
}
