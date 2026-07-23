let canvas, ctx;
let currentMode = 'menu';
let selectedTileType = 'start';
let mapPieces = [];
let marbles = [];
let startPoint = { x: 200, y: 100 };
let cameraY = 0;

let savedMaps = JSON.parse(localStorage.getItem('osmarble_v3')) || {
  "Örnek Parkur": {
    start: { x: 200, y: 80 },
    pieces: [
      { type: 'flat', x: 200, y: 150 },
      { type: 'ramp-down', x: 280, y: 250 },
      { type: 'ramp-up', x: 120, y: 380 },
      { type: 'flat', x: 200, y: 500 },
      { type: 'finish', x: 200, y: 620 }
    ]
  }
};

window.addEventListener('DOMContentLoaded', () => {
  canvas = document.getElementById('game-canvas');
  ctx = canvas.getContext('2d');

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.onresize = resize;

  // EVENT LISTENERS
  document.getElementById('btn-open-editor').onclick = () => setMode('editor');
  document.getElementById('btn-to-menu').onclick = () => setMode('menu');
  document.getElementById('btn-menu-back').onclick = () => setMode('menu');
  document.getElementById('btn-clear').onclick = () => { mapPieces = []; };
  document.getElementById('btn-save').onclick = saveMap;
  document.getElementById('btn-start').onclick = startRace;
  document.getElementById('btn-restart').onclick = startRace;

  document.getElementById('btn-add-marble').onclick = () => {
    let list = document.getElementById('marble-list');
    let div = document.createElement('div');
    div.className = 'm-row';
    div.innerHTML = `<input type="text" class="m-name" value="Misket ${list.children.length + 1}">`;
    list.appendChild(div);
  };

  let items = document.querySelectorAll('.p-item');
  items.forEach(el => {
    el.onclick = () => {
      items.forEach(i => i.classList.remove('selected'));
      el.classList.add('selected');
      selectedTileType = el.dataset.type;
    };
  });

  // CANVAS TIKLAMA
  canvas.onclick = (e) => {
    if (currentMode !== 'editor') return;
    let x = e.clientX;
    let y = e.clientY + cameraY;

    if (selectedTileType === 'eraser') {
      mapPieces = mapPieces.filter(p => Math.hypot(p.x - x, p.y - y) > 40);
      return;
    }

    if (selectedTileType === 'start') {
      startPoint = { x, y };
    } else {
      mapPieces.push({ type: selectedTileType, x, y });
    }
  };

  updateMapDropdown();
  setMode('menu');
  requestAnimationFrame(gameLoop);
});

function setMode(mode) {
  currentMode = mode;
  document.getElementById('menu-ui').style.display = mode === 'menu' ? 'block' : 'none';
  document.getElementById('editor-ui').style.display = mode === 'editor' ? 'flex' : 'none';
  document.getElementById('palette-bar').style.display = mode === 'editor' ? 'flex' : 'none';
  document.getElementById('winner-ui').style.display = mode === 'winner' ? 'block' : 'none';

  cameraY = 0;
  if (mode === 'editor') {
    let name = document.getElementById('map-select').value;
    if (savedMaps[name]) {
      startPoint = { ...savedMaps[name].start };
      mapPieces = [...savedMaps[name].pieces];
    }
  }
}

function saveMap() {
  let name = document.getElementById('map-name').value || "Harita";
  savedMaps[name] = { start: startPoint, pieces: mapPieces };
  localStorage.setItem('osmarble_v3', JSON.stringify(savedMaps));
  updateMapDropdown();
  alert("Harita Kaydedildi!");
  setMode('menu');
}

function updateMapDropdown() {
  let select = document.getElementById('map-select');
  select.innerHTML = '';
  Object.keys(savedMaps).forEach(m => {
    let opt = document.createElement('option');
    opt.value = m;
    opt.innerText = m;
    select.appendChild(opt);
  });
}

function startRace() {
  let name = document.getElementById('map-select').value;
  let map = savedMaps[name] || Object.values(savedMaps)[0];
  startPoint = { ...map.start };
  mapPieces = [...map.pieces];

  marbles = [];
  let rows = document.querySelectorAll('.m-name');
  rows.forEach((input, i) => {
    marbles.push({
      name: input.value || `Misket ${i+1}`,
      x: startPoint.x + (i * 20 - 10),
      y: startPoint.y,
      vx: (Math.random() - 0.5) * 2,
      vy: 0,
      radius: 12,
      color: `hsl(${i * 130 + 40}, 80%, 50%)`
    });
  });

  setMode('race');
}

function gameLoop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(0, -cameraY);

  // BAŞLANGIÇ NOKTASI
  ctx.fillStyle = '#00e676';
  ctx.beginPath();
  ctx.arc(startPoint.x, startPoint.y, 16, 0, Math.PI * 2);
  ctx.fill();

  // PARÇALAR
  mapPieces.forEach(p => {
    ctx.fillStyle = p.type === 'finish' ? '#9b59b6' : '#3498db';
    if (p.type === 'flat') ctx.fillRect(p.x - 70, p.y - 8, 140, 16);
    else if (p.type === 'ramp-down') {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(0.35);
      ctx.fillRect(-70, -8, 140, 16); ctx.restore();
    } else if (p.type === 'ramp-up') {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(-0.35);
      ctx.fillRect(-70, -8, 140, 16); ctx.restore();
    } else if (p.type === 'finish') {
      ctx.fillRect(p.x - 60, p.y - 6, 120, 12);
    }
  });

  // MİSKETLER
  let maxY = 0;
  if (currentMode === 'race') {
    marbles.forEach(m => {
      m.vy += 0.25;
      m.x += m.vx;
      m.y += m.vy;

      if (m.y > maxY) maxY = m.y;

      if (m.x < 15) { m.x = 15; m.vx *= -0.6; }
      if (m.x > canvas.width - 15) { m.x = canvas.width - 15; m.vx *= -0.6; }

      mapPieces.forEach(p => {
        if (p.type === 'flat' && Math.abs(m.x - p.x) < 70 && Math.abs(m.y - p.y) < 20 && m.vy > 0) {
          m.y = p.y - 12;
          m.vy = -m.vy * 0.4;
          m.vx += (Math.random() - 0.5) * 0.5;
        } else if (p.type === 'ramp-down' && Math.abs(m.x - p.x) < 70 && Math.abs(m.y - p.y) < 30) {
          m.vy *= 0.8;
          m.vx += 0.3;
        } else if (p.type === 'ramp-up' && Math.abs(m.x - p.x) < 70 && Math.abs(m.y - p.y) < 30) {
          m.vy *= 0.8;
          m.vx -= 0.3;
        } else if (p.type === 'finish' && Math.abs(m.x - p.x) < 60 && Math.abs(m.y - p.y) < 20) {
          document.getElementById('winner-text').innerText = `🏆 KAZANAN: ${m.name}!`;
          setMode('winner');
        }
      });

      ctx.fillStyle = m.color;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fff';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(m.name, m.x, m.y - 16);
    });

    cameraY = maxY - canvas.height / 2;
    if (cameraY < 0) cameraY = 0;
  }

  ctx.restore();
  requestAnimationFrame(gameLoop);
}
