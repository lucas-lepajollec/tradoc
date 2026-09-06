import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

async function enterDemo(page) {
  const dialog = page.getByRole('dialog', { name: 'Try the translation workflow, not a real studio.' });
  const title = page.getByRole('heading', { name: 'Try the translation workflow, not a real studio.' });

  await expect(dialog).toBeVisible();
  await expect(title).toBeFocused();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: 'Show demo information' })).toBeVisible();
}

test('loads fictional projects without backend requests', async ({ page }) => {
  await enterDemo(page);
  await expect(page.getByRole('heading', { name: 'Your documents, faithfully translated.' })).toBeVisible();
  await expect(page.getByText('Northanger Abbey — Sample.md').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: /A Voyage to the Moon/ }).first()).toBeVisible();
});

test('opens a completed project in the real inspector', async ({ page }) => {
  await enterDemo(page);
  await page.getByText('Northanger Abbey — Sample.md').first().click();
  await expect(page.getByRole('heading', { name: 'Inspect and review' })).toBeVisible();
  await expect(page.getByText('She began to curl her hair and long for balls.')).toBeVisible();
  await expect(page.getByText('Elle commença à boucler ses cheveux et à rêver de bals.')).toBeVisible();
});

test('keeps the demo banner and navigation usable', async ({ page }, testInfo) => {
  await enterDemo(page);
  if (testInfo.project.name === 'mobile') {
    await page.getByRole('button', { name: 'Open navigation menu' }).click();
  }
  await page.getByRole('button', { name: /^Glossary$/i }).click();
  await expect(page.getByRole('heading', { name: 'Translation glossaries' })).toBeVisible();
  await expect(page.getByText('regency_fiction').first()).toBeVisible();
});

test('returns a complete French translation in the sandbox', async ({ page }, testInfo) => {
  await enterDemo(page);
  if (testInfo.project.name === 'mobile') {
    await page.getByRole('button', { name: 'Open navigation menu' }).click();
  }
  await page.getByRole('button', { name: /^Test$/i }).click();
  await page.getByRole('button', { name: 'Run test' }).click();
  await expect(page.getByText(/Il est une vérité universellement reconnue/)).toBeVisible();
  await expect(page.getByText(/Si peu que l’on connaisse les sentiments/)).toBeVisible();
  await expect(page.getByText(/Mon cher monsieur Bennet/)).toBeVisible();
  await expect(page.locator('.sandbox-document-output')).not.toContainText('However little known');
});
