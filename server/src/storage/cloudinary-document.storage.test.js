import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  config: vi.fn(),
  uploadStream: vi.fn(),
  destroy: vi.fn(),
  url: vi.fn(),
}));
vi.mock('cloudinary', () => ({
  v2: {
    config: mocks.config,
    uploader: { upload_stream: mocks.uploadStream, destroy: mocks.destroy },
    url: mocks.url,
  },
}));
import { CloudinaryDocumentStorage } from './cloudinary-document.storage.js';

describe('CloudinaryDocumentStorage', () => {
  beforeEach(() => vi.clearAllMocks());
  it('uses authenticated delivery and returns provider-neutral metadata', async () => {
    mocks.uploadStream.mockImplementation((options, callback) => {
      expect(options).toMatchObject({
        resource_type: 'raw',
        type: 'authenticated',
        use_filename: false,
        unique_filename: true,
      });
      return {
        end: () =>
          callback(null, {
            asset_id: 'asset-1',
            public_id: 'claims-register/documents/random',
            version: 7,
            resource_type: 'raw',
            type: 'authenticated',
            format: 'pdf',
          }),
      };
    });
    const storage = new CloudinaryDocumentStorage({
      cloudName: 'cloud',
      apiKey: 'key',
      apiSecret: 'secret',
    });
    await expect(
      storage.upload({ buffer: Buffer.from('fixture'), extension: 'pdf' }),
    ).resolves.toMatchObject({
      storageProvider: 'CLOUDINARY',
      cloudinaryAssetId: 'asset-1',
      cloudinaryVersion: '7',
      providerMetadata: { type: 'authenticated' },
    });
    expect(mocks.config).toHaveBeenCalledWith(expect.objectContaining({ secure: true }));
  });
  it('deletes authenticated resources idempotently through the provider API', async () => {
    mocks.destroy.mockResolvedValue({ result: 'ok' });
    const storage = new CloudinaryDocumentStorage({
      cloudName: 'cloud',
      apiKey: 'key',
      apiSecret: 'secret',
    });
    await storage.remove({ storageKey: 'claims-register/documents/random', resourceType: 'raw' });
    expect(mocks.destroy).toHaveBeenCalledWith('claims-register/documents/random', {
      resource_type: 'raw',
      type: 'authenticated',
      invalidate: true,
    });
  });
});
