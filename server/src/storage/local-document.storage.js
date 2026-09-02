// @ts-check
import { createReadStream } from 'node:fs';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { AppError } from '../shared/errors.js';

export class LocalDocumentStorage {
  /** @param {string} rootDirectory */
  constructor(rootDirectory) {
    this.rootDirectory = path.resolve(rootDirectory);
  }

  /** @param {{buffer: Buffer, extension: string}} file */
  async upload(file) {
    await mkdir(this.rootDirectory, { recursive: true });
    const storageKey = `${randomUUID()}.${file.extension}`;
    const target = this.resolveKey(storageKey);
    await writeFile(target, file.buffer, { flag: 'wx', mode: 0o600 });
    return {
      storageProvider: /** @type {const} */ ('LOCAL'),
      storageKey,
      cloudinaryAssetId: null,
      cloudinaryPublicId: null,
      cloudinaryVersion: null,
      resourceType: null,
      format: file.extension,
      providerMetadata: null,
    };
  }

  /** @param {string} storageKey */
  openDownload(storageKey) {
    return createReadStream(this.resolveKey(storageKey));
  }

  /** @param {{storageKey: string}} stored */
  async remove(stored) {
    try {
      await unlink(this.resolveKey(stored.storageKey));
    } catch (error) {
      if (/** @type {NodeJS.ErrnoException} */ (error).code !== 'ENOENT') throw error;
    }
  }

  /** @param {string} storageKey */
  resolveKey(storageKey) {
    if (!/^[0-9a-f-]{36}\.[a-z0-9]{2,10}$/.test(storageKey)) {
      throw new AppError({
        code: 'INVALID_STORAGE_KEY',
        message: 'Invalid document reference.',
        status: 400,
      });
    }
    const target = path.resolve(this.rootDirectory, storageKey);
    if (path.dirname(target) !== this.rootDirectory) {
      throw new AppError({
        code: 'INVALID_STORAGE_KEY',
        message: 'Invalid document reference.',
        status: 400,
      });
    }
    return target;
  }
}
