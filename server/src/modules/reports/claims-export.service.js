import { createWriteStream, createReadStream, promises as fs } from 'node:fs';
import path from 'node:path';
import { once } from 'node:events';
import { z } from 'zod';
import { AppError } from '../../shared/errors.js';
import { JOB_NAMES } from '../../worker/jobs.js';
import { claimsQuerySchema } from '../claims/claims.schemas.js';

export const exportPayloadSchema = z.object({ exportId: z.string().uuid() }).strict();
export class ClaimsExportService {
  /** @param {{repository:import('./reports.repository.js').ReportsRepository,claimsService:import('../claims/claims.service.js').ClaimsService,queue?:import('bullmq').Queue|null,exportsDirectory:string,logger:import('pino').Logger}} input */
  constructor({ repository, claimsService, queue = null, exportsDirectory, logger }) {
    this.repository = repository;
    this.claimsService = claimsService;
    this.queue = queue;
    this.exportsDirectory = exportsDirectory;
    this.logger = logger;
  }
  /** @param {import('zod').infer<typeof claimsQuerySchema>} filters @param {string} userId */
  async request(filters, userId) {
    const storedFilters = JSON.parse(JSON.stringify({ ...filters, page: 1, pageSize: 100 }));
    const item = await this.repository.create({
      reportType: 'CLAIMS_REGISTER',
      filters: storedFilters,
      requestedBy: userId,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    await this.enqueue(item.id);
    return publicExport(item);
  }
  /** @param {string} exportId */
  async enqueue(exportId) {
    if (!this.queue) throw new Error('Report export queue is unavailable.');
    await this.queue.add(
      JOB_NAMES.CLAIMS_EXPORT,
      { exportId },
      {
        jobId: `claims-export-${exportId}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    );
  }
  async recoverPending() {
    const pending = await this.repository.pending();
    for (const item of pending) await this.enqueue(item.id);
    if (pending.length)
      this.logger.info({ count: pending.length }, 'pending report exports enqueued');
  }
  /** @param {string} id @param {string} userId */
  async status(id, userId) {
    const item = await this.repository.getForRequester(id, userId);
    if (!item) notFound();
    return publicExport(item);
  }
  /** @param {string} id @param {string} userId */
  async download(id, userId) {
    const item = await this.repository.getForRequester(id, userId);
    if (!item) notFound();
    if (item.status !== 'COMPLETED' || !item.filePath || !item.fileName)
      throw new AppError({
        code: 'EXPORT_NOT_READY',
        message: 'The export is not ready for download.',
        status: 409,
      });
    if (item.expiresAt < new Date())
      throw new AppError({
        code: 'EXPORT_EXPIRED',
        message: 'The export has expired.',
        status: 410,
      });
    await fs.access(item.filePath);
    return { item, stream: createReadStream(item.filePath) };
  }
  /** @param {unknown} payload */
  async process(payload) {
    const { exportId } = exportPayloadSchema.parse(payload);
    const item = await this.repository.get(exportId);
    if (!item || item.status === 'COMPLETED') return { ok: true, alreadyComplete: true };
    await this.repository.update(exportId, { status: 'PROCESSING', errorMessage: null });
    await fs.mkdir(this.exportsDirectory, { recursive: true });
    const filePath = path.join(this.exportsDirectory, `${exportId}.csv`);
    const fileName = `claims-register-${exportId.slice(0, 8)}.csv`;
    await fs.unlink(filePath).catch(() => {});
    const stream = createWriteStream(filePath, { flags: 'wx' });
    let rowCount = 0;
    try {
      stream.write(
        'Claim Number,Policy Number,Insured,Loss Date,Notification Date,Loss Nature,Currency,Estimated Loss,Approved Amount,Paid Amount,Outstanding Amount,Status\r\n',
      );
      const base = claimsQuerySchema.parse(item.filters);
      let page = 1;
      while (true) {
        const result = await this.claimsService.list({ ...base, page, pageSize: 100 });
        for (const claimValue of result.data) {
          const claim = /** @type {any} */ (claimValue);
          stream.write(
            [
              claim.claimNumber,
              claim.policyNumberSnapshot,
              claim.insuredNameSnapshot,
              date(claim.lossDate),
              date(claim.notificationDate),
              claim.lossNature,
              claim.currencyCode,
              claim.estimatedLossAmount,
              claim.approvedAmount,
              claim.paidAmount,
              claim.outstandingAmount,
              claim.financialStatus,
            ]
              .map(csvCell)
              .join(',') + '\r\n',
          );
          rowCount += 1;
        }
        if (page >= result.meta.totalPages) break;
        page += 1;
      }
      stream.end();
      await once(stream, 'finish');
      await this.repository.update(exportId, {
        status: 'COMPLETED',
        filePath,
        fileName,
        rowCount,
        completedAt: new Date(),
      });
      return { ok: true, rowCount };
    } catch (error) {
      stream.destroy();
      await fs.unlink(filePath).catch(() => {});
      await this.repository.update(exportId, {
        status: 'FAILED',
        errorMessage: error instanceof Error ? error.message.slice(0, 1000) : 'Export failed.',
      });
      throw error;
    }
  }
}
/** @param {unknown} value */
export function csvCell(value) {
  let text = String(value ?? '');
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
/** @param {string|Date} value */
function date(value) {
  return new Date(value).toISOString().slice(0, 10);
}
/** @param {import('@prisma/client').ReportExport} item */
function publicExport(item) {
  return {
    id: item.id,
    status: item.status,
    rowCount: item.rowCount,
    fileName: item.fileName,
    errorMessage: item.errorMessage,
    expiresAt: item.expiresAt,
  };
}
/** @returns {never} */
function notFound() {
  throw new AppError({ code: 'EXPORT_NOT_FOUND', message: 'Export not found.', status: 404 });
}
