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

  let scene, camera, renderer, clock;
  let player, playerLane = 1;
  let velY = 0, sliding = false, slideTimer = 0, onGround = true;
  let speed = START_SPEED;
  let distance = 0, coins = 0;
  let spawnCursor = 0;                 // до какого Z уже наспавнено (в мировых метрах вперёд)
  const obstacles = [];
  const coinsArr = [];
  const tiles = [];
  let best = Number(localStorage.getItem('kf_best') || 0);

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
    scene.fog = new THREE.Fog(0x05060f, 40, 105);

    camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.1, 400);
    camera.position.set(0, 4.4, 8);
    camera.lookAt(0, 1.4, -12);

    renderer = new THREE.WebGLRenderer({ canvas: $('#scene'), antialias: true });
    renderer.setSize(innerWidth, innerHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

    // Свет
    scene.add(new THREE.AmbientLight(0x5566aa, 0.9));
    const key = new THREE.DirectionalLight(0x88ccff, 1.1);
    key.position.set(-6, 12, 6);
    scene.add(key);
    const rim = new THREE.PointLight(0xa855f7, 1.4, 60);
    rim.position.set(0, 6, -20);
    scene.add(rim);

    buildStarfield();
    player = buildShip();
    scene.add(player);

    clock = new THREE.Clock();
    addEventListeners();
    animate();
  }

  // Звёздное небо — облако точек
  function buildStarfield() {
    const g = new THREE.BufferGeometry();
    const n = 900, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3]     = (Math.random() - 0.5) * 260;
      pos[i * 3 + 1] = Math.random() * 90 - 6;
      pos[i * 3 + 2] = -Math.random() * 380;
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({ color: 0x9fd0ff, size: 0.5, sizeAttenuation: true });
    const stars = new THREE.Points(g, m);
    stars.name = 'stars';
    scene.add(stars);
  }

  // Кораблик игрока (стилизованный истребитель)
  function buildShip() {
    const grp = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.ConeGeometry(0.55, 2.0, 6),
      new THREE.MeshStandardMaterial({ color: 0x38e8ff, emissive: 0x0a3a4a, metalness: 0.6, roughness: 0.3 })
    );
    body.rotation.x = -Math.PI / 2;
    body.position.y = 0.9;
    grp.add(body);

    const wingMat = new THREE.MeshStandardMaterial({ color: 0xa855f7, emissive: 0x2a0a4a, metalness: 0.5, roughness: 0.4 });
    const wing = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 0.7), wingMat);
    wing.position.y = 0.7;
    grp.add(wing);

    // Двигательное свечение
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xffce4d })
    );
    glow.position.set(0, 0.85, 0.9);
    grp.add(glow);
    grp.userData.glow = glow;

    grp.position.set(LANES[playerLane], 0, PLAYER_Z);
    return grp;
  }

  // ============================================================
  //  Мир: сегменты коридора + препятствия + кристаллы
  // ============================================================
  function buildTile(z) {
    const grp = new THREE.Group();
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(9, 0.5, TILE_LEN),
      new THREE.MeshStandardMaterial({ color: 0x141a33, metalness: 0.4, roughness: 0.6 })
    );
    floor.position.y = -0.25;
    grp.add(floor);

    // Неоновые направляющие по краям полос
    for (const gx of [-3.6, 3.6]) {
      const strip = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.14, TILE_LEN),
        new THREE.MeshBasicMaterial({ color: 0x38e8ff })
      );
      strip.position.set(gx, 0.03, 0);
      grp.add(strip);
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
    let mesh, h, y;
    if (type === OB_LOW) {
      h = 1.0; y = 0.5;
      mesh = new THREE.Mesh(new THREE.BoxGeometry(1.8, h, 0.8),
        new THREE.MeshStandardMaterial({ color: 0xff4d6d, emissive: 0x3a0010, metalness: 0.3, roughness: 0.5 }));
    } else if (type === OB_HIGH) {
      h = 1.1; y = 2.5;
      mesh = new THREE.Mesh(new THREE.BoxGeometry(1.9, h, 0.8),
        new THREE.MeshStandardMaterial({ color: 0xffa54d, emissive: 0x3a1a00, metalness: 0.3, roughness: 0.5 }));
    } else { // wall
      h = 3.4; y = 1.7;
      mesh = new THREE.Mesh(new THREE.BoxGeometry(1.9, h, 0.7),
        new THREE.MeshStandardMaterial({ color: 0xa855f7, emissive: 0x24003a, metalness: 0.4, roughness: 0.4 }));
    }
    mesh.position.set(LANES[lane], y, z);
    mesh.userData = { type, lane, h, y };
    scene.add(mesh);
    obstacles.push(mesh);
  }

  function buildCoin(lane, z, y) {
    const coin = new THREE.Mesh(
      new THREE.TorusGeometry(0.32, 0.12, 8, 16),
      new THREE.MeshStandardMaterial({ color: 0xffce4d, emissive: 0x5a3d00, metalness: 0.8, roughness: 0.2 })
    );
    coin.position.set(LANES[lane], y, z);
    coin.userData = { lane, spin: Math.random() * Math.PI };
    scene.add(coin);
    coinsArr.push(coin);
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
    if (stars) stars.rotation.z += dt * 0.02;
    const glow = player.userData.glow;
    glow.scale.setScalar(0.8 + Math.sin(performance.now() * 0.02) * 0.25);

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

    // Двигаем мир к игроку
    for (const o of obstacles) o.position.z += dz;
    for (const c of coinsArr) { c.position.z += dz; c.rotation.z += dt * 4; }
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
    for (const o of obstacles) {
      if (Math.abs(o.position.z - PLAYER_Z) > 0.9) continue;
      if (Math.abs(o.position.x - px) > 1.2) continue;   // не наша полоса
      const t = o.userData.type;
      let hit = true;
      if (t === OB_LOW)  hit = py < 1.4;                 // перепрыгнули?
      else if (t === OB_HIGH) hit = !isSliding && py < 1.5; // подкат/прыжок?
      else if (t === OB_WALL) hit = true;                // только смена полосы
      if (hit) { gameOver(); return; }
    }
  }

  // старт
  init();
})();
