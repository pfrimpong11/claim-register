'use client';

import { enumLabel, formatDateTime } from '@/lib/format';
import type { Claim, Reserve } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Money } from '@/components/ui/stats';
import { Pill } from '@/components/ui/status-badge';

const COLUMNS: Column<Reserve>[] = [
  { key: 'reserveType', header: 'Type', render: (reserve) => enumLabel(reserve.reserveType) },
  {
    key: 'amount',
    header: 'Amount',
    align: 'right',
    render: (reserve) => <Money amount={reserve.amount} currency={reserve.currencyCode} />,
  },
  {
    key: 'status',
    header: 'Status',
    render: (reserve) => (
      <Pill tone={reserve.status === 'ACTIVE' ? 'success' : 'neutral'}>
        {enumLabel(reserve.status)}
      </Pill>
    ),
  },
  {
    key: 'createdAt',
    header: 'Created',
    nowrap: true,
    render: (reserve) => formatDateTime(reserve.createdAt ?? null),
  },
];

export function ReservesTab({ claim }: { claim: Claim }) {
  return (
    <Card
      title="Reserves"
      subtitle="The initial indemnity reserve is created with the claim."
      flush
    >
      <DataTable
        columns={COLUMNS}
        rows={claim.reserves ?? []}
        rowKey={(reserve) => reserve.id}
        emptyMessage="No reserves recorded."
      />
    </Card>
  );
}
