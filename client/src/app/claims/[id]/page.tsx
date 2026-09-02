import { ClaimDetail } from './claim-detail';
export default async function ClaimPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <main className="workspace">
      <ClaimDetail id={(await params).id} />
    </main>
  );
}
