// @ts-check
import path from 'node:path';
import { fileTypeFromBuffer } from 'file-type';
import { AppError } from '../../shared/errors.js';

const ALLOWED = new Map([
  ['application/pdf', 'pdf'],
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);

export class DocumentsService {
  /** @param {{repository: import('./documents.repository.js').DocumentsRepository,auditService: import('../audit/audit.service.js').AuditService,storage: ReturnType<import('../../storage/document-storage.js').createDocumentStorage>,cleanupCoordinator: import('./document-cleanup.service.js').DocumentCleanupService}} input */
  constructor({ repository, auditService, storage, cleanupCoordinator }) {
    this.repository = repository;
    this.auditService = auditService;
    this.storage = storage;
    this.cleanupCoordinator = cleanupCoordinator;
  }

  /** @param {string} claimId */
  async list(claimId) {
    if (!(await this.repository.claimExists(claimId)))
      throw notFound('CLAIM_NOT_FOUND', 'Claim not found.');
    return (await this.repository.list(claimId)).map(serialize);
  }

  /** @param {string} claimId @param {{buffer:Buffer,originalname:string,mimetype:string,size:number}|undefined} file @param {import('zod').infer<typeof import('./documents.schemas.js').documentBodySchema>} input @param {{userId:string,correlationId:string}} context */
  async upload(claimId, file, input, context) {
    if (!file)
      throw new AppError({
        code: 'DOCUMENT_FILE_REQUIRED',
        message: 'Select a document to upload.',
        status: 400,
      });
    if (!(await this.repository.claimExists(claimId)))
      throw notFound('CLAIM_NOT_FOUND', 'Claim not found.');
    const detected = await fileTypeFromBuffer(file.buffer);
    const extension = detected && ALLOWED.get(detected.mime);
    if (!extension || detected?.mime !== file.mimetype)
      throw new AppError({
        code: 'DOCUMENT_TYPE_NOT_ALLOWED',
        message: 'Only valid PDF, JPEG, PNG, or WebP files are accepted.',
        status: 400,
      });
    const suppliedExtension = path.extname(file.originalname).slice(1).toLowerCase();
    if (!extensionMatches(suppliedExtension, extension))
      throw new AppError({
        code: 'DOCUMENT_EXTENSION_MISMATCH',
        message: 'The file extension does not match its content.',
        status: 400,
      });
    const originalFileName = safeFileName(file.originalname);
    const stored = await this.storage.upload({ buffer: file.buffer, extension });
    try {
      const document = await this.repository.transaction(async (tx) => {
        const created = await this.repository.create(tx, {
          claimId,
          documentType: input.documentType,
          originalFileName,
          storageProvider: stored.storageProvider,
          storageKey: stored.storageKey,
          cloudinaryAssetId: stored.cloudinaryAssetId,
          cloudinaryPublicId: stored.cloudinaryPublicId,
          cloudinaryVersion: stored.cloudinaryVersion,
          resourceType: stored.resourceType,
          format: stored.format ?? extension,
          mimeType: detected.mime,
          fileSizeBytes: file.size,
          providerMetadata:
            stored.providerMetadata === null
              ? undefined
              : /** @type {import('@prisma/client').Prisma.InputJsonValue} */ (
                  stored.providerMetadata
                ),
          description: input.description,
          uploadedBy: context.userId,
        });
        await this.auditService.write(tx, {
          actorUserId: context.userId,
          action: 'CLAIM_DOCUMENT_UPLOADED',
          entityType: 'CLAIM_DOCUMENT',
          entityId: created.id,
          claimId,
          correlationId: context.correlationId,
          newValues: {
            claimId,
            documentType: input.documentType,
            mimeType: detected.mime,
            fileSizeBytes: file.size,
            storageProvider: stored.storageProvider,
          },
        });
        return created;
      });
      return serialize(document);
    } catch (error) {
      await this.storage.remove(stored).catch(() => undefined);
      throw error;
    }
  }

  /** @param {string} id */
  async download(id) {
    const document = await this.repository.getActive(id);
    if (!document) throw notFound('DOCUMENT_NOT_FOUND', 'Document not found.');
    return {
      document,
      stream: await this.storage.openDownload(document.storageKey, document.storageProvider),
    };
  }

  /** @param {string} id @param {{userId:string,correlationId:string}} context */
  async deactivate(id, context) {
    const document = await this.repository.getActive(id);
    if (!document) throw notFound('DOCUMENT_NOT_FOUND', 'Document not found.');
    await this.repository.transaction(async (tx) => {
      const result = await this.repository.deactivate(tx, id, context.userId);
      if (result.count !== 1)
        throw new AppError({
          code: 'DOCUMENT_ALREADY_INACTIVE',
          message: 'Document is already inactive.',
          status: 409,
        });
      await this.auditService.write(tx, {
        actorUserId: context.userId,
        action: 'CLAIM_DOCUMENT_DEACTIVATED',
        entityType: 'CLAIM_DOCUMENT',
        entityId: id,
        claimId: document.claimId,
        correlationId: context.correlationId,
        oldValues: { status: 'ACTIVE' },
        newValues: { status: 'INACTIVE' },
      });
    });
    await this.cleanupCoordinator.enqueue(id);
  }
}

/** @param {string} code @param {string} message */
function notFound(code, message) {
  return new AppError({ code, message, status: 404 });
}
/** @param {string} value @param {string} detected */
function extensionMatches(value, detected) {
  return value === detected || (detected === 'jpg' && value === 'jpeg');
}
/** @param {string} value */
function safeFileName(value) {
  const printable = Array.from(path.basename(value), (character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127 || character === '"' || character === '\\' || character === '/'
      ? '_'
      : character;
  }).join('');
  const name = printable.trim();
  return (name || 'document').slice(0, 255);
}
/** @param {Record<string, any> & {fileSizeBytes: bigint}} document */
function serialize(document) {
  return {
    ...document,
    fileSizeBytes: document.fileSizeBytes.toString(),
    storageKey: undefined,
    cloudinaryAssetId: undefined,
    cloudinaryPublicId: undefined,
    providerMetadata: undefined,
  };
}
