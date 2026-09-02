import { describe, expect, it, vi } from 'vitest';
import { createCsrfProtection } from './csrf.js';
import { sha256 } from '../modules/auth/auth.service.js';

describe('CSRF protection', () => {
  it('accepts matching cookie/header/session tokens', () => {
    const token = 'a-secure-csrf-token';
    const next = vi.fn();
    createCsrfProtection({ cookieName: 'csrf' })(
      {
        get: () => token,
        cookies: { csrf: token },
        auth: { csrfTokenHash: sha256(token) },
      },
      {},
      next,
    );
    expect(next).toHaveBeenCalledWith();
  });

  it('rejects a missing or mismatched token', () => {
    const next = vi.fn();
    createCsrfProtection({ cookieName: 'csrf' })(
      { get: () => 'wrong', cookies: { csrf: 'cookie' }, auth: { csrfTokenHash: sha256('real') } },
      {},
      next,
    );
    expect(next.mock.calls[0][0]).toMatchObject({ code: 'CSRF_TOKEN_INVALID', status: 403 });
  });
});
