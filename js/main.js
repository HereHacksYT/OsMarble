const { Engine, Bodies, Composite, Body, Events } = Matter;

let engine, canvas, ctx;
let currentMode = 'menu';
let selectedTileType = 'start';
let editorMapPieces = [];
let marbles = [];
let startPoint = { x: 400, y: 100 };

let enableSideWalls = true;
let leftWall, rightWall;

let cameraY = 0;
let isDraggingCamera = false;
let startDragY = 0;
let initialCameraY = 0;
let hasDragged = false;

let savedMaps = JSON.parse(localStorage.getItem('m_maps_2d_v6')) || {
  "Çılgın Parkur": {
    start: { x: 400, y: 80 },
    enableSideWalls: true,
    pieces: [
      { id: 1, type: 'flat', x: 400, y: 160, angle: 0 },
      { id: 2, type: 'ramp-down', x: 520, y: 280, angle: 0.35 },
      { id: 3, type: 'spinner', x: 400, y: 400, angle: 0 },
      { id: 4, type: 'lava', x: 400, y: 520, angle: 0 },
      { id: 5, type: 'ramp-up', x: 280, y: 640, angle: -0.35 },
      { id: 6, type: 'disappear', x: 400, y: 760, angle: 0 },
      { id: 7, type: 'finish', x: 400, y: 900, angle: 0 }
    ]
  }
};

function init() {
  canvas = document.getElementById('game-canvas');
  ctx = canvas.getContext('2d');
  
  engine = Engine.create();
  engine.gravity.y = 1.2;

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  setupEvents();
  setupCollisions();
  updateMapDropdown();
  setMode('menu');

  setInterval(() => {
    Engine.update(engine, 1000 / 60);

    Composite.allBodies(engine.world).forEach(b => {
      if (b.pieceType === 'spinner') {
        Body.setAngle(b, b.angle + 0.08);
      }
    });
  }, 1000 / 60);

  requestAnimationFrame(drawLoop);
}

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
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
    // Editör moduna geçerken seçili haritayı yükle
    const selectedName = document.getElementById('map-select').value;
    if (selectedName && savedMaps[selectedName]) {
      const mapData = savedMaps[selectedName];
      startPoint = { ...mapData.start };
      enableSideWalls = mapData.enableSideWalls !== undefined ? mapData.enableSideWalls : true;
      editorMapPieces = JSON.parse(JSON.stringify(mapData.pieces || []));
      
      editorMapPieces.forEach(p => {
        createMapBody(p.type, p.x, p.y, p.angle, p.id);
      });
    } else {
      editorMapPieces = [];
    }
  } else if (mode === 'menu') {
    loadSelectedMapToWorld();
  }
}

function clearWorld() {
  Composite.clear(engine.world, false);
  marbles = [];
  leftWall = null;
  rightWall = null;
}

function setupEvents() {
  document.querySelectorAll('.p-item').forEach(el => {
    el.onclick = () => {
      document.querySelectorAll('.p-item').forEach(i => i.classList.remove('selected'));
      el.classList.add('selected');
      selectedTileType = el.dataset.type;
    };
  });

  document.getElementById('btn-walls').onclick = () => {
    enableSideWalls = !enableSideWalls;
    const btn = document.getElementById('btn-walls');
    btn.innerText = `🧱 Yan Duvarlar: ${enableSideWalls ? 'AÇIK' : 'KAPALI'}`;
    btn.className = `btn ${enableSideWalls ? 'blue' : 'gray'}`;
  };

  canvas.addEventListener('pointerdown', (e) => {
    if (currentMode !== 'editor') return;
    isDraggingCamera = true;
    hasDragged = false;
    startDragY = e.clientY;
    initialCameraY = cameraY;
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!isDraggingCamera) return;
    const deltaY = e.clientY - startDragY;
    if (Math.abs(deltaY) > 5) {
      hasDragged = true;
      cameraY = initialCameraY - deltaY;
    }
  });

  canvas.addEventListener('pointerup', (e) => {
    if (currentMode !== 'editor') return;

    if (!hasDragged && e.clientY > 80 && e.clientY < window.innerHeight - 80) {
      const clickX = e.clientX;
      const clickY = e.clientY + cameraY;

      const allBodies = Composite.allBodies(engine.world);

      // 1) TEK TEK SİLME
      if (selectedTileType === 'eraser') {
        const found = allBodies.find(b => {
          if (!b.pieceType) return false;
          return Math.hypot(b.position.x - clickX, b.position.y - clickY) < 60;
        });

        if (found) {
          Composite.remove(engine.world, found);
          editorMapPieces = editorMapPieces.filter(p => p.id !== found.pieceId);
        }
        isDraggingCamera = false;
        return;
      }

      // 2) PARÇAYI DÖNDÜRME
      if (selectedTileType === 'rotate_tool') {
        const found = allBodies.find(b => {
          if (!b.pieceType) return false;
          return Math.hypot(b.position.x - clickX, b.position.y - clickY) < 60;
        });

        if (found) {
          const newAngle = found.angle + (Math.PI / 6); // 30 derece
          Body.setAngle(found, newAngle);
          
          const targetPiece = editorMapPieces.find(p => p.id === found.pieceId);
          if (targetPiece) targetPiece.angle = newAngle;
        }
        isDraggingCamera = false;
        return;
      }

      // 3) BAŞLANGIÇ VEYA YENİ PARÇA EKLE
      const snapX = Math.round(clickX / 20) * 20;
      const snapY = Math.round(clickY / 20) * 20;

      if (selectedTileType === 'start') {
        startPoint = { x: snapX, y: snapY };
      } else {
        if (selectedTileType === 'finish') {
          editorMapPieces = editorMapPieces.filter(p => p.type !== 'finish');
          const oldFinish = Composite.allBodies(engine.world).find(b => b.pieceType === 'finish');
          if (oldFinish) Composite.remove(engine.world, oldFinish);
        }

        const newId = Date.now() + Math.random();
        const initialAngle = selectedTileType === 'ramp-down' ? 0.35 : (selectedTileType === 'ramp-up' ? -0.35 : 0);

        editorMapPieces.push({ id: newId, type: selectedTileType, x: snapX, y: snapY, angle: initialAngle });
        createMapBody(selectedTileType, snapX, snapY, initialAngle, newId);
      }
    }

    isDraggingCamera = false;
  });

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

function createMapBody(type, x, y, angle = 0, id = Date.now()) {
  let body;
  if (type === 'flat') {
    body = Bodies.rectangle(x, y, 160, 20, { isStatic: true, angle, renderColor: '#3498db' });
  } else if (type === 'ramp-down') {
    body = Bodies.rectangle(x, y, 160, 20, { isStatic: true, angle: angle || 0.35, renderColor: '#e67e22' });
  } else if (type === 'ramp-up') {
    body = Bodies.rectangle(x, y, 160, 20, { isStatic: true, angle: angle || -0.35, renderColor: '#e67e22' });
  } else if (type === 'spinner') {
    body = Bodies.rectangle(x, y, 180, 18, { isStatic: true, renderColor: '#f1c40f' });
  } else if (type === 'lava') {
    body = Bodies.rectangle(x, y, 160, 20, { isStatic: true, angle, renderColor: '#d32f2f', label: 'lava' });
  } else if (type === 'disappear') {
    body = Bodies.rectangle(x, y, 140, 20, { isStatic: true, angle, renderColor: '#e74c3c' });
    body.isDisappearing = false;
  } else if (type === 'finish') {
    body = Bodies.rectangle(x, y, 120, 15, { isStatic: true, angle, isSensor: true, label: 'finish', renderColor: '#9b59b6' });
  }

  if (body) {
    body.pieceType = type;
    body.pieceId = id;
    Composite.add(engine.world, body);
  }
}

function setupSideWalls(maxY) {
  if (!enableSideWalls) return;
  const wallHeight = maxY + 1200;
  leftWall = Bodies.rectangle(10, wallHeight / 2, 20, wallHeight, { isStatic: true, renderColor: '#34495e' });
  rightWall = Bodies.rectangle(canvas.width - 10, wallHeight / 2, 20, wallHeight, { isStatic: true, renderColor: '#34495e' });
  Composite.add(engine.world, [leftWall, rightWall]);
}

function saveMap() {
  const name = document.getElementById('map-name').value || "Yeni Harita";
  savedMaps[name] = { start: startPoint, pieces: editorMapPieces, enableSideWalls };
  localStorage.setItem('m_maps_2d_v6', JSON.stringify(savedMaps));
  updateMapDropdown();
  alert("Harita Başarıyla Kaydedildi!");
  setMode('menu');
}

function updateMapDropdown() {
  const select = document.getElementById('map-select');
  select.innerHTML = '';
  Object.keys(savedMaps).forEach(m => {
    const opt = document.createElement('option');
    opt.value = m; 
    opt.innerText = m;
    select.appendChild(opt);
  });
}

function loadSelectedMapToWorld() {
  clearWorld();
  const name = document.getElementById('map-select').value;
  const mapData = savedMaps[name] || { start: { x: 400, y: 100 }, pieces: [], enableSideWalls: true };
  startPoint = { ...mapData.start };
  enableSideWalls = mapData.enableSideWalls !== undefined ? mapData.enableSideWalls : true;

  let maxPieceY = 1000;
  (mapData.pieces || []).forEach(p => {
    createMapBody(p.type, p.x, p.y, p.angle || 0, p.id || Date.now());
    if (p.y > maxPieceY) maxPieceY = p.y;
  });

  setupSideWalls(maxPieceY);
}

function setupCollisions() {
  Events.on(engine, 'collisionStart', (e) => {
    if (currentMode !== 'race') return;
    e.pairs.forEach(pair => {
      const { bodyA, bodyB } = pair;

      // 🔥 LAVA TEMASI
      const isLava = bodyA.label === 'lava' || bodyB.label === 'lava';
      if (isLava) {
        const marbleBody = bodyA.label === 'lava' ? bodyB : bodyA;
        if (marbleBody.label === 'Circle Body') {
          Body.setPosition(marbleBody, { x: startPoint.x + (Math.random() * 20 - 10), y: startPoint.y });
          Body.setVelocity(marbleBody, { x: 0, y: 0 });
        }
      }

      // ⏱️ YOK OLAN PARÇA
      [bodyA, bodyB].forEach(b => {
        if (b.pieceType === 'disappear' && !b.isDisappearing) {
          b.isDisappearing = true;
          b.renderColor = '#ff7675';
          setTimeout(() => Composite.remove(engine.world, b), 1000);
        }
      });

      // 🏁 BİTİŞ KONTROLÜ
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

async function startRace() {
  setMode('race');
  loadSelectedMapToWorld();

  const rows = document.querySelectorAll('.m-row');
  
  for (let i = 0; i < rows.length; i++) {
    const name = rows[i].querySelector('.m-name').value || `Misket ${i + 1}`;
    const fileInput = rows[i].querySelector('.m-img');
    let imgObj = null;

    if (fileInput.files && fileInput.files[0]) {
      const url = URL.createObjectURL(fileInput.files[0]);
      imgObj = new Image();
      imgObj.src = url;
      await new Promise(r => imgObj.onload = r);
    }

    const radius = 16;
    const body = Bodies.circle(startPoint.x + (i * 30 - 15), startPoint.y, radius, {
      restitution: 0.7,
      friction: 0.05
    });

    Composite.add(engine.world, body);
    marbles.push({ body, name, radius, img: imgObj, color: `hsl(${i * 120}, 80%, 50%)` });
  }
}

function drawLoop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(0, -cameraY);

  let lowestY = startPoint.y + 300;
  Composite.allBodies(engine.world).forEach(b => {
    if (b.pieceType && b.pieceType !== 'start' && b.position.y > lowestY) {
      lowestY = b.position.y;
    }
  });
  const deathY = lowestY + 250;

  // DÜŞME ÇİZGİSİ
  ctx.fillStyle = 'rgba(255, 76, 76, 0.35)';
  ctx.fillRect(0, deathY, canvas.width, 400);
  ctx.strokeStyle = '#ff1744';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, deathY);
  ctx.lineTo(canvas.width, deathY);
  ctx.stroke();
  ctx.fillStyle = '#ff1744';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText("🔥 TEHLİKE - DÜŞEN BAŞTAN BAŞLAR 🔥", canvas.width / 2, deathY + 25);

  // BAŞLANGIÇ NOKTASI
  ctx.fillStyle = '#00e676';
  ctx.beginPath();
  ctx.arc(startPoint.x, startPoint.y, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#000';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText("🚀 BAŞLANGIÇ", startPoint.x, startPoint.y + 4);

  // BLOKLARI ÇİZ
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
      const width = b.pieceType === 'spinner' ? 180 : 140;
      ctx.fillRect(-width/2, -10, width, 20);
      
      if (b.pieceType === 'lava') {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText("🔥 YANMA", 0, 3);
      }
    }
    ctx.restore();
  });

  // MİSKETLERİ ÇİZ
  let leadingY = 0;
  marbles.forEach((m) => {
    const { x, y } = m.body.position;

    if (y >= deathY) {
      Body.setPosition(m.body, { x: startPoint.x + (Math.random() * 20 - 10), y: startPoint.y });
      Body.setVelocity(m.body, { x: 0, y: 0 });
    }

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

  // YARIŞTA KAMERA TAKİBİ
  if (currentMode === 'race' && marbles.length > 0) {
    cameraY = leadingY - canvas.height / 2;
  }

  ctx.restore();
  requestAnimationFrame(drawLoop);
}

window.onload = init;
