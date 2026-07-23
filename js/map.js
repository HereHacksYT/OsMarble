// Harita tasarımlarınızı bu JSON objelerine ekleyebilirsiniz
const MAPS = {
  map1: {
    name: "Düz Rampa Parkuru",
    spawn: { x: 0, y: 6, z: 0 },
    platforms: [
      { pos: [0, 0, 0], size: [12, 1, 12], color: 0x2ecc71 },
      { pos: [0, -3, 15], size: [8, 1, 18], color: 0x3498db },
      { pos: [0, -7, 32], size: [14, 1, 14], color: 0xe74c3c }
    ]
  },
  map2: {
    name: "Savaş Arenaları",
    spawn: { x: 0, y: 6, z: 0 },
    platforms: [
      { pos: [0, 0, 0], size: [8, 1, 8], color: 0x9b59b6 },
      { pos: [7, -3, 10], size: [6, 1, 6], color: 0xf1c40f },
      { pos: [-7, -3, 10], size: [6, 1, 6], color: 0xe67e22 },
      { pos: [0, -6, 22], size: [16, 1, 16], color: 0x1abc9c }
    ]
  }
};
