import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { LocalDocumentStorage } from './local-document.storage.js';

const directories = [];
afterEach(async () =>
  Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  ),
);

describe('LocalDocumentStorage', () => {
  it('uses a randomized key and returns the original bytes', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'claims-documents-'));
    directories.push(directory);
    const storage = new LocalDocumentStorage(directory);
    const stored = await storage.upload({ buffer: Buffer.from('safe fixture'), extension: 'pdf' });
    expect(stored.storageKey).toMatch(/^[0-9a-f-]{36}\.pdf$/);
    expect(await readFile(path.join(directory, stored.storageKey), 'utf8')).toBe('safe fixture');
    await storage.remove(stored);
    await expect(readFile(path.join(directory, stored.storageKey))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('rejects traversal and user-controlled paths', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'claims-documents-'));
    directories.push(directory);
    const storage = new LocalDocumentStorage(directory);
    expect(() => storage.resolveKey('../secret.pdf')).toThrow('Invalid document reference.');
    expect(() => storage.resolveKey('chosen-name.pdf')).toThrow('Invalid document reference.');
  });
});
