const userAccessInclude = {
  roles: {
    include: {
      role: {
        include: {
          permissions: { include: { permission: true } },
        },
      },
    },
  },
};

/** @typedef {import('@prisma/client').Prisma.UserGetPayload<{ include: typeof userAccessInclude }>} UserWithAccess */

export class AuthRepository {
  /** @param {import('@prisma/client').PrismaClient} prisma */
  constructor(prisma) {
    this.prisma = prisma;
  }

  /** @param {string} email */
  async findUserByEmail(email) {
    return this.prisma.user.findUnique({ where: { email }, include: userAccessInclude });
  }

  /** @param {string} tokenHash */
  async findSessionByTokenHash(tokenHash) {
    return this.prisma.session.findUnique({
      where: { tokenHash },
      include: { user: { include: userAccessInclude } },
    });
  }

  /**
   * @param {(transaction: import('@prisma/client').Prisma.TransactionClient) => Promise<unknown>} operation
   */
  async transaction(operation) {
    return this.prisma.$transaction(operation);
  }
}

/**
 * @param {UserWithAccess} user
 */
export function toPrincipal(user) {
  const roles = user.roles.map(({ role }) => role.code);
  const permissions = [
    ...new Set(
      user.roles.flatMap(({ role }) => role.permissions.map(({ permission }) => permission.code)),
    ),
  ].sort();
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    roles,
    permissions,
  };
}
