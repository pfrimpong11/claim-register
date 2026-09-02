import { describe, expect, it, vi } from 'vitest';
import { DocumentCleanupService } from './document-cleanup.service.js';

const id = '11111111-1111-4111-8111-111111111111';
function setup(overrides = {}) {
  const repository = {
    listPendingCleanup: vi.fn().mockResolvedValue([]),
    getPendingCleanup: vi
      .fn()
      .mockResolvedValue({ id, storageKey: 'key.pdf', storageProvider: 'LOCAL' }),
    markCleanupCompleted: vi.fn().mockResolvedValue({ count: 1 }),
    markCleanupFailed: vi.fn().mockResolvedValue({ count: 1 }),
    ...overrides,
  };
  const storage = { remove: vi.fn().mockResolvedValue(undefined) };
  const queue = { add: vi.fn().mockResolvedValue(undefined) };
  const service = new DocumentCleanupService({
    repository,
    storage,
    queue,
    logger: { info: vi.fn() },
  });
  return { service, repository, storage, queue };
}

describe('DocumentCleanupService', () => {
  it('physically removes pending content and marks completion', async () => {
    const { service, repository, storage } = setup();
    await expect(service.process({ documentId: id })).resolves.toEqual({
      ok: true,
      alreadyComplete: false,
    });
    expect(storage.remove).toHaveBeenCalledOnce();
    expect(repository.markCleanupCompleted).toHaveBeenCalledWith(id);
  });

  it('records a failed attempt and rethrows for BullMQ retry', async () => {
    const { service, repository, storage } = setup();
    storage.remove.mockRejectedValue(new Error('provider unavailable'));
    await expect(service.process({ documentId: id })).rejects.toThrow('provider unavailable');
    expect(repository.markCleanupFailed).toHaveBeenCalledWith(id, expect.any(Error));
  });

  it('uses stable job identifiers and validates queue payloads', async () => {
    const { service, queue } = setup();
    await service.enqueue(id);
    expect(queue.add).toHaveBeenCalledWith(
      'documents.cleanup',
      { documentId: id },
      expect.objectContaining({ jobId: `document-cleanup-${id}`, attempts: 5 }),
    );
    await expect(service.process({ documentId: '../bad' })).rejects.toThrow();
  });
});
