let scene, camera, renderer, world;
let mapObjects = [], marbles = [];
let isEditing = false, isRacing = false;
let draggedType = null;

// Kayıtlı Haritalar (LocalStorage + Varsayılan)
let savedMaps = JSON.parse(localStorage.getItem('my_marble_maps')) || {
  "Varsayılan Rampa": [
    { type: "flat", pos: [0, 8, 0], rot: [0,0,0] },
    { type: "ramp", pos: [0, 4, 8], rot: [0.3,0,0] },
    { type: "finish", pos: [0, -1, 18], rot: [0,0,0] }
  ]
};

let currentMapData = [];

function init() {
  // THREE.JS SAHNESİ
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0b10);

  camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 15, 30);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const light = new THREE.DirectionalLight(0xffffff, 0.8);
  light.position.set(20, 40, 20);
  scene.add(light);

  // CANNON.JS FİZİK
  world = new CANNON.World();
  world.gravity.set(0, -12, 0);

  setupUIEvents();
  updateMapSelectOptions();
  animate();
}

// DRAG & DROP HARİTA TASARIMI
function setupUIEvents() {
  document.querySelectorAll('.palette-item').forEach(el => {
    el.addEventListener('dragstart', (e) => draggedType = e.target.dataset.type);
  });

  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    if (!isEditing || !draggedType) return;

    // Farenin 3D Dünyadaki Karşılığını Hesapla
    const vec = new THREE.Vector3(
      (e.clientX / window.innerWidth) * 2 - 1,
      -(e.clientY / window.innerHeight) * 2 + 1,
      0.5
    );
    vec.unproject(camera);
    const dir = vec.sub(camera.position).normalize();
    const distance = -camera.position.y / dir.y;
    const pos = camera.position.clone().add(dir.multiplyScalar(distance));

    // Parça Ekle
    const newPiece = { type: draggedType, pos: [Math.round(pos.x), Math.round(pos.y), Math.round(pos.z)], rot: [draggedType === 'ramp' ? 0.3 : 0, 0, 0] };
    currentMapData.push(newPiece);
    renderPiece(newPiece);
  });

  // MENÜ BUTONLARI
  document.getElementById('btn-open-editor').onclick = () => setMode('editor');
  document.getElementById('btn-go-menu').onclick = () => setMode('menu');
  document.getElementById('btn-save-map').onclick = saveCurrentMap;
  document.getElementById('btn-start-race').onclick = startRace;
  document.getElementById('btn-restart').onclick = startRace;
  document.getElementById('btn-back-menu').onclick = () => setMode('menu');

  // MİSKET GİRDİSİ EKLEME
  document.getElementById('btn-add-marble-input').onclick = () => {
    const container = document.getElementById('marble-inputs');
    const count = container.children.length + 1;
    const div = document.createElement('div');
    div.className = 'marble-row';
    div.innerHTML = `<input type="text" class="m-name" value="Misket ${count}"><label class="file-label">🖼️ Fotoğraf Seç <input type="file" class="m-img" accept="image/*"></label>`;
    container.appendChild(div);
  };
}

// SAHNEYE PARÇA ÇİZME
function renderPiece(p) {
  let geo = new THREE.BoxGeometry(6, 0.5, 8);
  let color = p.type === 'flat' ? 0x3498db : (p.type === 'ramp' ? 0xe67e22 : 0xe74c3c);
  if(p.type === 'finish') geo = new THREE.BoxGeometry(8, 0.2, 3);

  const mat = new THREE.MeshStandardMaterial({ color });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(...p.pos);
  mesh.rotation.set(...p.rot);
  scene.add(mesh);

  const shape = new CANNON.Box(new CANNON.Vec3(geo.parameters.width/2, geo.parameters.height/2, geo.parameters.depth/2));
  const body = new CANNON.Body({ mass: 0 });
  body.addShape(shape);
  body.position.set(...p.pos);
  body.quaternion.setFromEuler(...p.rot);
  world.addBody(body);

  mapObjects.push({ mesh, body, type: p.type });
}

// MODLAR ARASI GEÇİŞ
function setMode(mode) {
  isEditing = (mode === 'editor');
  isRacing = (mode === 'race');

  document.getElementById('menu-ui').style.display = mode === 'menu' ? 'block' : 'none';
  document.getElementById('editor-ui').style.display = isEditing ? 'block' : 'none';
  document.getElementById('palette-bar').style.display = isEditing ? 'flex' : 'none';
  document.getElementById('winner-modal').style.display = mode === 'winner' ? 'block' : 'none';

  clearScene();

  if (isEditing) {
    currentMapData = [];
    camera.position.set(0, 20, 25);
    camera.lookAt(0, 0, 0);
  } else if (mode === 'menu') {
    loadSelectedMap();
  }
}

function clearScene() {
  mapObjects.forEach(o => { scene.remove(o.mesh); world.remove(o.body); });
  marbles.forEach(m => { scene.remove(m.mesh); world.remove(m.body); });
  mapObjects = []; marbles = [];
}

function loadSelectedMap() {
  clearScene();
  const selectedName = document.getElementById('map-select').value;
  currentMapData = savedMaps[selectedName] || [];
  currentMapData.forEach(p => renderPiece(p));
}

function saveCurrentMap() {
  const name = document.getElementById('map-name-input').value || "Isimsiz Harita";
  savedMaps[name] = currentMapData;
  localStorage.setItem('my_marble_maps', JSON.stringify(savedMaps));
  updateMapSelectOptions();
  alert("Harita Kaydedildi!");
  setMode('menu');
}

function updateMapSelectOptions() {
  const select = document.getElementById('map-select');
  select.innerHTML = '';
  Object.keys(savedMaps).forEach(name => {
    const opt = document.createElement('option');
    opt.value = name; opt.innerText = name;
    select.appendChild(opt);
  });
}

// YARIŞI BAŞLAT VE MİSKETLERE FOTOĞRAF KAPLA
async function startRace() {
  setMode('race');
  loadSelectedMap();

  const rows = document.querySelectorAll('.marble-row');
  const textureLoader = new THREE.TextureLoader();

  for (let i = 0; i < rows.length; i++) {
    const name = rows[i].querySelector('.m-name').value;
    const fileInput = rows[i].querySelector('.m-img');

    let mat = new THREE.MeshStandardMaterial({ color: Math.random() * 0xffffff });

    // Fotoğraf Seçilmişse Dokuyu Kapla
    if (fileInput.files && fileInput.files[0]) {
      const url = URL.createObjectURL(fileInput.files[0]);
      const texture = await new Promise(resolve => textureLoader.load(url, resolve));
      mat = new THREE.MeshStandardMaterial({ map: texture });
    }

    // Visual
    const geo = new THREE.SphereGeometry(0.8, 32, 32);
    const mesh = new THREE.Mesh(geo, mat);
    scene.add(mesh);

    // Physics
    const shape = new CANNON.Sphere(0.8);
    const body = new CANNON.Body({ mass: 2 });
    body.addShape(shape);
    body.position.set((i - rows.length / 2) * 2, 12, 0); // Başlangıç Yan Yana
    world.addBody(body);

    marbles.push({ mesh, body, name });
  }
}

// OYUN DÖNGÜSÜ
function animate() {
  requestAnimationFrame(animate);
  world.step(1 / 60);

  if (isRacing) {
    let leader = null;
    let maxZ = -999;

    marbles.forEach(m => {
      m.mesh.position.copy(m.body.position);
      m.mesh.quaternion.copy(m.body.quaternion);

      // En Öndeki Misketi Bul (Kamera Takibi İçin)
      if (m.mesh.position.z > maxZ) {
        maxZ = m.mesh.position.z;
        leader = m;
      }

      // Bitiş Çizgisine Ulaştı mı?
      mapObjects.filter(o => o.type === 'finish').forEach(f => {
        if (m.mesh.position.distanceTo(f.mesh.position) < 2.5) {
          isRacing = false;
          document.getElementById('winner-title').innerText = `🏆 KAZANAN: ${m.name}!`;
          setMode('winner');
        }
      });
    });

    // Kamerayı Lider Miskete Odakla
    if (leader) {
      camera.position.lerp(new THREE.Vector3(leader.mesh.position.x, leader.mesh.position.y + 6, leader.mesh.position.z - 10), 0.1);
      camera.lookAt(leader.mesh.position);
    }
  }

  renderer.render(scene, camera);
}

window.onload = init;
