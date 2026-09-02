import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CloudinaryDocumentStorage } from './cloudinary-document.storage.js';
import { LocalDocumentStorage } from './local-document.storage.js';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** @param {ReturnType<import('../config/env.js').parseEnvironment>} config */
export function createDocumentStorage(config) {
  const local = new LocalDocumentStorage(allowedLocalRoot(config.LOCAL_UPLOAD_DIR));
  const cloud =
    config.STORAGE_PROVIDER === 'cloudinary'
      ? new CloudinaryDocumentStorage({
          cloudName: config.CLOUDINARY_CLOUD_NAME ?? '',
          apiKey: config.CLOUDINARY_API_KEY ?? '',
          apiSecret: config.CLOUDINARY_API_SECRET ?? '',
        })
      : null;
  const active = cloud ?? local;
  return {
    upload: active.upload.bind(active),
    /** @param {string} storageKey @param {string} provider */
    openDownload(storageKey, provider) {
      return select(provider).openDownload(storageKey);
    },
    /** @param {{storageKey:string,storageProvider:string,resourceType?:string|null}} stored */
    remove(stored) {
      return select(stored.storageProvider).remove(stored);
    },
  };

  /** @param {string} provider */
  function select(provider) {
    if (provider === 'LOCAL') return local;
    if (provider === 'CLOUDINARY' && cloud) return cloud;
    throw new Error(`Storage provider ${provider} is not configured on this runtime.`);
  }
}

/** @param {string} localUploadDirectory */
function allowedLocalRoot(localUploadDirectory) {
  const configuredPath = path.resolve(serverRoot, localUploadDirectory);
  const allowedRoot = path.resolve(serverRoot, 'uploads');
  if (configuredPath !== allowedRoot)
    throw new Error('LOCAL_UPLOAD_DIR must resolve to server/uploads.');
  return allowedRoot;
}
