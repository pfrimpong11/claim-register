import { Worker } from 'bullmq';
import { QUEUE_NAME } from './jobs.js';
import { createJobProcessor } from './processors.js';

export class WorkerRuntime {
  /**
   * @param {object} input
   * @param {import('ioredis').default} input.connection
   * @param {import('pino').Logger} input.logger
   * @param {number} input.concurrency
   * @param {{documentCleanup?:import('../modules/documents/document-cleanup.service.js').DocumentCleanupService,csvImport?:import('../modules/reconciliation/csv-import.service.js').CsvImportService,claimsExport?:import('../modules/reports/claims-export.service.js').ClaimsExportService}} [input.services]
   */
  constructor({ connection, logger, concurrency, services = {} }) {
    this.connection = connection;
    this.logger = logger;
    this.concurrency = concurrency;
    this.services = services;
    /** @type {Worker | null} */
    this.worker = null;
    this.ready = false;
  }

  isReady = () => this.ready;

  async start() {
    if (this.worker) return;

    this.worker = new Worker(QUEUE_NAME, createJobProcessor(this.logger, this.services), {
      connection: this.connection,
      concurrency: this.concurrency,
    });
    this.worker.on('error', (error) => {
      this.ready = false;
      this.logger.error({ err: error }, 'worker error');
    });
    this.worker.on('failed', (job, error) => {
      this.logger.error({ err: error, jobId: job?.id, jobName: job?.name }, 'worker job failed');
    });
    this.worker.on('completed', (job) => {
      this.logger.info({ jobId: job.id, jobName: job.name }, 'worker job completed');
    });

    await this.worker.waitUntilReady();
    this.ready = true;
    this.logger.info({ queue: QUEUE_NAME, concurrency: this.concurrency }, 'worker ready');
  }

  async close() {
    this.ready = false;
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
  }
}
