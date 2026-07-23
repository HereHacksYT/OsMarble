let scene, camera, renderer, world;
let mapObjects = [];
let playerMesh, playerBody;
let keys = {};

function init() {
  // Three.js Sahnesi
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0f1016);

  // Kamera
  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  document.body.appendChild(renderer.domElement);

  // Işıklandırma
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(20, 40, 20);
  dirLight.castShadow = true;
  scene.add(dirLight);

  // Cannon.js Fizik Dünyası
  world = new CANNON.World();
  world.gravity.set(0, -15, 0);

  // Oyuncu Topu Oluştur
  createPlayer();

  // Varsayılan Haritayı Yükle
  loadMapData(MAPS.map1);

  // Event Listener'lar
  window.addEventListener('resize', onWindowResize);
  window.addEventListener('keydown', e => keys[e.key.toLowerCase()] = true);
  window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

  // Oyun Döngüsü
  animate();
}

function createPlayer() {
  const radius = 0.8;

  // Görsel (Mesh)
  const geo = new THREE.SphereGeometry(radius, 32, 32);
  const mat = new THREE.MeshStandardMaterial({ color: 0xff3366, roughness: 0.2, metalness: 0.5 });
  playerMesh = new THREE.Mesh(geo, mat);
  playerMesh.castShadow = true;
  scene.add(playerMesh);

  // Fizik (Body)
  const shape = new CANNON.Sphere(radius);
  playerBody = new CANNON.Body({ mass: 5 });
  playerBody.addShape(shape);
  world.addBody(playerBody);
}

function loadMapData(mapData) {
  // Eski platformları temizle
  mapObjects.forEach(obj => {
    scene.remove(obj.mesh);
    world.remove(obj.body);
  });
  mapObjects = [];

  // Oyuncuyu Başlangıç Noktasına Taşı
  playerBody.position.set(mapData.spawn.x, mapData.spawn.y, mapData.spawn.z);
  playerBody.velocity.set(0, 0, 0);
  playerBody.angularVelocity.set(0, 0, 0);

  // Yeni Platformları Ekle
  mapData.platforms.forEach(p => {
    // Görsel
    const geo = new THREE.BoxGeometry(p.size[0], p.size[1], p.size[2]);
    const mat = new THREE.MeshStandardMaterial({ color: p.color, roughness: 0.4 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(...p.pos);
    mesh.receiveShadow = true;
    scene.add(mesh);

    // Fizik
    const shape = new CANNON.Box(new CANNON.Vec3(p.size[0] / 2, p.size[1] / 2, p.size[2] / 2));
    const body = new CANNON.Body({ mass: 0 }); // Mass 0 = Hareketsiz platform
    body.addShape(shape);
    body.position.set(...p.pos);
    world.addBody(body);

    mapObjects.push({ mesh, body });
  });
}

function changeMap(mapKey) {
  if (MAPS[mapKey]) {
    loadMapData(MAPS[mapKey]);
  }
}

function handleInput() {
  const force = 18;
  if (keys['w']) playerBody.applyForce(new CANNON.Vec3(0, 0, -force), playerBody.position);
  if (keys['s']) playerBody.applyForce(new CANNON.Vec3(0, 0, force), playerBody.position);
  if (keys['a']) playerBody.applyForce(new CANNON.Vec3(-force, 0, 0), playerBody.position);
  if (keys['d']) playerBody.applyForce(new CANNON.Vec3(force, 0, 0), playerBody.position);
}

function animate() {
  requestAnimationFrame(animate);

  world.step(1 / 60);
  handleInput();

  // Fizik pozisyonunu görsele aktar
  playerMesh.position.copy(playerBody.position);
  playerMesh.quaternion.copy(playerBody.quaternion);

  // Akıcı Kamera Takibi
  const targetCamPos = new THREE.Vector3(
    playerMesh.position.x,
    playerMesh.position.y + 10,
    playerMesh.position.z + 16
  );
  camera.position.lerp(targetCamPos, 0.1);
  camera.lookAt(playerMesh.position);

  // Düştü mü Kontrolü
  if (playerBody.position.y < -25) {
    playerBody.position.set(0, 6, 0);
    playerBody.velocity.set(0, 0, 0);
  }

  renderer.render(scene, camera);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

window.onload = init;
