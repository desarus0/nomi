// End-to-end: 3 players (usage: npm run test:e2e -- [baseUrl]; needs Google Chrome or CHROME_PATH)
// End-to-end: 3 players (separate contexts = separate anonymous sessions) play a full Nomi game.
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const BASE = process.argv[2] ?? 'https://nomi-kappa-orpin.vercel.app';
const OUT = new URL('../e2e-shots/', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : '/usr/bin/google-chrome'), headless: true });
const seen = new Set();
const mk = async () => {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true,
    geolocation: { latitude: 37.7596, longitude: -122.4269 }, permissions: ['geolocation', 'clipboard-read', 'clipboard-write'],
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
  page.on('response', async (r) => { if (r.status() >= 400 && !seen.has(r.url().split('?')[0] + r.status())) { seen.add(r.url().split('?')[0] + r.status()); console.log('HTTP', r.status(), r.request().method(), r.url().slice(0, 120), (await r.text().catch(() => '')).slice(0, 300), (r.request().postData() ?? '').slice(0, 200)); } });
  return page;
};
const shot = (p, n) => p.screenshot({ path: OUT + n + '.png' });
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

const host = await mk(), kelly = await mk(), marcus = await mk();

// --- Host creates the party
await host.goto(BASE);
await shot(host, '01-home');
await host.getByRole('button', { name: 'Create a Party' }).click();
await host.getByPlaceholder('e.g. Kevin').fill('Kevin');
await host.getByText('Current location').waitFor({ timeout: 10000 });
await shot(host, '02-settings');
await host.getByRole('button', { name: 'Next: Add Restaurants' }).click();
await host.waitForURL(/\/p\/[A-Z0-9]{5}\/pool/, { timeout: 15000 });
const code = host.url().match(/\/p\/([A-Z0-9]{5})/)[1];
log('party code', code);

// --- Pool: add 6 restaurants from real search
const search = host.getByPlaceholder('Search restaurants by name');
for (const q of ['pho', 'taqueria', 'sushi']) {
  await search.fill(q);
  const adds = host.getByRole('button', { name: /^Add / });
  await adds.first().waitFor({ timeout: 15000 });
  for (let i = 0; i < 2; i++) { await host.getByRole('button', { name: /^Add / }).first().click(); await host.waitForTimeout(700); }
}
await shot(host, '03-pool');
await host.getByRole('button', { name: 'Done' }).click();
await host.waitForURL(new RegExp(`/p/${code}$`));

// --- Others join via invite link
for (const [p, name] of [[kelly, 'Kelly'], [marcus, 'Marcus']]) {
  await p.goto(`${BASE}/join/${code}`);
  await p.getByText(/Party found/).waitFor({ timeout: 15000 });
  if (name === 'Kelly') await shot(p, '04-join');
  await p.getByPlaceholder('e.g. Kelly').fill(name);
  await p.getByRole('button', { name: 'Join Party' }).click();
  await p.getByRole('button', { name: /I’m Ready/ }).click({ timeout: 15000 });
}
await host.getByText('3 of 3 ready').first().waitFor({ timeout: 15000 });
log('lobby: everyone ready (realtime)');
await shot(host, '05-lobby');
await host.getByRole('button', { name: 'Start Voting' }).click();

// --- Play rounds
async function play(p, name, strategy) {
  let round = 0, shotSwipe = false;
  for (let t = 0; t < 600; t++) {
    if (await p.getByText('We’re eating at…').isVisible().catch(() => false)) { log(name, 'sees winner'); return; }
    const yum = p.getByRole('button', { name: 'Yum', exact: true });
    if (await yum.isVisible().catch(() => false) && await yum.isEnabled().catch(() => false)) {
      const header = await p.locator('header').innerText().catch(() => '');
      const m = header.match(/Round (\d+)/); const r = m ? +m[1] : 0;
      if (r !== round) {
        round = r; log(name, 'round', r);
        if (!shotSwipe && name === 'Kelly') { await shot(p, '06-swipe'); shotSwipe = true; }
        await strategy.onRound?.(p, r);
      }
      const card = await p.locator('[aria-roledescription="restaurant card"]').getAttribute('aria-label').catch(() => '');
      const choice = strategy.vote(card ?? '');
      await p.getByRole('button', { name: choice, exact: true }).click().catch(() => {});
      await p.waitForTimeout(350);
      continue;
    }
    if (name === 'Kelly' && await p.getByText(/^Waiting on|Everyone’s in/).isVisible().catch(() => false) && !strategy.waitShot) { await shot(p, '09-waiting'); strategy.waitShot = true; }
    if (name === 'Kevin' && await p.getByText(/move on!|moves on!/).isVisible().catch(() => false) && !strategy[`res${round}`]) { strategy[`res${round}`] = 1; await shot(p, `10-results-r${round}`); log('results r' + round); }
    await p.waitForTimeout(400);
  }
  throw new Error(name + ' timed out');
}

const kellyStrat = {
  vote: (c) => (/Pho|pho/.test(c) ? 'Yum' : Math.random() < 0.5 ? 'Yum' : 'Nope'),
  async onRound(p, r) {
    if (r !== 1) return;
    await p.waitForTimeout(800); // let the card photo load
    await shot(p, '06-swipe');
    await p.getByRole('button', { name: 'Details' }).click();
    await p.waitForTimeout(1200);
    await shot(p, '06b-details');
    await p.getByRole('dialog').getByRole('button', { name: 'Close' }).first().click();
    await p.getByRole('button', { name: 'Power-up' }).click();
    await shot(p, '07-powerups');
    await p.getByRole('radio', { name: /Veto/ }).click();
    await p.getByRole('button', { name: 'Next: Choose a Target' }).click();
    await p.getByRole('dialog').getByRole('button').filter({ has: p.getByRole('radio') }).first().click();
    await shot(p, '08-veto');
    await p.getByRole('button', { name: /^Veto .* pts$/ }).click();
    log('Kelly played Veto');
  },
};
const marcusStrat = {
  vote: () => (Math.random() < 0.6 ? 'Yum' : 'Nope'),
  async onRound(p, r) {
    if (r !== 1) return;
    await p.getByRole('button', { name: 'Power-up' }).click();
    await p.getByRole('radio', { name: /Double Vote/ }).click();
    await p.getByRole('button', { name: /Play Double Vote/ }).click();
    log('Marcus played Double Vote');
  },
};
const kevinStrat = { vote: () => (Math.random() < 0.5 ? 'Yum' : 'Nope') };

await Promise.all([play(host, 'Kevin', kevinStrat), play(kelly, 'Kelly', kellyStrat), play(marcus, 'Marcus', marcusStrat)]);
await host.waitForTimeout(1500);
await shot(host, '11-winner');
const winner = await host.locator('h2').first().innerText();
log('WINNER:', winner);
await browser.close();
