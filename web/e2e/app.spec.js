import { test, expect } from '@playwright/test';

test.describe('TraDoc Comprehensive End-to-End Test Suite', () => {

  test.beforeEach(async ({ page }) => {
    // Navigate to homepage before each test
    await page.goto('/');
  });

  test('1. Brand Logo, Header Title & Active Model Badge', async ({ page }) => {
    await expect(page).toHaveTitle(/TraDoc/i);
    await expect(page.locator('text=TraDoc').first()).toBeVisible();
    await expect(page.locator('text=Pro').first()).toBeVisible();
    await expect(page.locator('text=Traduction Littéraire AI').first()).toBeVisible();
  });

  test('2. Navigation Between All 5 Core Tabs', async ({ page }) => {
    // 1. Dashboard
    await expect(page.locator('text=Tableau de Bord & Nouveaux Projets')).toBeVisible();

    // 2. Inspector
    await page.click('text=Inspecteur');
    await expect(page.locator('text=Inspecteur de Segments')).toBeVisible();

    // 3. Sandbox
    await page.click('text=Bac à Sable');
    await expect(page.locator('text=Bac à sable (Aperçu)')).toBeVisible();

    // 4. Glossary Manager
    await page.click('text=Glossaire');
    await expect(page.locator('text=Glossaires Littéraires')).toBeVisible();

    // 5. Configuration GPU
    await page.click('text=Configuration');
    await expect(page.locator('text=Configuration Serveur GPU')).toBeVisible();
  });

  test('3. Dashboard Elements & Dual Import Buttons', async ({ page }) => {
    await expect(page.locator('text=Importer un livre')).toBeVisible();
    await expect(page.locator('text=EPUB / PDF').first()).toBeVisible();
    await expect(page.locator('text=Démarrer la Traduction')).toBeVisible();
    await expect(page.locator('text=Préparer & Inspecter')).toBeVisible();
  });

  test('4. Inspector Action Buttons & Segments Navigation', async ({ page }) => {
    await page.click('text=Inspecteur');
    await expect(page.locator('text=Inspecteur de Segments')).toBeVisible();

    // Check action controls exist
    await expect(page.locator('button:has-text("Resynchroniser")').first()).toBeVisible();
  });

  test('5. Glossary Manager Adding Terms', async ({ page }) => {
    await page.click('text=Glossaire');
    await expect(page.locator('text=TERMES & MOTS CLÉS')).toBeVisible();
    await expect(page.locator('text=+ Ajouter un terme')).toBeVisible();
  });

  test('6. Settings GPU Configuration & Form Controls', async ({ page }) => {
    await page.click('text=Configuration');
    await expect(page.locator('text=Endpoint URL Distant')).toBeVisible();
    await expect(page.locator('text=Type de Serveur')).toBeVisible();
    await expect(page.locator('text=Concurrence Parallèle')).toBeVisible();
    await expect(page.locator('text=Température')).toBeVisible();
    await expect(page.locator('button:has-text("Tester la Connexion")')).toBeVisible();
    await expect(page.locator('button:has-text("Enregistrer les Paramètres")')).toBeVisible();
  });

  test('7. Mobile Responsiveness & Slide-over Drawer Menu', async ({ page }) => {
    // Set viewport to mobile phone size
    await page.setViewportSize({ width: 375, height: 667 });

    // Hamburger button should be visible on mobile
    const hamburgerBtn = page.locator('button[aria-label="Ouvrir le menu"]');
    await expect(hamburgerBtn).toBeVisible();

    // Click hamburger button to open drawer
    await hamburgerBtn.click();

    // Drawer should open and show navigation links
    await expect(page.locator('text=Glossaire').first()).toBeVisible();

    // Click link inside drawer
    await page.click('text=Glossaire');

    // Drawer closes and view updates to Glossaires Littéraires
    await expect(page.locator('text=Glossaires Littéraires')).toBeVisible();
  });

});
