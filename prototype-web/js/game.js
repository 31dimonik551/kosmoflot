/* ============================================================
   KosmoFlot — 3D третье-лицо раннер (Three.js прототип)
   Ядро геймплея: бег, 3 полосы, прыжок, подкат, препятствия,
   кристаллы, нарастающая скорость, счёт, game over.
   ============================================================ */
(function () {
  'use strict';

  // ---------- Константы мира ----------
  const LANES = [-2.4, 0, 2.4];       // X-координаты трёх полос
  const LANE_SWITCH_SPEED = 12;        // насколько быстро корабль скользит между полос
  const GRAVITY = -55;
  const JUMP_V = 17;                   // стартовая скорость прыжка
  const SLIDE_TIME = 0.62;             // длительность подката, сек
  const START_SPEED = 18;              // м/с
  const MAX_SPEED = 46;
  const ACCEL = 0.55;                  // прирост скорости, м/с за сек
  const SPAWN_AHEAD = 120;             // на сколько метров вперёд генерим
  const TILE_LEN = 20;                 // длина сегмента коридора
  const PLAYER_Z = 0;                  // корабль стоит на месте, мир едет к нему

  // ---------- Состояние ----------
  const State = { MENU: 0, RUN: 1, OVER: 2 };
  let state = State.MENU;

  let scene, camera, renderer, clock, shipLight;
  let player, playerLane = 1;
  let velY = 0, sliding = false, slideTimer = 0, onGround = true;
  let speed = START_SPEED;
  let distance = 0, coins = 0;
  let spawnCursor = 0;                 // до какого Z уже наспавнено (в мировых метрах вперёд)
  const obstacles = [];
  const coinsArr = [];
  const tiles = [];
  let best = Number(localStorage.getItem('kf_best') || 0);

  // Бустеры/скин (приходят из магазина через window.KosmoFlot)
  let magnetActive = false, shieldActive = false, invuln = 0;
  const MAGNET_RADIUS = 3.2;

  // Внешний хук для мета-систем (Task 2). Вызывается при завершении забега.
  window.KosmoFlot = window.KosmoFlot || {};

  // ---------- DOM ----------
  const $ = (s) => document.querySelector(s);
  const el = {
    hud: $('#hud'), score: $('#hud-score'), coins: $('#hud-coins'),
    start: $('#screen-start'), over: $('#screen-over'),
    overScore: $('#over-score'), overCoins: $('#over-coins'), overBest: $('#over-best'),
    play: $('#btn-play'), retry: $('#btn-retry'),
  };

  // ============================================================
  //  Инициализация сцены
  // ============================================================
  function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060814);
    scene.fog = new THREE.Fog(0x070a1a, 45, 120);

    camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.1, 400);
    camera.position.set(0, 4.4, 8);
    camera.lookAt(0, 1.4, -12);

    renderer = new THREE.WebGLRenderer({ canvas: $('#scene'), antialias: true });
    renderer.setSize(innerWidth, innerHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

    // Свет
    scene.add(new THREE.AmbientLight(0x3a4770, 0.8));
    const key = new THREE.DirectionalLight(0xbfe0ff, 1.25);
    key.position.set(-6, 14, 6);
    scene.add(key);
    const rimPurple = new THREE.PointLight(0xa855f7, 2.2, 90);
    rimPurple.position.set(-10, 7, -28);
    scene.add(rimPurple);
    const rimCyan = new THREE.PointLight(0x38e8ff, 2.0, 90);
    rimCyan.position.set(10, 7, -40);
    scene.add(rimCyan);
    // Локальная подсветка корабля
    shipLight = new THREE.PointLight(0x9fe8ff, 1.4, 12);
    shipLight.position.set(0, 2.2, 1);
    scene.add(shipLight);

    buildStarfield();
    buildNebula();
    player = buildShip();
    scene.add(player);

    clock = new THREE.Clock();
    addEventListeners();
    animate();
  }

  // Звёздное небо — облако точек с разными размерами/цветами
  function buildStarfield() {
    const g = new THREE.BufferGeometry();
    const n = 1400, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    const palette = [[0.62, 0.82, 1], [1, 1, 1], [0.8, 0.7, 1], [1, 0.9, 0.75]];
    for (let i = 0; i < n; i++) {
      pos[i * 3]     = (Math.random() - 0.5) * 300;
      pos[i * 3 + 1] = Math.random() * 110 - 8;
      pos[i * 3 + 2] = -Math.random() * 420;
      const c = palette[(Math.random() * palette.length) | 0];
      col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2];
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const m = new THREE.PointsMaterial({ size: 0.7, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: 0.9 });
    const stars = new THREE.Points(g, m);
    stars.name = 'stars';
    scene.add(stars);
  }

  // Радиальная текстура-«клякса» для свечений и туманности
  function radialTexture(hex) {
    const s = 128, cv = document.createElement('canvas');
    cv.width = cv.height = s;
    const ctx = cv.getContext('2d');
    const col = '#' + hex.toString(16).padStart(6, '0');
    const grd = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grd.addColorStop(0, col);
    grd.addColorStop(0.25, col);
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, s, s);
    const tex = new THREE.CanvasTexture(cv);
    return tex;
  }

  // Далёкие цветные облака-туманности (билборды)
  function buildNebula() {
    const clouds = [
      { c: 0x3a1d6e, x: -34, y: 20, z: -220, s: 150 },
      { c: 0x0d3f5e, x: 40, y: 14, z: -260, s: 180 },
      { c: 0x5a1f4d, x: 6, y: 34, z: -320, s: 220 },
    ];
    for (const n of clouds) {
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({
        map: radialTexture(n.c), transparent: true, opacity: 0.5,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      spr.position.set(n.x, n.y, n.z);
      spr.scale.setScalar(n.s);
      scene.add(spr);
    }
  }

  // Скин по умолчанию
  const DEFAULT_SKIN = { body: 0x39c6ff, hull: 0x1a3450, wing: 0xa855f7, engine: 0xffce4d };

  // Стилизованный истребитель — собран из геометрии, поддерживает скины
  function buildShip() {
    const grp = new THREE.Group();
    const ud = grp.userData;

    const bodyMat = new THREE.MeshStandardMaterial({ color: DEFAULT_SKIN.body, emissive: 0x0a2a3a, emissiveIntensity: 0.5, metalness: 0.85, roughness: 0.25 });
    const hullMat = new THREE.MeshStandardMaterial({ color: DEFAULT_SKIN.hull, metalness: 0.9, roughness: 0.35 });
    const wingMat = new THREE.MeshStandardMaterial({ color: DEFAULT_SKIN.wing, emissive: 0x2a0a4a, emissiveIntensity: 0.4, metalness: 0.7, roughness: 0.35 });
    const engineMat = new THREE.MeshBasicMaterial({ color: DEFAULT_SKIN.engine });
    ud.mats = { bodyMat, hullMat, wingMat, engineMat };

    // Фюзеляж: коническое тело носом вперёд (-z)
    const fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.5, 2.3, 16), bodyMat);
    fuse.rotation.x = -Math.PI / 2;
    fuse.position.y = 0.85;
    grp.add(fuse);

    // Брюхо/каркас
    const belly = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 1.2, 4, 12), hullMat);
    belly.rotation.x = Math.PI / 2;
    belly.position.set(0, 0.62, 0.15);
    grp.add(belly);

    // Кабина — светящийся купол
    const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12),
      new THREE.MeshStandardMaterial({ color: 0x9ff0ff, emissive: 0x2aa0c0, emissiveIntensity: 0.9, metalness: 0.4, roughness: 0.1, transparent: true, opacity: 0.85 }));
    cockpit.scale.set(1, 0.7, 1.3);
    cockpit.position.set(0, 1.05, -0.2);
    grp.add(cockpit);

    // Крылья (стреловидные)
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.08, 0.85), wingMat);
      wing.position.set(side * 0.85, 0.66, 0.35);
      wing.rotation.y = side * -0.35;
      grp.add(wing);
      // законцовка со свечением
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.5),
        new THREE.MeshBasicMaterial({ color: DEFAULT_SKIN.body }));
      tip.position.set(side * 1.42, 0.7, 0.5);
      grp.add(tip);
      ud[side < 0 ? 'tipL' : 'tipR'] = tip;
    }

    // Киль
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.5), wingMat);
    fin.position.set(0, 1.0, 0.7);
    grp.add(fin);

    // Два двигателя + сопла
    for (const side of [-0.35, 0.35]) {
      const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.4, 12), hullMat);
      nozzle.rotation.x = Math.PI / 2;
      nozzle.position.set(side, 0.62, 0.95);
      grp.add(nozzle);
      const flame = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10), engineMat);
      flame.position.set(side, 0.62, 1.15);
      grp.add(flame);
    }

    // Аддитивное свечение выхлопа (билборд)
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: radialTexture(0xff9a3c), color: 0xffd27a,
      blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
    }));
    glow.position.set(0, 0.62, 1.35);
    glow.scale.setScalar(1.6);
    grp.add(glow);
    ud.glow = glow;

    // Щит-пузырь (виден при активном щите/неуязвимости)
    const shield = new THREE.Mesh(new THREE.SphereGeometry(1.5, 20, 16),
      new THREE.MeshBasicMaterial({ color: 0x54e0ff, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false }));
    shield.position.y = 0.75;
    shield.visible = false;
    grp.add(shield);
    ud.shield = shield;

    grp.position.set(LANES[playerLane], 0, PLAYER_Z);
    applySkin(grp, currentSkin());
    return grp;
  }

  function currentSkin() {
    if (window.KosmoFlot && typeof window.KosmoFlot.getActiveSkin === 'function') {
      return window.KosmoFlot.getActiveSkin() || DEFAULT_SKIN;
    }
    return DEFAULT_SKIN;
  }

  function applySkin(grp, skin) {
    const m = grp.userData.mats;
    if (!m) return;
    m.bodyMat.color.setHex(skin.body);
    m.hullMat.color.setHex(skin.hull);
    m.wingMat.color.setHex(skin.wing);
    m.engineMat.color.setHex(skin.engine);
    if (grp.userData.tipL) grp.userData.tipL.material.color.setHex(skin.body);
    if (grp.userData.tipR) grp.userData.tipR.material.color.setHex(skin.body);
  }

  // ============================================================
  //  Мир: сегменты коридора + препятствия + кристаллы
  // ============================================================
  function buildTile(z) {
    const grp = new THREE.Group();

    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(8.6, 0.5, TILE_LEN),
      new THREE.MeshStandardMaterial({ color: 0x0c1226, metalness: 0.5, roughness: 0.55 })
    );
    floor.position.y = -0.25;
    grp.add(floor);

    // Поперечные «шпалы» — ритм скорости
    for (let i = 0; i < 4; i++) {
      const rung = new THREE.Mesh(
        new THREE.BoxGeometry(7.6, 0.06, 0.18),
        new THREE.MeshBasicMaterial({ color: 0x16305a })
      );
      rung.position.set(0, 0.02, -TILE_LEN / 2 + 2.5 + i * 5);
      grp.add(rung);
    }

    // Тонкие разделители трёх полос
    for (const gx of [-1.2, 1.2]) {
      const div = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.06, TILE_LEN),
        new THREE.MeshBasicMaterial({ color: 0x1f5f6e })
      );
      div.position.set(gx, 0.02, 0);
      grp.add(div);
    }

    // Светящиеся рельсы-борта
    for (const gx of [-3.7, 3.7]) {
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.22, TILE_LEN),
        new THREE.MeshBasicMaterial({ color: 0x38e8ff })
      );
      rail.position.set(gx, 0.08, 0);
      grp.add(rail);
      // невысокий бортик под рельсом
      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.7, TILE_LEN),
        new THREE.MeshStandardMaterial({ color: 0x101a36, metalness: 0.6, roughness: 0.4 })
      );
      wall.position.set(gx * 1.03, -0.2, 0);
      grp.add(wall);
    }

    grp.position.z = z;
    scene.add(grp);
    tiles.push(grp);
    return grp;
  }

  const OB_LOW  = 'low';   // барьер по земле — прыгать
  const OB_HIGH = 'high';  // висячая балка — подкат
  const OB_WALL = 'wall';  // полная стена — менять полосу

  function buildObstacle(type, lane, z) {
    const grp = new THREE.Group();
    const metal = (c) => new THREE.MeshStandardMaterial({ color: c, metalness: 0.9, roughness: 0.35 });

    if (type === OB_LOW) {
      // Энергобарьер: перепрыгнуть
      for (const s of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.1, 10), metal(0x6a2030));
        post.position.set(s * 0.85, 0.5, 0);
        grp.add(post);
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8),
          new THREE.MeshBasicMaterial({ color: 0xff4d6d }));
        cap.position.set(s * 0.85, 1.05, 0);
        grp.add(cap);
      }
      const bar = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.7, 0.14),
        new THREE.MeshStandardMaterial({ color: 0xff4d6d, emissive: 0xff1030, emissiveIntensity: 1.1, roughness: 0.4 }));
      bar.position.set(0, 0.55, 0);
      grp.add(bar);
      grp.add(makeGlow(0xff3355, 2.4, 0, 0.55, 0));

    } else if (type === OB_HIGH) {
      // Лазерные ворота: подкат
      for (const s of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 3.4, 12), metal(0x7a4a1a));
        post.position.set(s * 0.95, 1.7, 0);
        grp.add(post);
      }
      const beam = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.28, 0.18),
        new THREE.MeshStandardMaterial({ color: 0xffa54d, emissive: 0xff7a00, emissiveIntensity: 1.3, roughness: 0.4 }));
      beam.position.set(0, 2.45, 0);
      grp.add(beam);
      // предупреждающие огни
      for (const s of [-1, 1]) {
        const led = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8),
          new THREE.MeshBasicMaterial({ color: 0xffd24d }));
        led.position.set(s * 0.95, 3.35, 0);
        grp.add(led);
      }
      grp.add(makeGlow(0xffa030, 2.6, 0, 2.45, 0));

    } else { // OB_WALL → астероид, обходится сменой полосы
      const ast = makeAsteroid(1.15, 0x8a8f9c, 0x5a3a7a);
      ast.position.set(0, 1.5, 0);
      grp.add(ast);
      grp.userData.spin = (Math.random() - 0.5) * 1.2;
      grp.userData.ast = ast;
    }

    grp.position.set(LANES[lane], 0, z);
    grp.userData.type = type;
    scene.add(grp);
    obstacles.push(grp);
  }

  // Аддитивный билборд-глоу
  function makeGlow(hex, size, x, y, z) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: radialTexture(hex), color: hex,
      blending: THREE.AdditiveBlending, transparent: true, opacity: 0.7, depthWrite: false,
    }));
    s.position.set(x, y, z);
    s.scale.setScalar(size);
    return s;
  }

  // Рокотный астероид: икосаэдр со смещёнными вершинами
  function makeAsteroid(r, rockHex, emHex) {
    const geo = new THREE.IcosahedronGeometry(r, 1);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const f = 1 + (Math.random() - 0.5) * 0.5;
      p.setXYZ(i, p.getX(i) * f, p.getY(i) * f * 1.15, p.getZ(i) * f);
    }
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({
      color: rockHex, emissive: emHex, emissiveIntensity: 0.25,
      metalness: 0.3, roughness: 0.9, flatShading: true,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.scale.set(1.5, 1.5, 1.0);
    return mesh;
  }

  function buildCoin(lane, z, y) {
    const gem = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.34, 0),
      new THREE.MeshStandardMaterial({ color: 0x7fefff, emissive: 0x18b0c8, emissiveIntensity: 0.9, metalness: 0.6, roughness: 0.1, flatShading: true })
    );
    gem.scale.set(1, 1.5, 1);
    // ореол
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: radialTexture(0x38e8ff), color: 0x9ff4ff,
      blending: THREE.AdditiveBlending, transparent: true, opacity: 0.55, depthWrite: false,
    }));
    halo.scale.setScalar(1.5);
    gem.add(halo);

    gem.position.set(typeof lane === 'number' ? LANES[lane] : lane, y, z);
    gem.userData = { spin: Math.random() * Math.PI };
    scene.add(gem);
    coinsArr.push(gem);
  }

  // Процедурная генерация участка впереди
  function generateAhead() {
    while (spawnCursor < distance + SPAWN_AHEAD) {
      const z = -(spawnCursor - distance);   // мировая Z (впереди = отрицательная)

      // Сегменты пола укладываем по сетке
      if (spawnCursor % TILE_LEN < speed * 0.02) { /* tiles handled separately below */ }

      const roll = Math.random();
      if (spawnCursor > 30 && roll < 0.55) {
        // Ставим препятствие(я)
        const patternRoll = Math.random();
        if (patternRoll < 0.5) {
          const type = pick([OB_LOW, OB_HIGH, OB_WALL]);
          buildObstacle(type, rndLane(), z);
        } else {
          // Стена на двух полосах — оставляем один проход
          const open = rndLane();
          for (let l = 0; l < 3; l++) if (l !== open) buildObstacle(OB_WALL, l, z);
          // и дорожку кристаллов в проходе
          for (let k = 0; k < 3; k++) buildCoin(open, z + k * 2.2, 1.1);
        }
      } else if (roll < 0.85) {
        // Цепочка кристаллов
        const lane = rndLane();
        const arc = Math.random() < 0.4;
        for (let k = 0; k < 5; k++) {
          const y = arc ? 1.1 + Math.sin(k / 4 * Math.PI) * 2.2 : 1.1;
          buildCoin(lane, z - k * 2.2, y);
        }
      }
      spawnCursor += 8 + Math.random() * 6;
    }

    // Пол: держим непрерывную ленту тайлов впереди
    while (tiles.length < 12) {
      const lastZ = tiles.length ? tiles[tiles.length - 1].position.z : 10;
      buildTile(lastZ - TILE_LEN);
    }
  }

  const pick = (a) => a[(Math.random() * a.length) | 0];
  const rndLane = () => (Math.random() * 3) | 0;

  // ============================================================
  //  Управление
  // ============================================================
  function addEventListeners() {
    addEventListener('resize', onResize);
    addEventListener('keydown', onKey);

    // Тач-свайпы
    let sx = 0, sy = 0, touching = false;
    const canvas = $('#scene');
    canvas.addEventListener('touchstart', (e) => {
      touching = true; sx = e.touches[0].clientX; sy = e.touches[0].clientY;
    }, { passive: true });
    canvas.addEventListener('touchend', (e) => {
      if (!touching) return; touching = false;
      const t = e.changedTouches[0];
      const dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
      if (Math.abs(dx) > Math.abs(dy)) dx > 0 ? move(1) : move(-1);
      else dy < 0 ? jump() : slide();
    }, { passive: true });

    el.play.addEventListener('click', startRun);
    el.retry.addEventListener('click', startRun);
  }

  function onKey(e) {
    if (state !== State.RUN) {
      if (e.code === 'Space' || e.code === 'Enter') startRun();
      return;
    }
    switch (e.code) {
      case 'ArrowLeft': case 'KeyA': move(-1); break;
      case 'ArrowRight': case 'KeyD': move(1); break;
      case 'ArrowUp': case 'KeyW': case 'Space': jump(); break;
      case 'ArrowDown': case 'KeyS': slide(); break;
    }
  }

  function move(dir) {
    if (state !== State.RUN) return;
    playerLane = Math.max(0, Math.min(2, playerLane + dir));
  }
  function jump() {
    if (state !== State.RUN || !onGround) return;
    velY = JUMP_V; onGround = false; sliding = false;
  }
  function slide() {
    if (state !== State.RUN || !onGround) return;
    sliding = true; slideTimer = SLIDE_TIME;
  }

  function onResize() {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  }

  // ============================================================
  //  Забег
  // ============================================================
  function startRun() {
    // очистка
    for (const o of obstacles) scene.remove(o);
    for (const c of coinsArr) scene.remove(c);
    for (const t of tiles) scene.remove(t);
    obstacles.length = 0; coinsArr.length = 0; tiles.length = 0;

    playerLane = 1; velY = 0; sliding = false; onGround = true;
    speed = START_SPEED; distance = 0; coins = 0; spawnCursor = 0;
    player.position.set(LANES[1], 0, PLAYER_Z);
    player.scale.set(1, 1, 1);

    // Скин + бустеры из магазина
    applySkin(player, currentSkin());
    magnetActive = false; shieldActive = false; invuln = 0;
    if (window.KosmoFlot && typeof window.KosmoFlot.takeBoostersForRun === 'function') {
      const b = window.KosmoFlot.takeBoostersForRun() || {};
      magnetActive = !!b.magnet;
      shieldActive = !!b.shield;
      if (b.headStart) { distance = 250; spawnCursor = 250; invuln = 2.5; }
    }
    player.userData.shield.visible = shieldActive || invuln > 0;

    generateAhead();
    el.start.classList.add('hidden');
    el.over.classList.add('hidden');
    el.hud.classList.remove('hidden');
    state = State.RUN;
  }

  function gameOver() {
    state = State.OVER;
    if (distance > best) { best = Math.floor(distance); localStorage.setItem('kf_best', best); }
    el.overScore.textContent = Math.floor(distance);
    el.overCoins.textContent = coins;
    el.overBest.textContent = 'Рекорд: ' + best + ' м';
    el.hud.classList.add('hidden');
    el.over.classList.remove('hidden');
    // хук для мета-систем (батлпасс/квесты)
    if (typeof window.KosmoFlot.onRunFinished === 'function') {
      window.KosmoFlot.onRunFinished({ distance: Math.floor(distance), coins });
    }
  }

  // ============================================================
  //  Игровой цикл
  // ============================================================
  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);

    if (state === State.RUN) update(dt);

    // анимация звёзд/свечения вне зависимости от состояния
    const stars = scene.getObjectByName('stars');
    if (stars) stars.rotation.z += dt * 0.015;
    const now = performance.now();
    const glow = player.userData.glow;
    glow.scale.setScalar(1.5 + Math.sin(now * 0.02) * 0.35);
    // свет корабля следует за ним
    if (shipLight) { shipLight.position.x = player.position.x; shipLight.position.y = player.position.y + 1.6; }
    // пульс щита
    const sh = player.userData.shield;
    if (sh && sh.visible) sh.scale.setScalar(1 + Math.sin(now * 0.012) * 0.06);

    renderer.render(scene, camera);
  }

  function update(dt) {
    // Скорость нарастает
    speed = Math.min(MAX_SPEED, speed + ACCEL * dt);
    const dz = speed * dt;
    distance += dz;

    // Плавное перестроение по X
    const targetX = LANES[playerLane];
    player.position.x += (targetX - player.position.x) * Math.min(1, LANE_SWITCH_SPEED * dt);
    // крен корабля при манёвре
    player.rotation.z = (targetX - player.position.x) * -0.25;

    // Прыжок / гравитация
    velY += GRAVITY * dt;
    player.position.y += velY * dt;
    if (player.position.y <= 0) { player.position.y = 0; velY = 0; onGround = true; }

    // Подкат
    if (sliding) {
      slideTimer -= dt;
      player.scale.y = 0.5;
      player.position.y = 0;
      if (slideTimer <= 0) sliding = false;
    } else {
      player.scale.y += (1 - player.scale.y) * Math.min(1, 12 * dt);
    }

    // Неуязвимость (щит/разгон) и щит-пузырь
    if (invuln > 0) invuln = Math.max(0, invuln - dt);
    player.userData.shield.visible = shieldActive || invuln > 0;

    // Двигаем мир к игроку
    for (const o of obstacles) {
      o.position.z += dz;
      if (o.userData.ast) { o.userData.ast.rotation.y += o.userData.spin * dt; o.userData.ast.rotation.x += dt * 0.4; }
    }
    for (const c of coinsArr) {
      c.position.z += dz;
      c.rotation.y += dt * 3;
      // Магнит: подтягиваем близкие кристаллы к кораблю
      if (magnetActive && c.position.z > -6 && c.position.z < 12) {
        const dx = player.position.x - c.position.x;
        const dy = (player.position.y + 0.8) - c.position.y;
        if (Math.hypot(dx, c.position.z) < MAGNET_RADIUS + 6) {
          c.position.x += dx * Math.min(1, 8 * dt);
          c.position.y += dy * Math.min(1, 8 * dt);
        }
      }
    }
    for (const t of tiles) t.position.z += dz;

    // Рециклинг тайлов
    for (const t of tiles) {
      if (t.position.z > 30) {
        const minZ = Math.min(...tiles.map((x) => x.position.z));
        t.position.z = minZ - TILE_LEN;
      }
    }

    // Уборка ушедших за спину объектов
    cull(obstacles);
    cull(coinsArr);

    // Генерация впереди
    generateAhead();

    // Столкновения
    checkCollisions();

    // HUD
    el.score.firstChild.nodeValue = Math.floor(distance) + ' ';
    el.coins.textContent = coins;

    // лёгкое покачивание камеры
    camera.position.x += (player.position.x * 0.35 - camera.position.x) * Math.min(1, 4 * dt);
  }

  function cull(arr) {
    for (let i = arr.length - 1; i >= 0; i--) {
      if (arr[i].position.z > 14) { scene.remove(arr[i]); arr.splice(i, 1); }
    }
  }

  function checkCollisions() {
    const px = player.position.x;
    const py = player.position.y;
    const isSliding = sliding;

    // Кристаллы
    for (let i = coinsArr.length - 1; i >= 0; i--) {
      const c = coinsArr[i];
      if (Math.abs(c.position.z - PLAYER_Z) < 1.1 &&
          Math.abs(c.position.x - px) < 1.0 &&
          Math.abs(c.position.y - (py + 0.8)) < 1.4) {
        scene.remove(c); coinsArr.splice(i, 1); coins++;
      }
    }

    // Препятствия
    if (invuln > 0) return;
    for (const o of obstacles) {
      if (Math.abs(o.position.z - PLAYER_Z) > 0.9) continue;
      if (Math.abs(o.position.x - px) > 1.2) continue;   // не наша полоса
      const t = o.userData.type;
      let hit = true;
      if (t === OB_LOW)  hit = py < 1.4;                 // перепрыгнули?
      else if (t === OB_HIGH) hit = !isSliding && py < 1.5; // подкат/прыжок?
      else if (t === OB_WALL) hit = true;                // только смена полосы
      if (hit) {
        if (shieldActive) {                              // щит гасит один удар
          shieldActive = false; invuln = 1.4;
          return;
        }
        gameOver(); return;
      }
    }
  }

  // старт
  init();
})();
