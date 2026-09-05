'use client';

import { FormEvent, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiRequest, rememberCsrfToken } from '@/lib/api';
import type { AuthenticatedUser } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/form';
import styles from './login.module.css';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await apiRequest<{
        data: { user: AuthenticatedUser; csrfToken: string };
      }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: form.get('email'), password: form.get('password') }),
      });
      rememberCsrfToken(response.data.csrfToken);
      const next = searchParams.get('next');
      const safeNext = next?.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';
      router.replace(safeNext);
      router.refresh();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Sign in failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form method="post" onSubmit={submit} className={styles.form}>
      <Field label="Email" htmlFor="email" required>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          maxLength={320}
        />
      </Field>
      <Field label="Password" htmlFor="password" required>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          minLength={8}
          maxLength={200}
        />
      </Field>
      {error ? <p role="alert">{error}</p> : null}
      <Button type="submit" loading={submitting}>
        {submitting ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}
