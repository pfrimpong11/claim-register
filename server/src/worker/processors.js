import { JOB_NAMES } from './jobs.js';

/**
 * @param {import('pino').Logger} logger
 * @returns {(job: import('bullmq').Job) => Promise<unknown>}
 */
export function createJobProcessor(logger) {
  return async function processJob(job) {
    switch (job.name) {
      case JOB_NAMES.FOUNDATION_PING:
        logger.info({ jobId: job.id, jobName: job.name }, 'foundation worker job processed');
        return { ok: true, processedAt: new Date().toISOString() };
      default:
        throw new Error(`Unsupported job type: ${job.name}`);
    }
  };
}
