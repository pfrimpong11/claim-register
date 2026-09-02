import { ClaimsRegister } from './register';
import { Suspense } from 'react';
export default function ClaimsPage() {
  return (
    <main className="workspace">
      <Suspense fallback={<p>Loading register…</p>}>
        <ClaimsRegister />
      </Suspense>
    </main>
  );
}
