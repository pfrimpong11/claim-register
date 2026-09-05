import { Suspense } from 'react';
import { ClaimDetail } from './claim-detail';

export default async function ClaimPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p>Loading claim…</p>}>
      <ClaimDetail id={(await params).id} />
    </Suspense>
  );
}
