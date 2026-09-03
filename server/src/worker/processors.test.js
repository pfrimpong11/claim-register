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

  it('routes validated document cleanup work to the shared service', async () => {
    const documentCleanup = { process: vi.fn().mockResolvedValue({ ok: true }) };
    const processJob = createJobProcessor({ info: vi.fn() }, { documentCleanup });
    await expect(
      processJob({
        id: 'job-3',
        name: JOB_NAMES.DOCUMENT_CLEANUP,
        data: { documentId: '11111111-1111-4111-8111-111111111111' },
      }),
    ).resolves.toEqual({ ok: true });
    expect(documentCleanup.process).toHaveBeenCalledOnce();
  });

  it('routes claims exports through the shared worker', async () => {
    const claimsExport = { process: vi.fn().mockResolvedValue({ ok: true }) };
    const processJob = createJobProcessor({ info: vi.fn() }, { claimsExport });
    await expect(
      processJob({
        id: 'job-4',
        name: JOB_NAMES.CLAIMS_EXPORT,
        data: { exportId: '11111111-1111-4111-8111-111111111111' },
      }),
    ).resolves.toEqual({ ok: true });
    expect(claimsExport.process).toHaveBeenCalledOnce();
  });
});
