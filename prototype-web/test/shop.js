const { chromium } = require('playwright-core');
const path = require('path');

(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--use-gl=swiftshader','--no-sandbox'] });
  const p = await b.newPage({ viewport:{width:420,height:820} });
  const errs=[]; p.on('pageerror',e=>errs.push('PAGEERR '+e.message));
  p.on('console',m=>{if(m.type()==='error'&&!/favicon/.test(m.text()))errs.push('CON '+m.text());});

  await p.goto('http://localhost:8123/index.html',{waitUntil:'networkidle'});
  await p.evaluate(()=>localStorage.clear());
  await p.reload({waitUntil:'networkidle'});
  await p.waitForTimeout(400);

  const log=[];
  // Заработать кристаллы
  await p.evaluate(()=>window.KosmoFlot.onRunFinished({distance:1000,coins:600}));
  await p.waitForTimeout(150);
  await p.evaluate(()=>document.querySelector('#screen-over').classList.add('hidden'));

  // Открыть магазин
  await p.click('#btn-shop'); await p.waitForTimeout(250);
  await p.screenshot({path:path.join(__dirname,'shot-shop.png')});
  const skinCards = await p.evaluate(()=>document.querySelectorAll('#shop-skins .skin-card').length);
  log.push(['skin cards', skinCards, 'balance', await p.textContent('#shop-balance')]);

  // Купить второй скин (первый .buy это Ember 300)
  await p.click('#shop-skins .skin-card .skin-btn.buy'); await p.waitForTimeout(200);
  const afterBuy = await p.evaluate(()=>({
    active: window.KosmoFlot.getActiveSkin(),
    balance: document.querySelector('#shop-balance').textContent,
    msg: document.querySelector('#shop-msg').textContent,
  }));
  log.push(['after buy skin', 'balance='+afterBuy.balance, 'activeBodyHex=0x'+afterBuy.active.body.toString(16), afterBuy.msg]);

  // Вкладка бустеров + купить магнит
  await p.click('.shop-tab[data-tab="boosters"]'); await p.waitForTimeout(150);
  await p.screenshot({path:path.join(__dirname,'shot-boosters.png')});
  await p.click('#shop-boosters .booster-row .booster-buy'); await p.waitForTimeout(150);
  const boostersOwned = await p.evaluate(()=>JSON.parse(localStorage.getItem('kf_meta_v1')).boosters);
  log.push(['boosters after buy', JSON.stringify(boostersOwned)]);

  // takeBoostersForRun списывает
  const taken = await p.evaluate(()=>window.KosmoFlot.takeBoostersForRun());
  const boostersAfter = await p.evaluate(()=>JSON.parse(localStorage.getItem('kf_meta_v1')).boosters);
  log.push(['takeBoosters', JSON.stringify(taken), 'remaining', JSON.stringify(boostersAfter)]);

  // Персистентность скина
  await p.reload({waitUntil:'networkidle'}); await p.waitForTimeout(300);
  const persisted = await p.evaluate(()=>{const s=JSON.parse(localStorage.getItem('kf_meta_v1'));return {owned:s.skinsOwned,active:s.activeSkin};});
  log.push(['persisted', JSON.stringify(persisted)]);

  console.log(JSON.stringify(log,null,1));
  console.log('ERRORS', errs.length?errs.join('|'):'none');
  await b.close(); process.exit(errs.length?1:0);
})().catch(e=>{console.error('FATAL',e);process.exit(2)});
