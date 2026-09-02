import { describe, expect, it, vi } from 'vitest';
import { DocumentsService } from './documents.service.js';

const claimId = '11111111-1111-4111-8111-111111111111';
const context = { userId: '22222222-2222-4222-8222-222222222222', correlationId: 'request-1' };
function setup() {
  const repository = {
    claimExists: vi.fn().mockResolvedValue(true),
    transaction: vi.fn(async (operation) => operation({})),
    create: vi.fn().mockRejectedValue(new Error('database failed')),
  };
  const storage = {
    upload: vi.fn().mockResolvedValue({
      storageProvider: 'LOCAL',
      storageKey: '11111111-1111-4111-8111-111111111111.pdf',
      cloudinaryAssetId: null,
      cloudinaryPublicId: null,
      cloudinaryVersion: null,
      resourceType: null,
      format: 'pdf',
      providerMetadata: null,
    }),
    remove: vi.fn().mockResolvedValue(undefined),
  };
  const service = new DocumentsService({
    repository,
    storage,
    auditService: { write: vi.fn() },
    cleanupCoordinator: { enqueue: vi.fn() },
  });
  return { service, repository, storage };
}

describe('DocumentsService upload validation', () => {
  it('rejects a spoofed MIME type before storage', async () => {
    const { service, storage } = setup();
    await expect(
      service.upload(
        claimId,
        {
          buffer: Buffer.from('not a pdf'),
          originalname: 'report.pdf',
          mimetype: 'application/pdf',
          size: 9,
        },
        { documentType: 'CLAIM_FORM' },
        context,
      ),
    ).rejects.toMatchObject({ code: 'DOCUMENT_TYPE_NOT_ALLOWED' });
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('removes stored content when the metadata transaction fails', async () => {
    const { service, storage } = setup();
    const pdf = Buffer.from('%PDF-1.4\n%fixture\n');
    await expect(
      service.upload(
        claimId,
        { buffer: pdf, originalname: 'report.pdf', mimetype: 'application/pdf', size: pdf.length },
        { documentType: 'CLAIM_FORM' },
        context,
      ),
    ).rejects.toThrow('database failed');
    expect(storage.remove).toHaveBeenCalledOnce();
  });
});
