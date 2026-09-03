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

  const login = await page.request.post('http://localhost:4000/api/v1/auth/login', {
    headers: { Origin: 'http://localhost:3000' },
    data: { email: 'admin@claims.local', password },
  });
  expect(login.ok()).toBe(true);
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/dashboard$/);
  expect(pageErrors).toEqual([]);
  expect(failedResources).toEqual([]);

  await page.goto('/claims');
  await expect(page.getByRole('heading', { name: 'Claims' })).toBeVisible();
  await page.getByRole('link', { name: 'CLM-DEMO-2026-000012' }).click();
  await expect(page.getByRole('heading', { name: 'CLM-DEMO-2026-000012' })).toBeVisible();
  await expect(page.getByText('SETTLED AND PAID', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Indemnity payables' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Payments' })).toBeVisible();
  await expect(page.getByText(/Reconciliation: MATCHED/)).toBeVisible();

  await page.goto('/reconciliation');
  await expect(page.getByRole('heading', { name: /Reconciliation/i })).toBeVisible();
  await page.goto('/accounting');
  await expect(page.getByRole('heading', { name: /Journal/i })).toBeVisible();
  await page.goto('/audit');
  await expect(page.getByRole('heading', { name: /Audit/i })).toBeVisible();
});
