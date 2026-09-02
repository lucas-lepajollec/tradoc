import { test, expect } from '@playwright/test';


test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/events') {
      return route.fulfill({ status: 200, contentType: 'text/event-stream', body: 'data: {"type":"connected"}\n\n' });
    }
    if (url.pathname === '/api/settings/test-connection') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, message: 'ok', models: ['test-model'] }) });
    }
    if (url.pathname === '/api/jobs' || url.pathname === '/api/glossaries') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await page.goto('/');
});


test('dashboard exposes every supported import format', async ({ page }) => {
  await expect(page).toHaveTitle(/TraDoc/i);
  await expect(page.getByRole('heading', { name: 'Your documents, faithfully translated.' })).toBeVisible();
  await expect(page.getByText('EPUB / PDF / DOCX / MD / TXT')).toBeVisible();
});


test('main workspaces are reachable from the sidebar', async ({ page }) => {
  await page.getByRole('button', { name: /Inspector & Tracking/i }).click();
  await expect(page.getByRole('heading', { name: 'Inspect and review' })).toBeVisible();
  await page.getByRole('button', { name: /^Test$/i }).click();
  await expect(page.getByText('Instant test')).toBeVisible();
  await page.getByRole('button', { name: /^Glossary$/i }).click();
  await expect(page.getByRole('heading', { name: 'Translation glossaries' })).toBeVisible();
  await page.getByRole('button', { name: /^Settings$/i }).click();
  await expect(page.getByText('Preferences', { exact: true })).toBeVisible();
});


test('mobile navigation opens and changes workspace', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.getByRole('button', { name: 'Open navigation menu' }).click();
  await page.getByRole('button', { name: /^Glossary$/i }).click();
  await expect(page.getByRole('heading', { name: 'Translation glossaries' })).toBeVisible();
});

for (const locale of [
  { code: 'en', title: /Structured document translation/, heading: 'Your documents, faithfully translated.' },
  { code: 'fr', title: /Traduction structurée de documents/, heading: 'Vos documents, fidèlement traduits.' },
  { code: 'es', title: /Traducción estructurada de documentos/, heading: 'Tus documentos, traducidos con fidelidad.' },
  { code: 'de', title: /Strukturierte Dokumentübersetzung/, heading: 'Deine Dokumente, originalgetreu übersetzt.' },
]) {
  test(`loads the complete ${locale.code} interface contract`, async ({ page }) => {
    await page.evaluate((code) => localStorage.setItem('tradoc_lang', code), locale.code);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', locale.code);
    await expect(page).toHaveTitle(locale.title);
    await expect(page.getByRole('heading', { name: locale.heading })).toBeVisible();
  });
}
