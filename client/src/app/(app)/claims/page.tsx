import { Suspense } from 'react';
import { ClaimsRegister } from './register';

export default function ClaimsPage() {
  return (
    <Suspense fallback={<p>Loading register…</p>}>
      <ClaimsRegister />
    </Suspense>
  );
}
