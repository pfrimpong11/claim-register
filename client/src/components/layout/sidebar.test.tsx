import { render, screen, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { Sidebar } from './sidebar';
const state = vi.hoisted(() => ({
  path: '/claims/new',
  permissions: ['claims.view', 'claims.create'],
}));
vi.mock('next/navigation', () => ({ usePathname: () => state.path }));
vi.mock('@/lib/auth', () => ({
  useCurrentUser: () => ({
    user: {
      firstName: 'Ama',
      lastName: 'Mensah',
      roles: ['ADMIN'],
      permissions: state.permissions,
    },
  }),
}));
beforeEach(() => {
  state.path = '/claims/new';
  state.permissions = ['claims.view', 'claims.create'];
});
it('marks only the create action active on new claims and hides unavailable areas', () => {
  render(<Sidebar collapsed={false} onToggle={vi.fn()} />);
  expect(screen.getByRole('link', { name: 'Create Claim' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  expect(screen.getByRole('link', { name: 'Claims Register' })).not.toHaveAttribute('aria-current');
  expect(screen.queryByRole('link', { name: 'Reconciliation' })).not.toBeInTheDocument();
  expect(screen.queryByText('Directory')).not.toBeInTheDocument();
});
it('retains named navigation and the selected section when collapsed', () => {
  state.path = '/claims/123';
  render(<Sidebar collapsed onToggle={vi.fn()} />);
  const nav = screen.getByRole('navigation', { name: 'Main navigation' });
  expect(within(nav).getByRole('link', { name: 'Claims Register' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument();
});
