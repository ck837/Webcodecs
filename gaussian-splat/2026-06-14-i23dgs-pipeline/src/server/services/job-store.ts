import type { PipelineJob, PipelineStage } from '../../shared/pipeline';

export class JobStore {
  private readonly jobs = new Map<string, PipelineJob>();

  put(job: PipelineJob): PipelineJob {
    this.jobs.set(job.id, job);
    return job;
  }

  get(id: string): PipelineJob | undefined {
    return this.jobs.get(id);
  }

  update(id: string, patch: Partial<PipelineJob> & { stage?: PipelineStage }): PipelineJob {
    const current = this.jobs.get(id);
    if (!current) {
      throw new Error(`Job not found: ${id}`);
    }
    const next: PipelineJob = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString()
    };
    this.jobs.set(id, next);
    return next;
  }
}

export const jobStore = new JobStore();
