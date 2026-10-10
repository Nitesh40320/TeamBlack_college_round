import { test, expect } from '@playwright/test';

test.describe('Second Opinion End-to-End Audit Flow', () => {
  test('landing page loads and enables one-click demo audit', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Audit LLM Answers');

    // Click "Try Demo Audit"
    const demoBtn = page.getByRole('button', { name: /Try Demo Audit/i });
    await expect(demoBtn).toBeVisible();
    await demoBtn.click();

    // Navigates to /audit/demo-audit-001
    await expect(page).toHaveURL(/\/audit\/demo-audit-001/);
    await expect(page.locator('h2')).toContainText('Annotated Answer & Source Text Split View');
  });

  test('submit new audit -> see claims -> open finding -> export report', async ({ page }) => {
    await page.goto('/new');

    // Fill Answer text input
    const answerInput = page.getByPlaceholder(/Paste the AI-generated answer/i);
    await answerInput.fill('Aspirin reduces fever in adults. Standard dose is 5000 mg every 2 hours.');

    // Submit audit form
    const submitBtn = page.getByRole('button', { name: /Run Fact Audit/i });
    await submitBtn.click();

    // Verify redirect to audit page
    await expect(page).toHaveURL(/\/audit\//);

    // Verify Claims tab
    await expect(page.locator('role=tab[name*="Claims"]')).toBeVisible();

    // Verify export buttons
    await expect(page.locator('text=Export:')).toBeVisible();

    // Click Copy Link
    const copyBtn = page.getByRole('button', { name: /Copy Link/i });
    await expect(copyBtn).toBeVisible();
    await copyBtn.click();
  });
});
