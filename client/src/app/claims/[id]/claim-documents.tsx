'use client';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { API_BASE_URL, apiRequest, readCookie } from '@/lib/api';

type DocumentRecord = {
  id: string;
  documentType: string;
  originalFileName: string;
  mimeType: string;
  fileSizeBytes: string;
  description?: string;
  uploadedAt: string;
  uploader: { firstName: string; lastName: string };
};
const TYPES = [
  'CLAIM_FORM',
  'POLICE_REPORT',
  'ID_DOCUMENT',
  'VEHICLE_DOCUMENT',
  'LOSS_PHOTO',
  'ESTIMATE',
  'INVOICE',
  'ADJUSTER_REPORT',
  'PAYMENT_PROOF',
  'OTHER',
];

export function ClaimDocuments({ claimId }: { claimId: string }) {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(
    () =>
      apiRequest<{ data: DocumentRecord[] }>(`/claims/${claimId}/documents`).then((result) =>
        setDocuments(result.data),
      ),
    [claimId],
  );
  useEffect(() => {
    load().catch((reason) => setError(reason.message));
  }, [load]);

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await apiRequest(`/claims/${claimId}/documents`, {
        method: 'POST',
        headers: { 'X-CSRF-Token': readCookie('claims_csrf') ?? '' },
        body: new FormData(event.currentTarget),
      });
      event.currentTarget.reset();
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to upload document.');
    } finally {
      setBusy(false);
    }
  }
  async function download(document: DocumentRecord) {
    const response = await fetch(`${API_BASE_URL}/documents/${document.id}/download`, {
      credentials: 'include',
    });
    if (!response.ok) {
      setError('Unable to download document.');
      return;
    }
    const url = URL.createObjectURL(await response.blob());
    const anchor = window.document.createElement('a');
    anchor.href = url;
    anchor.download = document.originalFileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }
  async function deactivate(id: string) {
    if (!window.confirm('Remove this document from the active claim record?')) return;
    try {
      await apiRequest(`/documents/${id}/deactivate`, {
        method: 'POST',
        headers: { 'X-CSRF-Token': readCookie('claims_csrf') ?? '' },
      });
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to remove document.');
    }
  }
  return (
    <section className="documents-section">
      <h2>Documents</h2>
      {error && <p role="alert">{error}</p>}
      <form className="document-form" onSubmit={upload}>
        <label>
          Document type
          <select name="documentType" required>
            {TYPES.map((type) => (
              <option key={type} value={type}>
                {type.replaceAll('_', ' ')}
              </option>
            ))}
          </select>
        </label>
        <label>
          Description
          <input name="description" maxLength={500} />
        </label>
        <label>
          File
          <input name="file" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" required />
        </label>
        <button disabled={busy} type="submit">
          {busy ? 'Uploading…' : 'Upload document'}
        </button>
      </form>
      {documents.length === 0 ? (
        <p>No documents have been uploaded.</p>
      ) : (
        <ul className="document-list">
          {documents.map((document) => (
            <li key={document.id}>
              <div>
                <strong>{document.originalFileName}</strong>
                <br />
                <span>
                  {document.documentType.replaceAll('_', ' ')} ·{' '}
                  {Math.ceil(Number(document.fileSizeBytes) / 1024)} KB ·{' '}
                  {new Date(document.uploadedAt).toLocaleString()}
                </span>
                {document.description && <p>{document.description}</p>}
              </div>
              <div className="document-actions">
                <button type="button" onClick={() => download(document)}>
                  Download
                </button>
                <button className="secondary" type="button" onClick={() => deactivate(document.id)}>
                  Deactivate
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
