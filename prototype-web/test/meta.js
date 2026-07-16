const { chromium } = require('playwright-core');
const path = require('path');

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=swiftshader', '--no-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 420, height: 820 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon/.test(m.text())) errors.push('CONSOLE: ' + m.text()); });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

  await page.goto('http://localhost:8123/index.html', { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });   // старт с чистого состояния
  await page.waitForTimeout(400);

  const read = () => page.evaluate(() => ({
    wallet: document.querySelector('#wallet-crystals').textContent,
    bpTier: document.querySelector('#bp-btn-tier').textContent,
    dailyBadge: !document.querySelector('#daily-badge').classList.contains('hidden'),
  }));

  const log = [];
  log.push(['start', await read()]);

  // --- Ежедневная награда ---
  await page.click('#btn-daily');
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(__dirname, 'shot-daily.png') });
  await page.click('#daily-claim');
  await page.waitForTimeout(200);
  const dailyMsg = await page.textContent('#daily-msg');
  log.push(['after daily claim', await read(), 'msg=' + dailyMsg.trim()]);
  // повторный клейм не должен работать
  const claimDisabled = await page.isDisabled('#daily-claim');
  log.push(['daily re-claim disabled', claimDisabled]);
  await page.click('.panel:not(.hidden) .panel-x');
  await page.waitForTimeout(150);

  // --- Battle Pass: покупка premium + рендер ---
  await page.click('#btn-battlepass');
  await page.waitForTimeout(200);
  await page.click('#bp-buy');
  await page.waitForTimeout(150);
  const premiumOwned = await page.isDisabled('#bp-buy');
  const tierRows = await page.evaluate(() => document.querySelectorAll('#bp-track .bp-tier').length);
  await page.screenshot({ path: path.join(__dirname, 'shot-bp.png') });
  log.push(['bp premium owned', premiumOwned, 'tierRows=' + tierRows]);
  await page.click('.panel:not(.hidden) .panel-x');
  await page.waitForTimeout(150);

  // --- Завершение забега → награда + удвоение по рекламе ---
  await page.evaluate(() => window.KosmoFlot.onRunFinished({ distance: 500, coins: 40 }));
  await page.waitForTimeout(150);
  const w1 = await page.textContent('#wallet-crystals');
  const earned = await page.textContent('#over-earned');
  const xp = await page.textContent('#over-xp');
  log.push(['run finished', 'wallet=' + w1, 'earned=' + earned, 'xp=' + xp]);

  // Удвоение (реклама) — ждём 3 «секунды» заглушки
  await page.evaluate(() => { document.querySelector('#screen-over').classList.remove('hidden'); });
  await page.click('#btn-double');
  await page.waitForTimeout(2800);
  const w2 = await page.textContent('#wallet-crystals');
  const doubleDisabled = await page.isDisabled('#btn-double');
  log.push(['after ad double', 'wallet=' + w2, 'btnDisabled=' + doubleDisabled]);

  // --- Персистентность (перезагрузка) ---
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  const persisted = await page.textContent('#wallet-crystals');
  log.push(['after reload wallet', persisted]);

  console.log(JSON.stringify(log, null, 1));
  console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
