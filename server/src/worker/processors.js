import { JOB_NAMES } from './jobs.js';

/**
 * @param {import('pino').Logger} logger
 * @param {{documentCleanup?:import('../modules/documents/document-cleanup.service.js').DocumentCleanupService}} [services]
 * @returns {(job: import('bullmq').Job) => Promise<unknown>}
 */
export function createJobProcessor(logger, services = {}) {
  return async function processJob(job) {
    switch (job.name) {
      case JOB_NAMES.FOUNDATION_PING:
        logger.info({ jobId: job.id, jobName: job.name }, 'foundation worker job processed');
        return { ok: true, processedAt: new Date().toISOString() };
      case JOB_NAMES.DOCUMENT_CLEANUP:
        if (!services.documentCleanup)
          throw new Error('Document cleanup processor is unavailable.');
        return services.documentCleanup.process(job.data);
      default:
        throw new Error(`Unsupported job type: ${job.name}`);
    }
  };
}
