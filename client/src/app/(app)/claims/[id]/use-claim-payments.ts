'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';
import { usePermission } from '@/lib/auth';
import type { Payable, Payment } from '@/lib/types';

export type PaymentWithPayable = Payment & { payable: Payable };

/** Loads every payable on the claim plus the payments recorded under each. */
export function useClaimPayments(claimId: string) {
  const canViewPayments = usePermission('payments.view');
  const [payables, setPayables] = useState<Payable[]>([]);
  const [payments, setPayments] = useState<PaymentWithPayable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(
    () =>
      apiRequest<{ data: Payable[] }>(`/claims/${claimId}/payables`)
        .then(async (payableResult) => {
          const withPayments = canViewPayments
            ? await Promise.all(
                payableResult.data.map(async (payable) => {
                  if (payable.status === 'CANCELLED') return [];
                  const paymentResult = await apiRequest<{ data: Payment[] }>(
                    `/payables/${payable.id}/payments`,
                  );
                  return paymentResult.data.map((payment) => ({ ...payment, payable }));
                }),
              )
            : [];
          setPayables(payableResult.data);
          setPayments(withPayments.flat());
          setError('');
        })
        .catch((e: unknown) =>
          setError(e instanceof Error ? e.message : 'Payments could not load.'),
        )
        .finally(() => setLoading(false)),
    [claimId, canViewPayments],
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  return { payables, payments, loading, error, reload };
}
