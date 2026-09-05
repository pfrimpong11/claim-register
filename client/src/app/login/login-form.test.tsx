import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { LoginForm } from './login-form';

const replace = vi.fn();
const refresh = vi.fn();
const getSearchParam = vi.fn<(name: string) => string | null>(() => null);
const apiRequest = vi.fn();
const rememberCsrfToken = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, refresh }),
  useSearchParams: () => ({ get: getSearchParam }),
}));

vi.mock('@/lib/api', () => ({
  apiRequest: (...args: unknown[]) => apiRequest(...args),
  rememberCsrfToken: (...args: unknown[]) => rememberCsrfToken(...args),
}));

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSearchParam.mockReturnValue(null);
    apiRequest.mockResolvedValue({ data: { user: {}, csrfToken: 'token' } });
  });

  it('uses POST as the native fallback so credentials are never added to the URL', () => {
    render(<LoginForm />);

    expect(screen.getByRole('button', { name: 'Sign in' }).closest('form')).toHaveAttribute(
      'method',
      'post',
    );
  });

  it('submits with JavaScript and redirects to the dashboard', async () => {
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: 'user@example.test' } });
    fireEvent.change(screen.getByLabelText(/Password/), { target: { value: 'password123' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Sign in' }).closest('form')!);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/dashboard'));
    expect(apiRequest).toHaveBeenCalledWith('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'user@example.test', password: 'password123' }),
    });
    expect(rememberCsrfToken).toHaveBeenCalledWith('token');
  });

  it('does not follow a protocol-relative next redirect', async () => {
    getSearchParam.mockReturnValue('//example.test');
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: 'user@example.test' } });
    fireEvent.change(screen.getByLabelText(/Password/), { target: { value: 'password123' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Sign in' }).closest('form')!);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/dashboard'));
  });
});
