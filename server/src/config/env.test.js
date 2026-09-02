import { describe, expect, it } from 'vitest';
import { parseEnvironment } from './env.js';

describe('parseEnvironment', () => {
  it('uses local storage when Cloudinary is entirely absent', () => {
    expect(parseEnvironment({ NODE_ENV: 'test' }).STORAGE_PROVIDER).toBe('local');
  });

  it('uses local storage when Cloudinary variables are empty or whitespace', () => {
    const parsed = parseEnvironment({
      NODE_ENV: 'test',
      CLOUDINARY_CLOUD_NAME: '',
      CLOUDINARY_API_KEY: '   ',
      CLOUDINARY_API_SECRET: '',
    });
    expect(parsed.STORAGE_PROVIDER).toBe('local');
    expect(parsed.CLOUDINARY_CLOUD_NAME).toBeUndefined();
    expect(parsed.CLOUDINARY_API_KEY).toBeUndefined();
    expect(parsed.CLOUDINARY_API_SECRET).toBeUndefined();
  });

  it('uses Cloudinary when all credentials are present', () => {
    const parsed = parseEnvironment({
      NODE_ENV: 'test',
      CLOUDINARY_CLOUD_NAME: 'cloud',
      CLOUDINARY_API_KEY: 'key',
      CLOUDINARY_API_SECRET: 'secret',
    });
    expect(parsed.STORAGE_PROVIDER).toBe('cloudinary');
  });

  it('rejects partial Cloudinary configuration', () => {
    expect(() => parseEnvironment({ NODE_ENV: 'test', CLOUDINARY_CLOUD_NAME: 'cloud' })).toThrow(
      /entirely present or entirely absent/,
    );
  });

  it('rejects a mixture of configured and empty Cloudinary variables', () => {
    expect(() =>
      parseEnvironment({
        NODE_ENV: 'test',
        CLOUDINARY_CLOUD_NAME: 'cloud',
        CLOUDINARY_API_KEY: '',
        CLOUDINARY_API_SECRET: '',
      }),
    ).toThrow(/entirely present or entirely absent/);
  });

  it('parses session and login throttling defaults', () => {
    const parsed = parseEnvironment({ NODE_ENV: 'test' });
    expect(parsed.SESSION_COOKIE_NAME).toBe('claims_session');
    expect(parsed.CSRF_COOKIE_NAME).toBe('claims_csrf');
    expect(parsed.SESSION_TTL_HOURS).toBe(12);
    expect(parsed.LOGIN_RATE_LIMIT_MAX).toBe(10);
  });
});
