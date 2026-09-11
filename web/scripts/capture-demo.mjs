import fs from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const webDirectory = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const projectDirectory = path.dirname(webDirectory);
const outputDirectory = path.join(projectDirectory, 'docs', 'assets', 'screenshots');
const port = Number.parseInt(process.env.TRADOC_CAPTURE_PORT || '2512', 10);
const baseURL = `http://127.0.0.1:${port}`;
const captureURL = `${baseURL}/?lang=en`;
const viteBin = path.join(webDirectory, 'node_modules', 'vite', 'bin', 'vite.js');

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error(`Invalid capture port: ${process.env.TRADOC_CAPTURE_PORT}`);
}

async function isPortAvailable() {
  return new Promise(resolve => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    socket.setTimeout(500);
    socket.once('connect', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(true));
  });
}

if (!(await isPortAvailable())) {
  throw new Error(`Refusing to capture: ${baseURL} is already in use.`);
}

await fs.mkdir(outputDirectory, { recursive: true });

const server = spawn(process.execPath, [viteBin, '--mode', 'demo', '--host', '127.0.0.1', '--port', String(port)], {
  cwd: webDirectory,
  env: { ...process.env },
  stdio: 'inherit',
  windowsHide: true,
  detached: process.platform !== 'win32',
});

let serverExited = false;
server.once('exit', () => {
  serverExited = true;
});

async function waitForServer() {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (serverExited) throw new Error('The demo server exited before becoming ready.');
    try {
      const response = await fetch(baseURL, { signal: AbortSignal.timeout(1_000) });
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('Timed out waiting for the TraDoc demo capture server.');
}

async function stopServer() {
  if (serverExited || !server.pid) return;
  try {
    process.kill(-server.pid, 'SIGTERM');
  } catch {}
}

function installCaptureHooks(page) {
  return page.addInitScript(() => {
    try {
      sessionStorage.setItem('lh-demo-intro-seen', '1');
      localStorage.setItem('tradoc_lang', 'en');
      localStorage.setItem('tradoc_active_tab', 'dashboard');
    } catch {}
  });
}

async function settle(page) {
  await page.waitForLoadState('networkidle').catch(() => page.waitForLoadState('domcontentloaded'));
  await page.addStyleTag({ content: `
    *, *::before, *::after {
      animation-duration: 0s !important;
      animation-delay: 0s !important;
      transition-duration: 0s !important;
      caret-color: transparent !important;
    }
  ` });
  await page.waitForTimeout(400);
}

async function dismissDemoChrome(page) {
  const dialog = page.locator('dialog.lh-demo-dialog');
  if (await dialog.isVisible().catch(() => false)) {
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await dialog.waitFor({ state: 'hidden', timeout: 10_000 });
  }
}

async function assertReadyForCapture(page) {
  if (await page.locator('dialog.lh-demo-dialog[open]').count()) {
    throw new Error('Demo intro dialog is still open.');
  }
  const lang = await page.locator('html').getAttribute('lang');
  if (lang && !lang.toLowerCase().startsWith('en')) {
    throw new Error(`Expected English UI, got html lang=${lang}`);
  }
}

async function capture(page, name, fullPage = false) {
  await settle(page);
  await dismissDemoChrome(page);
  await assertReadyForCapture(page);
  const destination = path.join(outputDirectory, `${name}.png`);
  await page.screenshot({ path: destination, type: 'png', fullPage });
  console.log(`[TRADOC] Captured ${path.relative(projectDirectory, destination)}`);
}

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  const desktop = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: 'dark',
    locale: 'en-US',
    timezoneId: 'Europe/Paris',
    reducedMotion: 'reduce',
  });
  const page = await desktop.newPage();
  await installCaptureHooks(page);
  await page.goto(captureURL);
  await page.getByRole('heading', { name: 'Your documents, faithfully translated.' }).waitFor({ timeout: 20_000 });
  await page.getByText('Northanger Abbey — Sample.md').first().waitFor({ timeout: 20_000 });
  await dismissDemoChrome(page);
  await capture(page, 'tradoc-demo-dashboard', true);

  await page.getByText('Northanger Abbey — Sample.md').first().click();
  await page.getByRole('heading', { name: 'Inspect and review' }).waitFor({ timeout: 20_000 });
  await capture(page, 'tradoc-demo-inspector');

  await page.getByRole('button', { name: /^Glossary$/i }).click();
  await page.getByRole('heading', { name: 'Translation glossaries' }).waitFor({ timeout: 20_000 });
  await capture(page, 'tradoc-demo-glossary');

  await page.getByRole('button', { name: /^Settings$/i }).click();
  await page.getByRole('heading', { name: 'GPU & LLM Engine Configuration' }).waitFor({ timeout: 20_000 });
  await capture(page, 'tradoc-demo-settings');

  await page.getByRole('button', { name: /^Test$/i }).click();
  await page.getByRole('button', { name: 'Run test' }).waitFor({ timeout: 20_000 });
  await capture(page, 'tradoc-demo-sandbox');
  await desktop.close();
} finally {
  await browser?.close();
  await stopServer();
}
