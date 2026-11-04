import * as THREE from 'three';
import { asteroidBelt as beltData } from '../data/planets.js';
import { scaleDistance } from '../utils/scale.js';

// Sabuk asteroid pakai satu InstancedMesh, jadi ribuan batu cuma 1 draw call.
// Semua instance berbagi satu geometry, variasi bentuknya datang dari skala XYZ yang beda beda

// Icosahedron detail 0 itu non-indexed, tiap sudut muncul beberapa kali (sekali per segitiga).
// Kalau tiap vertex diacak sendiri sendiri, permukaannya bakal retak.
// Makanya offset acak disimpan per posisi, vertex di posisi yang sama dapat offset yang sama
function createRockGeometry() {
  const geometry = new THREE.IcosahedronGeometry(1, 0);
  const position = geometry.attributes.position;
  const offsets = new Map();

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const key = `${x.toFixed(4)},${y.toFixed(4)},${z.toFixed(4)}`;
    if (!offsets.has(key)) offsets.set(key, 0.75 + Math.random() * 0.5);
    const k = offsets.get(key);
    position.setXYZ(i, x * k, y * k, z * k);
  }

  geometry.computeVertexNormals();
  return geometry;
}

export function createAsteroidBelt({ mobile = false } = {}) {
  const count = mobile ? beltData.count.mobile : beltData.count.desktop;
  const innerRadius = scaleDistance(beltData.innerAU);
  const outerRadius = scaleDistance(beltData.outerAU);

  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 1,
    metalness: 0,
    flatShading: true
  });

  const mesh = new THREE.InstancedMesh(createRockGeometry(), material, count);
  mesh.name = 'asteroid-belt';

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const palette = ['#6b6259', '#857a6e', '#5a5550', '#9a8b78'].map((c) => new THREE.Color(c));

  for (let i = 0; i < count; i++) {
    // Rata rata dua random bikin kepadatan numpuk di tengah sabuk, tipis di pinggir
    const t = (Math.random() + Math.random()) / 2;
    const radius = innerRadius + (outerRadius - innerRadius) * t;
    const angle = Math.random() * Math.PI * 2;
    const height = (Math.random() + Math.random() + Math.random() - 1.5) * 0.9;

    dummy.position.set(Math.cos(angle) * radius, height, Math.sin(angle) * radius);
    dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);

    // Pangkat 3 bikin mayoritas batu kecil, cuma sedikit yang besar
    const size = 0.05 + Math.pow(Math.random(), 3) * 0.28;
    dummy.scale.set(
      size * (0.7 + Math.random() * 0.6),
      size * (0.7 + Math.random() * 0.6),
      size * (0.7 + Math.random() * 0.6)
    );
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);

    color.copy(palette[i % palette.length]).multiplyScalar(0.8 + Math.random() * 0.4);
    mesh.setColorAt(i, color);
  }

  mesh.instanceMatrix.needsUpdate = true;
  mesh.instanceColor.needsUpdate = true;
  // Posisi instance gak pernah berubah (yang muter grupnya), jadi bounding sphere cukup dihitung sekali
  mesh.computeBoundingSphere();

  return {
    mesh,
    update(simDays) {
      // Seluruh sabuk muter pelan sebagai satu grup, ngikut waktu simulasi biar ikut pause
      mesh.rotation.y = (simDays / beltData.orbitPeriod) * Math.PI * 2;
    }
  };
}
