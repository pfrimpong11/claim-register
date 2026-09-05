'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { API_BASE_URL, apiMutate, apiRequest } from '@/lib/api';
import { usePermission } from '@/lib/auth';
import { enumLabel, formatDateTime } from '@/lib/format';
import { DOCUMENT_TYPES, type DocumentRecord } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Field, Input, Select } from '@/components/ui/form';
import { ConfirmDialog, Modal } from '@/components/ui/overlay';
import { useToast } from '@/components/ui/toast';
import styles from './claim-tabs.module.css';

export function DocumentsTab({ claimId }: { claimId: string }) {
  const toast = useToast();
  const canUpload = usePermission('documents.upload');
  const canDeactivate = usePermission('documents.deactivate');
  const [documents, setDocuments] = useState<DocumentRecord[]>();
  const [error, setError] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toRemove, setToRemove] = useState<DocumentRecord | null>(null);

  const load = useCallback(
    () =>
      apiRequest<{ data: DocumentRecord[] }>(`/claims/${claimId}/documents`)
        .then((response) => {
          setDocuments(response.data);
          setError('');
        })
        .catch((e: unknown) =>
          setError(e instanceof Error ? e.message : 'Documents could not load.'),
        ),
    [claimId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      await apiMutate(`/claims/${claimId}/documents`, {
        body: new FormData(event.currentTarget),
      });
      setUploadOpen(false);
      toast.success('Document uploaded.');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Unable to upload document.');
    } finally {
      setBusy(false);
    }
  }

  async function download(record: DocumentRecord) {
    try {
      const response = await fetch(`${API_BASE_URL}/documents/${record.id}/download`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Unable to download document.');
      const url = URL.createObjectURL(await response.blob());
      const anchor = window.document.createElement('a');
      anchor.href = url;
      anchor.download = record.originalFileName;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Unable to download document.');
    }
  }

  async function deactivate() {
    if (!toRemove) return;
    setBusy(true);
    try {
      await apiMutate(`/documents/${toRemove.id}/deactivate`);
      toast.success('Document removed from the active record.');
      setToRemove(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Unable to remove document.');
    } finally {
      setBusy(false);
    }
  }

  const columns: Column<DocumentRecord>[] = [
    {
      key: 'documentType',
      header: 'Type',
      nowrap: true,
      render: (record) => enumLabel(record.documentType),
    },
    { key: 'originalFileName', header: 'File Name' },
    {
      key: 'size',
      header: 'Size',
      align: 'right',
      nowrap: true,
      render: (record) => `${Math.ceil(Number(record.fileSizeBytes) / 1024)} KB`,
    },
    {
      key: 'uploader',
      header: 'Uploaded By',
      render: (record) => `${record.uploader.firstName} ${record.uploader.lastName}`,
    },
    {
      key: 'uploadedAt',
      header: 'Uploaded At',
      nowrap: true,
      render: (record) => formatDateTime(record.uploadedAt),
    },
    {
      key: 'description',
      header: 'Description',
      render: (record) => record.description || '—',
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (record) => (
        <div className={styles.actionsCell}>
          <Button
            size="sm"
            variant="ghost"
            icon="download"
            onClick={() => void download(record)}
            aria-label={`Download ${record.originalFileName}`}
          >
            Download
          </Button>
          {canDeactivate ? (
            <Button
              size="sm"
              variant="ghost"
              icon="trash"
              onClick={() => setToRemove(record)}
              aria-label={`Deactivate ${record.originalFileName}`}
            >
              Deactivate
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <>
      <Card
        title="Documents"
        actions={
          canUpload ? (
            <Button icon="upload" size="sm" onClick={() => setUploadOpen(true)}>
              Upload Document
            </Button>
          ) : undefined
        }
        flush
      >
        {error ? <p role="alert">{error}</p> : null}
        <DataTable
          columns={columns}
          rows={documents ?? []}
          rowKey={(record) => record.id}
          loading={documents === undefined && !error}
          emptyMessage="No documents have been uploaded."
        />
      </Card>
      <Modal open={uploadOpen} title="Upload Document" onClose={() => setUploadOpen(false)}>
        <form onSubmit={upload} className={styles.formStack}>
          <Field label="Document Type" htmlFor="document-type" required>
            <Select
              id="document-type"
              name="documentType"
              required
              options={DOCUMENT_TYPES.map((type) => ({ value: type, label: enumLabel(type) }))}
            />
          </Field>
          <Field label="File" htmlFor="document-file" required>
            <Input
              id="document-file"
              name="file"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              required
            />
          </Field>
          <Field label="Description" htmlFor="document-description">
            <Input id="document-description" name="description" maxLength={500} />
          </Field>
          <div className={styles.formActions}>
            <Button variant="secondary" onClick={() => setUploadOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              {busy ? 'Uploading…' : 'Upload'}
            </Button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog
        open={toRemove !== null}
        title="Deactivate document"
        message={
          toRemove
            ? `Remove “${toRemove.originalFileName}” from the active claim record? It stays in the audit history.`
            : ''
        }
        confirmLabel="Deactivate"
        tone="danger"
        busy={busy}
        onConfirm={() => void deactivate()}
        onCancel={() => setToRemove(null)}
      />
    </>
  );
}
