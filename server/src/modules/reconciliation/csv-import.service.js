import { createReadStream, promises as fs } from 'node:fs';
import { createInterface } from 'node:readline';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { JOB_NAMES } from '../../worker/jobs.js';
import { csvRowSchema } from './reconciliation.schemas.js';

export const importPayloadSchema = z.object({ importId: z.string().uuid() }).strict();
const headers = [
  'externalReference',
  'transactionDate',
  'valueDate',
  'transactionType',
  'amount',
  'currencyCode',
  'description',
];

export class CsvImportService {
  /** @param {{repository:import('./reconciliation.repository.js').ReconciliationRepository,queue?:import('bullmq').Queue|null,logger:import('pino').Logger}} input */
  constructor({ repository, queue = null, logger }) {
    this.repository = repository;
    this.queue = queue;
    this.logger = logger;
  }
  /** @param {string} importId */ async enqueue(importId) {
    if (!this.queue) throw new Error('Transaction import queue is unavailable.');
    await this.queue.add(
      JOB_NAMES.TRANSACTION_IMPORT,
      { importId },
      {
        jobId: `transaction-import-${importId}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    );
  }
  async recoverPending() {
    const pending = await this.repository.pendingImports();
    for (const item of pending) await this.enqueue(item.id);
    if (pending.length)
      this.logger.info({ count: pending.length }, 'pending transaction imports enqueued');
  }
  /** @param {unknown} payload */ async process(payload) {
    const { importId } = importPayloadSchema.parse(payload);
    const item = await this.repository.importById(importId);
    if (!item || ['COMPLETED', 'COMPLETED_WITH_ERRORS'].includes(item.status))
      return { ok: true, alreadyComplete: true };
    await this.repository.updateImport(importId, { status: 'PROCESSING' });
    let totalRows = 0,
      importedRows = 0,
      duplicateRows = 0,
      failedRows = 0;
    const errors = [];
    try {
      const lines = createInterface({
        input: createReadStream(item.storagePath, { encoding: 'utf8' }),
        crlfDelay: Infinity,
      });
      let first = true;
      for await (const line of lines) {
        if (first) {
          first = false;
          const actual = parseCsvLine(line).map((value) => value.trim());
          if (actual.join(',') !== headers.join(','))
            throw new Error(`CSV headers must be: ${headers.join(',')}`);
          continue;
        }
        if (!line.trim()) continue;
        totalRows += 1;
        try {
          const values = parseCsvLine(line);
          if (values.length !== headers.length) throw new Error('Incorrect column count.');
          const row = csvRowSchema.parse(
            Object.fromEntries(headers.map((header, index) => [header, values[index]])),
          );
          if (row.currencyCode !== item.settlementAccount.currencyCode)
            throw new Error('Row currency does not match the settlement account.');
          await this.repository.transaction((tx) =>
            this.repository.createExternal(tx, {
              settlementAccountId: item.settlementAccountId,
              importId,
              externalReference: row.externalReference,
              transactionDate: new Date(`${row.transactionDate}T00:00:00.000Z`),
              valueDate: row.valueDate ? new Date(`${row.valueDate}T00:00:00.000Z`) : null,
              transactionType: row.transactionType,
              amount: row.amount,
              currencyCode: row.currencyCode,
              description: row.description || null,
              sourceType: item.sourceType,
            }),
          );
          importedRows += 1;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
            duplicateRows += 1;
          else {
            failedRows += 1;
            if (errors.length < 100)
              errors.push({ row: totalRows + 1, message: safeMessage(error) });
          }
        }
      }
      const status = failedRows ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED';
      await this.repository.updateImport(importId, {
        status,
        totalRows,
        importedRows,
        duplicateRows,
        failedRows,
        errorSummary: errors,
        importedAt: new Date(),
      });
      await fs.unlink(item.storagePath).catch(() => {});
      return {
        ok: true,
        alreadyComplete: false,
        status,
        totalRows,
        importedRows,
        duplicateRows,
        failedRows,
      };
    } catch (error) {
      await this.repository.updateImport(importId, {
        status: 'FAILED',
        totalRows,
        importedRows,
        duplicateRows,
        failedRows: failedRows + 1,
        errorSummary: [{ row: null, message: safeMessage(error) }],
      });
      throw error;
    }
  }
}

/** @param {string} line */ export function parseCsvLine(line) {
  const values = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && quoted && line[index + 1] === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) {
      values.push(value);
      value = '';
    } else value += char;
  }
  if (quoted) throw new Error('Unclosed quoted CSV field.');
  values.push(value);
  return values;
}
/** @param {unknown} error */ function safeMessage(error) {
  return error instanceof z.ZodError
    ? error.issues.map((issue) => issue.message).join('; ')
    : error instanceof Error
      ? error.message.slice(0, 500)
      : 'Invalid row.';
}
