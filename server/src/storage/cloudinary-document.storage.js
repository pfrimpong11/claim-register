// @ts-check
import { Readable } from 'node:stream';
import { v2 as cloudinary } from 'cloudinary';

export class CloudinaryDocumentStorage {
  /** @param {{cloudName:string,apiKey:string,apiSecret:string}} config */
  constructor(config) {
    cloudinary.config({
      cloud_name: config.cloudName,
      api_key: config.apiKey,
      api_secret: config.apiSecret,
      secure: true,
    });
  }

  /** @param {{buffer: Buffer, extension: string}} file */
  async upload(file) {
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'claims-register/documents',
          resource_type: 'raw',
          type: 'authenticated',
          use_filename: false,
          unique_filename: true,
        },
        (error, value) => (error ? reject(error) : resolve(value)),
      );
      stream.end(file.buffer);
    });
    const parsed = /** @type {Record<string, unknown>} */ (result);
    return {
      storageProvider: /** @type {const} */ ('CLOUDINARY'),
      storageKey: String(parsed.public_id),
      cloudinaryAssetId: String(parsed.asset_id),
      cloudinaryPublicId: String(parsed.public_id),
      cloudinaryVersion: String(parsed.version),
      resourceType: String(parsed.resource_type),
      format: typeof parsed.format === 'string' ? parsed.format : file.extension,
      providerMetadata: { type: String(parsed.type) },
    };
  }

  /** @param {string} storageKey */
  async openDownload(storageKey) {
    const url = cloudinary.url(storageKey, {
      resource_type: 'raw',
      type: 'authenticated',
      sign_url: true,
      secure: true,
    });
    const response = await fetch(url);
    if (!response.ok || !response.body) throw new Error('Cloud document could not be retrieved.');
    return Readable.fromWeb(
      /** @type {import('node:stream/web').ReadableStream} */ (response.body),
    );
  }

  /** @param {{storageKey:string,resourceType?:string|null}} stored */
  async remove(stored) {
    await cloudinary.uploader.destroy(stored.storageKey, {
      resource_type: stored.resourceType ?? 'raw',
      type: 'authenticated',
      invalidate: true,
    });
  }
}
