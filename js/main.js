const { Engine, Render, Runner, Bodies, Composite, Body, Events } = Matter;

let engine, runner, canvas;
let currentMode = 'menu'; // 'menu', 'editor', 'race', 'winner'
let selectedTileType = 'flat';
let editorMapPieces = [];
let marbles = [];
let loadedImages = {};

// Kayıtlı Haritalar (LocalStorage)
let savedMaps = JSON.parse(localStorage.getItem('m_maps_2d')) || {
  "Varsayılan Harita": [
    { type: 'flat', x: 200, y: 200 },
    { type: 'ramp-down', x: 400, y: 250 },
    { type: 'flat', x: 600, y: 350 },
    { type: 'finish', x: 750, y: 380 }
  ]
};

function init() {
  canvas = document.getElementById('game-canvas');
  
  // Matter.js Fizik Motoru
  engine = Engine.create();
  engine.gravity.y = 1.2; // Yerçekimi

  // Canvas Boyutu
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  setupEvents();
  updateMapDropdown();
  setMode('menu');

  // Oyun / Fizik Döngüsü
  runner = Runner.create();
  Runner.run(runner, engine);

  // Özel Canvas Çizim Döngüsü (2D Render)
  requestAnimationFrame(drawLoop);
}

// MOD GEÇİŞLERİ
function setMode(mode) {
  currentMode = mode;
  document.getElementById('menu-ui').style.display = mode === 'menu' ? 'block' : 'none';
  document.getElementById('editor-ui').style.display = mode === 'editor' ? 'flex' : 'none';
  document.getElementById('palette-bar').style.display = mode === 'editor' ? 'flex' : 'none';
  document.getElementById('winner-ui').style.display = mode === 'winner' ? 'block' : 'none';

  clearWorld();

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

// TIKLAYARAK PARÇA KOYMA (Editör)
function setupEvents() {
  // Palet Seçimi
  document.querySelectorAll('.p-item').forEach(el => {
    el.onclick = () => {
      document.querySelectorAll('.p-item').forEach(i => i.classList.remove('selected'));
      el.classList.add('selected');
      selectedTileType = el.dataset.type;
    };
  });

  // Ekrana Tıklayınca Parça Koy
  canvas.addEventListener('pointerdown', (e) => {
    if (currentMode !== 'editor') return;
    
    // UI üstüne basıldıysa işlem yapma
    if (e.clientY < 80 || e.clientY > window.innerHeight - 80) return;

    const x = Math.round(e.clientX / 20) * 20; // Izgaraya oturt (Grid Snap)
    const y = Math.round(e.clientY / 20) * 20;

    editorMapPieces.push({ type: selectedTileType, x, y });
    createMapBody(selectedTileType, x, y);
  });

  // Menü Butonları
  document.getElementById('btn-open-editor').onclick = () => setMode('editor');
  document.getElementById('btn-to-menu').onclick = () => setMode('menu');
  document.getElementById('btn-menu-back').onclick = () => setMode('menu');
  document.getElementById('btn-clear').onclick = () => { clearWorld(); editorMapPieces = []; };
  document.getElementById('btn-save').onclick = saveMap;
  document.getElementById('btn-start').onclick = startRace;
  document.getElementById('btn-restart').onclick = startRace;

  // Misket Ekleme
  document.getElementById('btn-add-marble').onclick = () => {
    const list = document.getElementById('marble-list');
    const div = document.createElement('div');
    div.className = 'm-row';
    div.innerHTML = `<input type="text" class="m-name" value="Misket ${list.children.length + 1}">
                     <label class="file-btn">🖼️ Resim <input type="file" class="m-img" accept="image/*"></label>`;
    list.appendChild(div);
  };
}

// HARİTA PARÇASI OLUŞTURMA
function createMapBody(type, x, y) {
  let body;
  if (type === 'flat') {
    body = Bodies.rectangle(x, y, 160, 20, { isStatic: true, render: { fillStyle: '#3498db' } });
  } else if (type === 'ramp-down') {
    body = Bodies.rectangle(x, y, 160, 20, { isStatic: true, angle: 0.35, render: { fillStyle: '#e67e22' } });
  } else if (type === 'ramp-up') {
    body = Bodies.rectangle(x, y, 160, 20, { isStatic: true, angle: -0.35, render: { fillStyle: '#e67e22' } });
  } else if (type === 'finish') {
    body = Bodies.rectangle(x, y, 120, 15, { isStatic: true, isSensor: true, label: 'finish', render: { fillStyle: '#e74c3c' } });
  }
  
  if (body) {
    body.pieceType = type;
    Composite.add(engine.world, body);
  }
}

function saveMap() {
  const name = document.getElementById('map-name').value || "Yeni Harita";
  savedMaps[name] = editorMapPieces;
  localStorage.setItem('m_maps_2d', JSON.stringify(savedMaps));
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
  const pieces = savedMaps[name] || [];
  pieces.forEach(p => createMapBody(p.type, p.x, p.y));
}

// YARIŞI BAŞLAT VE MİSKET RESİMLERİNİ DÜZENLE
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

    // 2D Yuvarlak Misket Gövdesi
    const radius = 18;
    const x = 100 + (i * 45);
    const y = 50;

    const body = Bodies.circle(x, y, radius, {
      restitution: 0.7, // Zıplama
      friction: 0.05,
      density: 0.002
    });

    Composite.add(engine.world, body);
    marbles.push({ body, name, radius, img: imgObj, color: `hsl(${i * 90}, 80%, 50%)` });
  }

  // Bitiş Kontrolü
  Events.on(engine, 'collisionStart', (e) => {
    if (currentMode !== 'race') return;
    e.pairs.forEach(pair => {
      const { bodyA, bodyB } = pair;
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

// 2D ÖZEL CANVAS ÇİZİMİ
function drawLoop() {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 1. Harita Elemanlarını Çiz
  const bodies = Composite.allBodies(engine.world);
  bodies.forEach(b => {
    if (b.label === 'Circle Body') return; // Misketleri ayrıca çizeceğiz

    ctx.save();
    ctx.translate(b.position.x, b.position.y);
    ctx.rotate(b.angle);

    if (b.label === 'finish') {
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(-60, -7.5, 120, 15);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText("FINISH", -18, 4);
    } else {
      ctx.fillStyle = b.render.fillStyle || '#3498db';
      ctx.fillRect(-80, -10, 160, 20);
    }
    ctx.restore();
  });

  // 2. Misketleri Resim veya Renk İle Çiz
  marbles.forEach(m => {
    const { x, y } = m.body.position;
    const angle = m.body.angle;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    // Yuvarlak Kırpma (Maske)
    ctx.beginPath();
    ctx.arc(0, 0, m.radius, 0, Math.PI * 2);
    ctx.clip();

    if (m.img) {
      ctx.drawImage(m.img, -m.radius, -m.radius, m.radius * 2, m.radius * 2);
    } else {
      ctx.fillStyle = m.color;
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    ctx.restore();

    // Üstüne İsim Yaz
    ctx.fillStyle = '#fff';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(m.name, x, y - m.radius - 6);
  });

  requestAnimationFrame(drawLoop);
}

window.onload = init;
