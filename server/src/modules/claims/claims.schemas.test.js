import { describe, expect, it } from 'vitest';
import { claimsQuerySchema } from './claims.schemas.js';

describe('claimsQuerySchema', () => {
  it('treats empty optional filter values as absent', () => {
    const parsed = claimsQuerySchema.parse({
      search: '',
      status: '',
      currency: '',
      lossFrom: '',
      lossTo: '',
      notificationFrom: '',
      notificationTo: '',
    });

    expect(parsed).toMatchObject({ search: '', page: 1, pageSize: 20 });
    expect(parsed.status).toBeUndefined();
    expect(parsed.currency).toBeUndefined();
    expect(parsed.lossFrom).toBeUndefined();
    expect(parsed.lossTo).toBeUndefined();
  });

  it('continues to reject non-empty invalid filters', () => {
    expect(() => claimsQuerySchema.parse({ status: 'UNKNOWN', lossFrom: 'not-a-date' })).toThrow();
  });
});
