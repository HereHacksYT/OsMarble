let scene, camera, renderer, world;
let mapObjects = [];
let marbles = [];
let currentMap = null;
let isEditMode = false;

// Tıklama tespiti için (Raycaster)
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function init() {
  // 1. Three.js Sahnesi
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x080911);

  // 2. Kamera
  camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 18, 35);
  camera.lookAt(0, 0, 15);

  // 3. Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  document.body.appendChild(renderer.domElement);

  // 4. Işıklar
  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(20, 40, 20);
  dirLight.castShadow = true;
  scene.add(dirLight);

  // 5. Cannon.js Fizik Dünyası
  world = new CANNON.World();
  world.gravity.set(0, -12, 0); // Yerçekimi

  // Event Listener'lar (Buton Tıklamaları)
  document.getElementById('btn-map1').addEventListener('click', () => loadMap('map1'));
  document.getElementById('btn-map2').addEventListener('click', () => loadMap('map2'));
  document.getElementById('btn-spawn').addEventListener('click', () => spawnMarbles(5));
  document.getElementById('btn-clear-marbles').addEventListener('click', clearMarbles);
  document.getElementById('btn-toggle-edit').addEventListener('click', toggleEditMode);
  document.getElementById('btn-export').addEventListener('click', exportMapJSON);

  window.addEventListener('click', onSceneClick);
  window.addEventListener('resize', onWindowResize);

  // Harita 1 ile Başlat
  loadMap('map1');

  // Oyun Döngüsü
  animate();
}

// HARİTA YÜKLEME
function loadMap(mapKey) {
  currentMap = JSON.parse(JSON.stringify(MAPS[mapKey])); // Derin kopya

  // Eski platformları kaldır
  mapObjects.forEach(obj => {
    scene.remove(obj.mesh);
    world.remove(obj.body);
  });
  mapObjects = [];

  clearMarbles();

  // Platformları Çiz ve Fizik Ekle
  currentMap.platforms.forEach(p => createPlatform(p.pos, p.size, p.color));
}

function createPlatform(pos, size, color = 0x3498db) {
  // Visual
  const geo = new THREE.BoxGeometry(size[0], size[1], size[2]);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.3 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(...pos);
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  scene.add(mesh);

  // Physics
  const shape = new CANNON.Box(new CANNON.Vec3(size[0]/2, size[1]/2, size[2]/2));
  const body = new CANNON.Body({ mass: 0 }); // Sabit
  body.addShape(shape);
  body.position.set(...pos);
  world.addBody(body);

  mapObjects.push({ mesh, body, size, color });
}

// MİSKET (TOP) BIRTMA
function spawnMarbles(count = 5) {
  if (!currentMap) return;

  const colors = [0xe74c3c, 0xf1c40f, 0x2ecc71, 0x9b59b6, 0xe91e63, 0x00d2d3];

  for (let i = 0; i < count; i++) {
    const radius = 0.5 + Math.random() * 0.2;
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    // Görsel
    const geo = new THREE.SphereGeometry(radius, 32, 32);
    const mat = new THREE.MeshStandardMaterial({ color: randomColor, metalness: 0.4, roughness: 0.1 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    scene.add(mesh);

    // Fizik
    const shape = new CANNON.Sphere(radius);
    const body = new CANNON.Body({ mass: 2 });
    body.addShape(shape);

    // Doğma noktasında hafif rastgele sapma ve hız ver
    const spawnX = currentMap.spawn.x + (Math.random() - 0.5) * 2;
    const spawnZ = currentMap.spawn.z + (Math.random() - 0.5) * 2;
    body.position.set(spawnX, currentMap.spawn.y + i * 1.2, spawnZ);
    
    // Ufak bir itiş kuvveti ver (Kendi Kendine Hareket)
    body.velocity.set((Math.random() - 0.5) * 4, -2, (Math.random() - 0.5) * 4);

    world.addBody(body);
    marbles.push({ mesh, body });
  }
}

function clearMarbles() {
  marbles.forEach(m => {
    scene.remove(m.mesh);
    world.remove(m.body);
  });
  marbles = [];
}

// HARİTA EDİTÖRÜ (Tıklayarak Blok Koyma)
function toggleEditMode() {
  isEditMode = !isEditMode;
  const btn = document.getElementById('btn-toggle-edit');
  const info = document.getElementById('edit-info');
  const exportBtn = document.getElementById('btn-export');

  if (isEditMode) {
    btn.innerText = "Mode: Düzenleme Açık!";
    btn.style.background = "#00c853";
    info.style.display = "block";
    exportBtn.style.display = "block";
  } else {
    btn.innerText = "Mode: İzleyici (Editörü Aç)";
    btn.style.background = "#ff9100";
    info.style.display = "none";
    exportBtn.style.display = "none";
  }
}

function onSceneClick(event) {
  // Arayüz tıklamalarını yoksay
  if (event.clientX < 260 && event.clientY < 400) return;
  if (!isEditMode) return;

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(mapObjects.map(o => o.mesh));

  if (intersects.length > 0) {
    const hit = intersects[0];
    // Tıklanan yüzeyin üstüne yeni blok koy
    const newPos = [
      Math.round(hit.point.x),
      Math.round(hit.point.y + 0.5),
      Math.round(hit.point.z)
    ];
    const newSize = [4, 0.5, 4];
    const randomColor = Math.random() * 0xffffff;

    createPlatform(newPos, newSize, randomColor);
    currentMap.platforms.push({ pos: newPos, size: newSize, color: randomColor });
  }
}

function exportMapJSON() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentMap, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", "custom_map.json");
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

// OYUN DÖNGÜSÜ
function animate() {
  requestAnimationFrame(animate);

  world.step(1 / 60);

  // Misketlerin Konumlarını Güncelle
  for (let i = marbles.length - 1; i >= 0; i--) {
    const m = marbles[i];
    m.mesh.position.copy(m.body.position);
    m.mesh.quaternion.copy(m.body.quaternion);

    // Çok aşağı düşen misketleri sil
    if (m.body.position.y < -25) {
      scene.remove(m.mesh);
      world.remove(m.body);
      marbles.splice(i, 1);
    }
  }

  renderer.render(scene, camera);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

window.onload = init;
