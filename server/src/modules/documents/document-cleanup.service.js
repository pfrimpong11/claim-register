import { z } from 'zod';
import { JOB_NAMES } from '../../worker/jobs.js';

export const documentCleanupPayloadSchema = z.object({ documentId: z.string().uuid() }).strict();

export class DocumentCleanupService {
  /** @param {{repository:import('./documents.repository.js').DocumentsRepository,storage:ReturnType<import('../../storage/document-storage.js').createDocumentStorage>,queue?:import('bullmq').Queue|null,logger:import('pino').Logger}} input */
  constructor({ repository, storage, queue = null, logger }) {
    this.repository = repository;
    this.storage = storage;
    this.queue = queue;
    this.logger = logger;
  }

  /** @param {string} documentId */
  async enqueue(documentId) {
    if (!this.queue) throw new Error('Document cleanup queue is unavailable.');
    await this.queue.add(
      JOB_NAMES.DOCUMENT_CLEANUP,
      { documentId },
      {
        jobId: `document-cleanup-${documentId}`,
        attempts: 5,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    );
  }

  async recoverPending() {
    const pending = await this.repository.listPendingCleanup();
    for (const document of pending) await this.enqueue(document.id);
    if (pending.length)
      this.logger.info({ count: pending.length }, 'pending document cleanups enqueued');
  }

  /** @param {unknown} payload */
  async process(payload) {
    const { documentId } = documentCleanupPayloadSchema.parse(payload);
    const document = await this.repository.getPendingCleanup(documentId);
    if (!document) return { ok: true, alreadyComplete: true };
    try {
      await this.storage.remove(document);
      await this.repository.markCleanupCompleted(documentId);
      return { ok: true, alreadyComplete: false };
    } catch (error) {
      await this.repository.markCleanupFailed(documentId, error);
      throw error;
    }
  }
}
