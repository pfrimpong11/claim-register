import { describe, expect, it, vi } from 'vitest';
import { parseCsvLine } from './csv-import.service.js';

describe('CSV transaction import parsing', () => {
  it('parses quoted commas and escaped quotes without changing values', () => {
    expect(parseCsvLine('REF-1,2026-09-02,,DEBIT,10.50,GHS,"Claim, reference ""one"""')).toEqual([
      'REF-1',
      '2026-09-02',
      '',
      'DEBIT',
      '10.50',
      'GHS',
      'Claim, reference "one"',
    ]);
  });
  it('routes transaction import jobs through the shared processor', async () => {
    const { createJobProcessor } = await import('../../worker/processors.js');
    const { JOB_NAMES } = await import('../../worker/jobs.js');
    const csvImport = { process: vi.fn().mockResolvedValue({ ok: true }) };
    await expect(
      createJobProcessor(
        { info: vi.fn() },
        { csvImport },
      )({
        name: JOB_NAMES.TRANSACTION_IMPORT,
        data: { importId: '11111111-1111-4111-8111-111111111111' },
      }),
    ).resolves.toEqual({ ok: true });
    expect(csvImport.process).toHaveBeenCalledOnce();
  });
});
