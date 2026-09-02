import { describe, expect, it, vi } from 'vitest';
import { JOB_NAMES } from './jobs.js';
import { createJobProcessor } from './processors.js';

describe('worker processor registry', () => {
  it('processes the foundation ping job through the shared processor', async () => {
    const logger = { info: vi.fn() };
    const processJob = createJobProcessor(logger);
    const result = await processJob({ id: 'job-1', name: JOB_NAMES.FOUNDATION_PING });
    expect(result).toMatchObject({ ok: true });
    expect(logger.info).toHaveBeenCalledOnce();
  });

  it('rejects unknown jobs', async () => {
    const processJob = createJobProcessor({ info: vi.fn() });
    await expect(processJob({ id: 'job-2', name: 'unknown' })).rejects.toThrow(
      'Unsupported job type',
    );
  });
});
