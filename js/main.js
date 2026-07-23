const { Engine, Bodies, Composite, Body, Events } = Matter;

let engine, canvas, ctx;
let currentMode = 'menu';
let selectedTileType = 'start';
let editorMapPieces = [];
let marbles = [];
let startPoint = { x: 400, y: 100 };

let currentAngle = 0;
let enableSideWalls = true;
let leftWall, rightWall;

let cameraY = 0;
let isDraggingCamera = false;
let startDragY = 0;
let initialCameraY = 0;
let hasDragged = false;

let savedMaps = JSON.parse(localStorage.getItem('m_maps_2d_v4')) || {
  "Çılgın Parkur": {
    start: { x: 400, y: 80 },
    enableSideWalls: true,
    pieces: [
      { type: 'flat', x: 400, y: 160, angle: 0 },
      { type: 'spinner', x: 400, y: 320, angle: 0 },
      { type: 'flat', x: 500, y: 450, angle: 0.4 },
      { type: 'disappear', x: 350, y: 600, angle: 0 },
      { type: 'flat', x: 250, y: 720, angle: -0.4 },
      { type: 'finish', x: 400, y: 880, angle: 0 }
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

  document.getElementById('btn-rotate').onclick = () => {
    let deg = Math.round(currentAngle * (180 / Math.PI));
    deg = (deg + 15) > 60 ? -60 : (deg + 15);
    currentAngle = deg * (Math.PI / 180);
    document.getElementById('angle-text').innerText = `${deg}°`;
  };

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
      const x = Math.round(e.clientX / 20) * 20;
      const y = Math.round((e.clientY + cameraY) / 20) * 20;

      if (selectedTileType === 'eraser') {
        const clickedBody = Matter.Query.point(Composite.allBodies(engine.world), { x, y })[0];
        if (clickedBody && clickedBody.pieceType) {
          Composite.remove(engine.world, clickedBody);
          editorMapPieces = editorMapPieces.filter(p => !(Math.abs(p.x - clickedBody.position.x) < 10 && Math.abs(p.y - clickedBody.position.y) < 10));
        }
        isDraggingCamera = false;
        return;
      }

      if (selectedTileType === 'start') {
        startPoint = { x, y };
      } else {
        if (selectedTileType === 'finish') {
          editorMapPieces = editorMapPieces.filter(p => p.type !== 'finish');
          const oldFinish = Composite.allBodies(engine.world).find(b => b.pieceType === 'finish');
          if (oldFinish) Composite.remove(engine.world, oldFinish);
        }

        editorMapPieces.push({ type: selectedTileType, x, y, angle: currentAngle });
        createMapBody(selectedTileType, x, y, currentAngle);
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

function createMapBody(type, x, y, angle = 0) {
  let body;
  if (type === 'flat') {
    body = Bodies.rectangle(x, y, 160, 20, { isStatic: true, angle, renderColor: '#3498db' });
  } else if (type === 'spinner') {
    body = Bodies.rectangle(x, y, 180, 18, { isStatic: true, renderColor: '#f1c40f' });
  } else if (type === 'disappear') {
    body = Bodies.rectangle(x, y, 140, 20, { isStatic: true, angle, renderColor: '#e74c3c' });
    body.isDisappearing = false;
  } else if (type === 'finish') {
    body = Bodies.rectangle(x, y, 120, 15, { isStatic: true, angle, isSensor: true, label: 'finish', renderColor: '#9b59b6' });
  }

  if (body) {
    body.pieceType = type;
    Composite.add(engine.world, body);
  }
}

function setupSideWalls(maxY) {
  if (!enableSideWalls) return;
  const wallHeight = maxY + 1000;
  leftWall = Bodies.rectangle(10, wallHeight / 2, 20, wallHeight, { isStatic: true, renderColor: '#34495e' });
  rightWall = Bodies.rectangle(canvas.width - 10, wallHeight / 2, 20, wallHeight, { isStatic: true, renderColor: '#34495e' });
  Composite.add(engine.world, [leftWall, rightWall]);
}

function saveMap() {
  const name = document.getElementById('map-name').value || "Yeni Harita";
  savedMaps[name] = { start: startPoint, pieces: editorMapPieces, enableSideWalls };
  localStorage.setItem('m_maps_2d_v4', JSON.stringify(savedMaps));
  updateMapDropdown();
  alert("Harita Kaydedildi!");
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
  const mapData = savedMaps[name] || { start: { x: 400, y: 100 }, pieces: [], enableSideWalls: true };
  startPoint = mapData.start;
  enableSideWalls = mapData.enableSideWalls !== undefined ? mapData.enableSideWalls : true;

  let maxPieceY = 1000;
  mapData.pieces.forEach(p => {
    createMapBody(p.type, p.x, p.y, p.angle || 0);
    if (p.y > maxPieceY) maxPieceY = p.y;
  });

  setupSideWalls(maxPieceY);
}

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
    const body = Bodies.circle(startPoint.x + (i * 30 - 15), startPoint.y, radius, {
      restitution: 0.7,
      friction: 0.05
    });

    Composite.add(engine.world, body);
    marbles.push({ body, name, radius, img: imgObj, color: `hsl(${i * 120}, 80%, 50%)` });
  }

  Events.on(engine, 'collisionStart', (e) => {
    if (currentMode !== 'race') return;
    e.pairs.forEach(pair => {
      const { bodyA, bodyB } = pair;

      [bodyA, bodyB].forEach(b => {
        if (b.pieceType === 'disappear' && !b.isDisappearing) {
          b.isDisappearing = true;
          b.renderColor = '#ff7675';
          setTimeout(() => Composite.remove(engine.world, b), 1000);
        }
      });

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

  ctx.fillStyle = '#00e676';
  ctx.beginPath();
  ctx.arc(startPoint.x, startPoint.y, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#000';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText("🚀 BAŞLANGIÇ", startPoint.x, startPoint.y + 4);

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
    }
    ctx.restore();
  });

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

  if (currentMode === 'race' && marbles.length > 0) {
    cameraY = leadingY - canvas.height / 2;
  }

  ctx.restore();
  requestAnimationFrame(drawLoop);
}

window.onload = init;
