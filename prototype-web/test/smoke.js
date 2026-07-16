const { chromium } = require('playwright-core');
const path = require('path');

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--no-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 420, height: 820 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

  const url = 'http://localhost:8123/index.html';
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(__dirname, 'shot-menu.png') });

  // Старт игры
  await page.click('#btn-play');
  await page.waitForTimeout(400);

  // Немного «поиграем»: прыжки, смена полос, подкат
  const keys = ['ArrowRight','ArrowUp','ArrowLeft','ArrowDown','Space','ArrowRight','ArrowUp'];
  for (const k of keys) { await page.keyboard.press(k); await page.waitForTimeout(300); }
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(__dirname, 'shot-run.png') });

  // Читаем HUD и внутреннее состояние
  const hud = await page.evaluate(() => ({
    score: document.querySelector('#hud-score').textContent.trim(),
    coins: document.querySelector('#hud-coins').textContent.trim(),
    hudVisible: !document.querySelector('#hud').classList.contains('hidden'),
  }));

  console.log('HUD:', JSON.stringify(hud));
  console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
