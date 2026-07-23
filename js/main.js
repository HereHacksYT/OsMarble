const { Engine, Bodies, Composite, Events } = Matter;

let engine, canvas, ctx;
let currentMode = 'menu';
let selectedTileType = 'start';
let editorMapPieces = [];
let marbles = [];
let startPoint = { x: 400, y: 100 }; // Varsayılan Doğma Noktası

// KAMERA (YUKARI - AŞAĞI GEZİNME)
let cameraY = 0;
let isDraggingCamera = false;
let lastMouseY = 0;

// Kayıtlı Haritalar
let savedMaps = JSON.parse(localStorage.getItem('m_maps_2d_v2')) || {
  "Varsayılan Parkur": {
    start: { x: 400, y: 50 },
    pieces: [
      { type: 'flat', x: 400, y: 120 },
      { type: 'ramp-down', x: 550, y: 220 },
      { type: 'disappear', x: 450, y: 350 }, // 1s sonra yok olan yol
      { type: 'ramp-up', x: 300, y: 480 },
      { type: 'finish', x: 400, y: 600 }
    ]
  }
};

function init() {
  canvas = document.getElementById('game-canvas');
  ctx = canvas.getContext('2d');
  
  engine = Engine.create();
  engine.gravity.y = 1.2;

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  setupEvents();
  updateMapDropdown();
  setMode('menu');

  // Fizik Adımı Döngüsü
  setInterval(() => {
    Engine.update(engine, 1000 / 60);
  }, 1000 / 60);

  requestAnimationFrame(drawLoop);
}

function setMode(mode) {
  currentMode = mode;
  document.getElementById('menu-ui').style.display = mode === 'menu' ? 'block' : 'none';
  document.getElementById('editor-ui').style.display = mode === 'editor' ? 'flex' : 'none';
  document.getElementById('palette-bar').style.display = mode === 'editor' ? 'flex' : 'none';
  document.getElementById('winner-ui').style.display = mode === 'winner' ? 'block' : 'none';

  clearWorld();
  cameraY = 0;

  if (mode === 'editor') {
    editorMapPieces = [];
  } else if (mode === 'menu') {
    loadSelectedMapToWorld();
  }
}

function clearWorld() {
  Composite.clear(engine.world, false);
  marbles = [];
}

function setupEvents() {
  // Palet Butonları
  document.querySelectorAll('.p-item').forEach(el => {
    el.onclick = () => {
      document.querySelectorAll('.p-item').forEach(i => i.classList.remove('selected'));
      el.classList.add('selected');
      selectedTileType = el.dataset.type;
    };
  });

  // KAMERA GEZİNME (Fare Orta Tuşu veya Sağ Tık / Kaydırma) VE PARÇA KOYMA
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 1 || e.button === 2) { // Orta veya Sağ Tık Kaydırır
      isDraggingCamera = true;
      lastMouseY = e.clientY;
      return;
    }

    if (currentMode !== 'editor') return;
    if (e.clientY < 80 || e.clientY > window.innerHeight - 80) return;

    // Dünya Koordinatına Dönüştür (Kamera Ofseti Dahil)
    const x = Math.round(e.clientX / 20) * 20;
    const y = Math.round((e.clientY + cameraY) / 20) * 20;

    if (selectedTileType === 'start') {
      startPoint = { x, y };
    } else {
      // Bitiş veya başka bir şey varsa eskisini kaldır (Tek Bitiş Olsun)
      if (selectedTileType === 'finish') {
        editorMapPieces = editorMapPieces.filter(p => p.type !== 'finish');
        const oldFinish = Composite.allBodies(engine.world).find(b => b.pieceType === 'finish');
        if (oldFinish) Composite.remove(engine.world, oldFinish);
      }

      editorMapPieces.push({ type: selectedTileType, x, y });
      createMapBody(selectedTileType, x, y);
    }
  });

  canvas.addEventListener('mousemove', (e) => {
    if (isDraggingCamera) {
      const deltaY = e.clientY - lastMouseY;
      cameraY -= deltaY; // YUKARI AŞAĞI KAYDIRMA
      lastMouseY = e.clientY;
    }
  });

  window.addEventListener('mouseup', () => isDraggingCamera = false);
  canvas.addEventListener('contextmenu', e => e.preventDefault()); // Sağ tık menüsünü engelle

  // Menü Aksiyonları
  document.getElementById('btn-open-editor').onclick = () => setMode('editor');
  document.getElementById('btn-to-menu').onclick = () => setMode('menu');
  document.getElementById('btn-menu-back').onclick = () => setMode('menu');
  document.getElementById('btn-clear').onclick = () => { clearWorld(); editorMapPieces = []; };
  document.getElementById('btn-save').onclick = saveMap;
  document.getElementById('btn-start').onclick = startRace;
  document.getElementById('btn-restart').onclick = startRace;

  document.getElementById('btn-add-marble').onclick = () => {
    const list = document.getElementById('marble-list');
    const div = document.createElement('div');
    div.className = 'm-row';
    div.innerHTML = `<input type="text" class="m-name" value="Misket ${list.children.length + 1}">
                     <label class="file-btn">🖼️ Resim <input type="file" class="m-img" accept="image/*"></label>`;
    list.appendChild(div);
  };
}

// HARİTA ELEMANLARI (1 Sn YOK OLAN YOL DAHİL)
function createMapBody(type, x, y) {
  let body;
  if (type === 'flat') {
    body = Bodies.rectangle(x, y, 160, 20, { isStatic: true, renderColor: '#3498db' });
  } else if (type === 'ramp-down') {
    body = Bodies.rectangle(x, y, 160, 20, { isStatic: true, angle: 0.35, renderColor: '#e67e22' });
  } else if (type === 'ramp-up') {
    body = Bodies.rectangle(x, y, 160, 20, { isStatic: true, angle: -0.35, renderColor: '#e67e22' });
  } else if (type === 'disappear') {
    // 1 SANİYE SONRA YOK OLAN PARÇA
    body = Bodies.rectangle(x, y, 140, 20, { isStatic: true, renderColor: '#e74c3c' });
    body.isDisappearing = false;
  } else if (type === 'finish') {
    body = Bodies.rectangle(x, y, 120, 15, { isStatic: true, isSensor: true, label: 'finish', renderColor: '#9b59b6' });
  }

  if (body) {
    body.pieceType = type;
    Composite.add(engine.world, body);
  }
}

function saveMap() {
  const name = document.getElementById('map-name').value || "Yeni Harita";
  savedMaps[name] = { start: startPoint, pieces: editorMapPieces };
  localStorage.setItem('m_maps_2d_v2', JSON.stringify(savedMaps));
  updateMapDropdown();
  alert("Harita Başarıyla Kaydedildi!");
  setMode('menu');
}

function updateMapDropdown() {
  const select = document.getElementById('map-select');
  select.innerHTML = '';
  Object.keys(savedMaps).forEach(m => {
    const opt = document.createElement('option');
    opt.value = m; opt.innerText = m;
    select.appendChild(opt);
  });
}

function loadSelectedMapToWorld() {
  clearWorld();
  const name = document.getElementById('map-select').value;
  const mapData = savedMaps[name] || { start: { x: 400, y: 100 }, pieces: [] };
  startPoint = mapData.start;
  mapData.pieces.forEach(p => createMapBody(p.type, p.x, p.y));
}

// YARIŞ VE ÇARPIŞMA KONTROLLERİ
async function startRace() {
  setMode('race');
  loadSelectedMapToWorld();

  const rows = document.querySelectorAll('.m-row');
  
  for (let i = 0; i < rows.length; i++) {
    const name = rows[i].querySelector('.m-name').value;
    const fileInput = rows[i].querySelector('.m-img');
    let imgObj = null;

    if (fileInput.files && fileInput.files[0]) {
      const url = URL.createObjectURL(fileInput.files[0]);
      imgObj = new Image();
      imgObj.src = url;
      await new Promise(r => imgObj.onload = r);
    }

    const radius = 16;
    // BİZİM BELİRLEDİĞİMİZ BAŞLANGIÇ NOKTASINDA DOĞ
    const body = Bodies.circle(startPoint.x + (i * 35 - 20), startPoint.y, radius, {
      restitution: 0.6,
      friction: 0.05
    });

    Composite.add(engine.world, body);
    marbles.push({ body, name, radius, img: imgObj, color: `hsl(${i * 120}, 80%, 50%)` });
  }

  // 1 SANİYE SONRA YOK OLMA VE BİTİŞ KONTROLÜ
  Events.on(engine, 'collisionStart', (e) => {
    if (currentMode !== 'race') return;
    e.pairs.forEach(pair => {
      const { bodyA, bodyB } = pair;

      // 1) Yok Olan Parça Mantığı
      [bodyA, bodyB].forEach(b => {
        if (b.pieceType === 'disappear' && !b.isDisappearing) {
          b.isDisappearing = true;
          b.renderColor = '#ff7675'; // Renk değiştir (uyarı)
          setTimeout(() => {
            Composite.remove(engine.world, b); // 1 saniye sonra yok et
          }, 1000);
        }
      });

      // 2) Bitiş Çizgisi Mantığı
      const isFinish = bodyA.label === 'finish' || bodyB.label === 'finish';
      if (isFinish) {
        const marbleBody = bodyA.label === 'finish' ? bodyB : bodyA;
        const winner = marbles.find(m => m.body === marbleBody);
        if (winner) {
          document.getElementById('winner-text').innerText = `🏆 KAZANAN: ${winner.name}!`;
          setMode('winner');
        }
      }
    });
  });
}

// CANVAS ÇİZİMİ
function drawLoop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  // KAMERA YUKARI/AŞAĞI OFSETİ
  ctx.translate(0, -cameraY);

  // 1. Başlangıç Noktası İkonu Çiz
  ctx.fillStyle = '#00e676';
  ctx.beginPath();
  ctx.arc(startPoint.x, startPoint.y, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#000';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText("🚀 BAŞLANGIÇ", startPoint.x, startPoint.y + 4);

  // 2. Harita Bloklarını Çiz
  const bodies = Composite.allBodies(engine.world);
  bodies.forEach(b => {
    if (b.label === 'Circle Body') return;

    ctx.save();
    ctx.translate(b.position.x, b.position.y);
    ctx.rotate(b.angle);

    if (b.label === 'finish') {
      ctx.fillStyle = '#9b59b6';
      ctx.fillRect(-60, -7.5, 120, 15);
      ctx.fillStyle = '#fff';
      ctx.fillText("🏁 BİTİŞ", 0, 4);
    } else {
      ctx.fillStyle = b.renderColor || '#3498db';
      ctx.fillRect(-70, -10, 140, 20);
    }
    ctx.restore();
  });

  // 3. Misketleri Çiz ve Lider Misketi Kamera İle Takip Et (Yarış Modunda)
  let leadingY = 0;
  marbles.forEach((m, idx) => {
    const { x, y } = m.body.position;

    if (y > leadingY) leadingY = y;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(m.body.angle);

    ctx.beginPath();
    ctx.arc(0, 0, m.radius, 0, Math.PI * 2);
    ctx.clip();

    if (m.img) {
      ctx.drawImage(m.img, -m.radius, -m.radius, m.radius * 2, m.radius * 2);
    } else {
      ctx.fillStyle = m.color;
      ctx.fill();
    }
    ctx.restore();

    ctx.fillStyle = '#fff';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(m.name, x, y - m.radius - 6);
  });

  // Yarış esnasında kamerayı otomatik en öndeki miskete odakla
  if (currentMode === 'race' && marbles.length > 0) {
    cameraY = leadingY - canvas.height / 2;
  }

  ctx.restore();
  requestAnimationFrame(drawLoop);
}

window.onload = init;
