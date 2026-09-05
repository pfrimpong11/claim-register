import { render, screen } from '@testing-library/react';
import { StatusBadge } from './status-badge';

describe('StatusBadge', () => {
  it('renders the mapped label for known statuses', () => {
    render(<StatusBadge kind="claim" status="SETTLED_PAYMENT_OUTSTANDING" />);
    expect(screen.getByText('Settled, payment outstanding')).toBeInTheDocument();
  });

  it('falls back to a generic label for unknown statuses', () => {
    render(<StatusBadge kind="payment" status="SOMETHING_NEW" />);
    expect(screen.getByText('Something new')).toBeInTheDocument();
  });
});
