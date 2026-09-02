import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import argon2 from 'argon2';
import { UserStatus } from '@prisma/client';
import { AppError } from '../../shared/errors.js';
import { toPrincipal } from './auth.repository.js';

const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=65536,p=4,t=3$udn1/GKaxQELZNoRwJ6lvw$jhO1GkiJfCTN2f5M52Csr7R297viE2E1u09cgDYN3WA';

export class AuthService {
  /**
   * @param {object} dependencies
   * @param {import('./auth.repository.js').AuthRepository} dependencies.repository
   * @param {import('../audit/audit.service.js').AuditService} dependencies.auditService
   * @param {number} dependencies.sessionTtlHours
   */
  constructor({ repository, auditService, sessionTtlHours }) {
    this.repository = repository;
    this.auditService = auditService;
    this.sessionTtlHours = sessionTtlHours;
  }

  /**
   * @param {object} input
   * @param {string} input.email
   * @param {string} input.password
   * @param {string} input.correlationId
   * @param {string | undefined} [input.ipAddress]
   * @param {string | undefined} [input.userAgent]
   */
  async login({ email, password, correlationId, ipAddress, userAgent }) {
    const user = await this.repository.findUserByEmail(email);
    const passwordValid = await argon2.verify(user?.passwordHash ?? DUMMY_PASSWORD_HASH, password);
    if (!user || !passwordValid || user.status !== UserStatus.ACTIVE) {
      await this.auditService.write(this.repository.prisma, {
        action: 'AUTH_LOGIN_FAILED',
        entityType: 'AUTHENTICATION',
        correlationId,
        ipAddress,
        userAgent,
        newValues: {
          outcome: 'DENIED',
          identifierHash: sha256(email),
          reason: user?.status === UserStatus.DISABLED ? 'ACCOUNT_DISABLED' : 'INVALID_CREDENTIALS',
        },
      });
      throw new AppError({
        code: 'INVALID_CREDENTIALS',
        message: 'The email or password is incorrect.',
        status: 401,
      });
    }

    const sessionToken = randomBytes(32).toString('base64url');
    const csrfToken = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + this.sessionTtlHours * 60 * 60 * 1000);

    await this.repository.transaction(async (transaction) => {
      await transaction.session.create({
        data: {
          userId: user.id,
          tokenHash: sha256(sessionToken),
          csrfTokenHash: sha256(csrfToken),
          expiresAt,
          ipAddress,
          userAgent: userAgent?.slice(0, 500),
        },
      });
      await transaction.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
      await this.auditService.write(transaction, {
        actorUserId: user.id,
        action: 'AUTH_LOGIN_SUCCEEDED',
        entityType: 'USER',
        entityId: user.id,
        correlationId,
        ipAddress,
        userAgent,
        newValues: { outcome: 'AUTHENTICATED' },
      });
    });

    return { sessionToken, csrfToken, expiresAt, user: toPrincipal(user) };
  }

  /** @param {string | undefined} sessionToken */
  async authenticate(sessionToken) {
    if (!sessionToken) return null;
    const session = await this.repository.findSessionByTokenHash(sha256(sessionToken));
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      session.user.status !== UserStatus.ACTIVE
    ) {
      return null;
    }
    return {
      sessionId: session.id,
      csrfTokenHash: session.csrfTokenHash,
      user: toPrincipal(session.user),
    };
  }

  /**
   * @param {object} input
   * @param {string} input.sessionId
   * @param {{ id: string }} input.user
   * @param {string} input.correlationId
   * @param {string | undefined} [input.ipAddress]
   * @param {string | undefined} [input.userAgent]
   */
  async logout({ sessionId, user, correlationId, ipAddress, userAgent }) {
    await this.repository.transaction(async (transaction) => {
      await transaction.session.updateMany({
        where: { id: sessionId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.auditService.write(transaction, {
        actorUserId: user.id,
        action: 'AUTH_LOGOUT',
        entityType: 'USER',
        entityId: user.id,
        correlationId,
        ipAddress,
        userAgent,
        newValues: { outcome: 'SESSION_REVOKED' },
      });
    });
  }
}

/** @param {string} value */
export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

/**
 * @param {string} left
 * @param {string} right
 */
export function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
