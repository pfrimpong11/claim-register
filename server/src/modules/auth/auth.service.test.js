import argon2 from 'argon2';
import { describe, expect, it, vi } from 'vitest';
import { UserStatus } from '@prisma/client';
import { AuthService, sha256 } from './auth.service.js';

function activeUser(passwordHash) {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    email: 'user@example.test',
    passwordHash,
    firstName: 'Test',
    lastName: 'User',
    status: UserStatus.ACTIVE,
    roles: [
      {
        role: {
          code: 'TEST_ROLE',
          permissions: [{ permission: { code: 'claims.view' } }],
        },
      },
    ],
  };
}

describe('AuthService', () => {
  it('creates a hashed opaque session and transactional audit on valid credentials', async () => {
    const passwordHash = await argon2.hash('correct-password');
    const user = activeUser(passwordHash);
    const transaction = {
      session: { create: vi.fn().mockResolvedValue({}) },
      user: { update: vi.fn().mockResolvedValue({}) },
    };
    const repository = {
      prisma: {},
      findUserByEmail: vi.fn().mockResolvedValue(user),
      transaction: vi.fn(async (operation) => operation(transaction)),
    };
    const auditService = { write: vi.fn().mockResolvedValue({}) };
    const service = new AuthService({ repository, auditService, sessionTtlHours: 12 });

    const result = await service.login({
      email: user.email,
      password: 'correct-password',
      correlationId: 'request-1',
      ipAddress: '127.0.0.1',
      userAgent: 'test',
    });

    const sessionData = transaction.session.create.mock.calls[0][0].data;
    expect(sessionData.tokenHash).toBe(sha256(result.sessionToken));
    expect(sessionData.csrfTokenHash).toBe(sha256(result.csrfToken));
    expect(sessionData).not.toHaveProperty('sessionToken');
    expect(result.user.permissions).toEqual(['claims.view']);
    expect(auditService.write).toHaveBeenCalledWith(
      transaction,
      expect.objectContaining({ action: 'AUTH_LOGIN_SUCCEEDED' }),
    );
  });

  it('returns one public error for unknown and invalid credentials', async () => {
    const auditService = { write: vi.fn().mockResolvedValue({}) };
    const repository = {
      prisma: {},
      findUserByEmail: vi.fn().mockResolvedValue(null),
    };
    const service = new AuthService({ repository, auditService, sessionTtlHours: 12 });
    await expect(
      service.login({
        email: 'unknown@example.test',
        password: 'incorrect-password',
        correlationId: 'request-2',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS', status: 401 });
    expect(auditService.write).toHaveBeenCalledWith(
      repository.prisma,
      expect.objectContaining({ action: 'AUTH_LOGIN_FAILED' }),
    );
  });

  it('rejects disabled users without creating a session', async () => {
    const passwordHash = await argon2.hash('correct-password');
    const user = { ...activeUser(passwordHash), status: UserStatus.DISABLED };
    const repository = {
      prisma: {},
      findUserByEmail: vi.fn().mockResolvedValue(user),
      transaction: vi.fn(),
    };
    const auditService = { write: vi.fn().mockResolvedValue({}) };
    const service = new AuthService({ repository, auditService, sessionTtlHours: 12 });

    await expect(
      service.login({
        email: user.email,
        password: 'correct-password',
        correlationId: 'request-disabled',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS', status: 401 });
    expect(repository.transaction).not.toHaveBeenCalled();
    expect(auditService.write).toHaveBeenCalledWith(
      repository.prisma,
      expect.objectContaining({
        action: 'AUTH_LOGIN_FAILED',
        newValues: expect.objectContaining({ reason: 'ACCOUNT_DISABLED' }),
      }),
    );
  });
});
