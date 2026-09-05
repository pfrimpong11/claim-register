import { describe, expect, it, vi } from 'vitest';
import { AuditRepository } from './audit.repository.js';

describe('AuditRepository', () => {
  it('filters a claim timeline by its explicit claim association', async () => {
    const findMany = vi.fn().mockReturnValue('find-many-query');
    const count = vi.fn().mockReturnValue('count-query');
    const prisma = {
      auditLog: { findMany, count },
      $transaction: vi.fn().mockResolvedValue([[], 0]),
    };
    const repository = new AuditRepository(prisma);
    const claimId = '11111111-1111-4111-8111-111111111111';

    await repository.list({ claimId, page: 1, pageSize: 50 });

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { claimId } }));
    expect(count).toHaveBeenCalledWith({ where: { claimId } });
  });
});
