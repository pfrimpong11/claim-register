import { describe, expect, it, vi } from 'vitest';
import { AuditService } from './audit.service.js';

describe('AuditService', () => {
  it('redacts sensitive values before persistence', async () => {
    const create = vi.fn().mockResolvedValue({});
    const service = new AuditService({});
    await service.write(
      { auditLog: { create } },
      {
        action: 'TEST',
        entityType: 'TEST',
        correlationId: 'request-1',
        newValues: { email: 'safe@example.test', password: 'secret', nested: { token: 'x' } },
      },
    );
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        newValues: {
          email: 'safe@example.test',
          password: '[REDACTED]',
          nested: { token: '[REDACTED]' },
        },
      }),
    });
  });
});
