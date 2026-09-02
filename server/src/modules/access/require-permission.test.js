import { describe, expect, it, vi } from 'vitest';
import { requirePermission } from './require-permission.js';

describe('requirePermission', () => {
  it('allows a principal with the permission', () => {
    const next = vi.fn();
    requirePermission('claims.view')(
      { auth: { user: { permissions: ['claims.view'] } } },
      {},
      next,
    );
    expect(next).toHaveBeenCalledWith();
  });

  it('rejects a principal without the permission', () => {
    const next = vi.fn();
    requirePermission('claims.view')({ auth: { user: { permissions: [] } } }, {}, next);
    expect(next.mock.calls[0][0]).toMatchObject({ code: 'PERMISSION_DENIED', status: 403 });
  });
});
