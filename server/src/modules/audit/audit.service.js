const REDACTED_KEYS = new Set([
  'password',
  'passwordHash',
  'token',
  'tokenHash',
  'csrfToken',
  'csrfTokenHash',
  'sessionToken',
  'authorization',
  'cookie',
]);

export class AuditService {
  /**
   * @param {import('@prisma/client').PrismaClient} prisma
   */
  constructor(prisma) {
    this.prisma = prisma;
  }

  /**
   * @param {import('@prisma/client').Prisma.TransactionClient | import('@prisma/client').PrismaClient} client
   * @param {object} event
   * @param {string | null} [event.actorUserId]
   * @param {string} event.action
   * @param {string} event.entityType
   * @param {string | null} [event.entityId]
   * @param {string | null} [event.claimId]
   * @param {unknown} [event.oldValues]
   * @param {unknown} [event.newValues]
   * @param {string} event.correlationId
   * @param {string | null} [event.ipAddress]
   * @param {string | null} [event.userAgent]
   */
  async write(client, event) {
    const oldValues = sanitize(event.oldValues);
    const newValues = sanitize(event.newValues);
    return client.auditLog.create({
      data: {
        actorUserId: event.actorUserId ?? null,
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId ?? null,
        claimId: event.claimId ?? null,
        oldValues:
          oldValues === undefined
            ? undefined
            : /** @type {import('@prisma/client').Prisma.InputJsonValue} */ (oldValues),
        newValues:
          newValues === undefined
            ? undefined
            : /** @type {import('@prisma/client').Prisma.InputJsonValue} */ (newValues),
        correlationId: event.correlationId,
        ipAddress: event.ipAddress ?? null,
        userAgent: event.userAgent?.slice(0, 500) ?? null,
      },
    });
  }
}

/**
 * @param {unknown} value
 * @returns {unknown}
 */
function sanitize(value) {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value)) return value.map(sanitize);
  if (typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [
      key,
      REDACTED_KEYS.has(key) ? '[REDACTED]' : sanitize(nested),
    ]),
  );
}
