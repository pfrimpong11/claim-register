// @ts-check
import { expect, test } from '@playwright/test';

test('admin can inspect the seeded claim-to-payment journey', async ({ page }) => {
  const pageErrors = [];
  const failedResources = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('requestfailed', (request) => failedResources.push(request.url()));
  page.on('response', (response) => {
    if (response.status() >= 400 && response.url().includes('/_next/')) {
      failedResources.push(`${response.status()} ${response.url()}`);
    }
  });
  const password = process.env.E2E_PASSWORD;
  test.skip(!password, 'Set E2E_PASSWORD to the same value used by SEED_DEFAULT_PASSWORD.');

  const clientOrigin = `http://localhost:${process.env.E2E_CLIENT_PORT ?? '3000'}`;
  const login = await page.request.post('http://localhost:4000/api/v1/auth/login', {
    headers: { Origin: clientOrigin },
    data: { email: 'admin@claims.local', password },
  });
  expect(login.ok()).toBe(true);
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/dashboard$/);
  expect(pageErrors).toEqual([]);
  expect(failedResources).toEqual([]);

  await page.goto('/claims');
  await expect(page.getByRole('heading', { name: 'Claims', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'CLM-DEMO-2026-000012' }).click();
  await expect(page.getByRole('heading', { name: 'CLM-DEMO-2026-000012' })).toBeVisible();
  await expect(page.getByText('Settled and paid', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Payables' }).click();
  await expect(page.getByRole('heading', { name: 'Indemnity payables' })).toBeVisible();
  await page.getByRole('button', { name: 'Payments' }).click();
  await expect(page.getByRole('heading', { name: 'Payments' })).toBeVisible();
  await page.getByRole('button', { name: 'Reconciliation' }).click();
  await expect(page.getByText(/Reconciliation: MATCHED/).first()).toBeVisible();

  await page.goto('/reconciliation');
  await expect(page.getByRole('heading', { name: 'Reconciliation', exact: true })).toBeVisible();
  await page.goto('/accounting');
  await expect(page.getByRole('heading', { name: 'Journal Entries', exact: true })).toBeVisible();
  await page.goto('/audit');
  await expect(page.getByRole('heading', { name: 'Audit Logs', exact: true })).toBeVisible();
});
