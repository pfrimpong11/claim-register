import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ClaimsExportService, csvCell } from './claims-export.service.js';

describe('claims CSV export', () => {
  it('quotes CSV values and neutralizes spreadsheet formulas', () => {
    expect(csvCell('Kojo, Ltd')).toBe('"Kojo, Ltd"');
    expect(csvCell('=HYPERLINK("bad")')).toBe('"\'=HYPERLINK(""bad"")"');
  });

  it('passes stored filters through the canonical claims service and writes its rows', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'claims-export-'));
    const item = {
      id: '11111111-1111-4111-8111-111111111111',
      status: 'PENDING',
      filters: {
        search: 'storm',
        currency: 'GHS',
        page: 1,
        pageSize: 100,
        sort: 'lossDate',
        direction: 'desc',
      },
    };
    const repository = {
      get: vi.fn().mockResolvedValue(item),
      update: vi.fn().mockResolvedValue(item),
    };
    const claimsService = {
      list: vi.fn().mockResolvedValue({
        data: [
          {
            claimNumber: 'CLM-1',
            policyNumberSnapshot: 'POL-1',
            insuredNameSnapshot: '=Unsafe',
            lossDate: new Date('2026-09-01'),
            notificationDate: new Date('2026-09-02'),
            lossNature: 'storm',
            currencyCode: 'GHS',
            estimatedLossAmount: '100',
            approvedAmount: '90',
            paidAmount: '20',
            balanceAmount: '70',
            outstandingAmount: '70',
            overpaidAmount: '0',
            financialStatus: 'SETTLED_PAYMENT_OUTSTANDING',
          },
        ],
        meta: { totalPages: 1 },
      }),
    };
    try {
      const result = await new ClaimsExportService({
        repository,
        claimsService,
        exportsDirectory: directory,
        logger: { info() {} },
      }).process({ exportId: item.id });
      expect(result).toEqual({ ok: true, rowCount: 1 });
      expect(claimsService.list).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'storm', currency: 'GHS', page: 1, pageSize: 100 }),
      );
      expect(await fs.readFile(path.join(directory, `${item.id}.csv`), 'utf8')).toContain(
        "'=Unsafe",
      );
    } finally {
      await fs.rm(directory, { recursive: true, force: true });
    }
  });
});
