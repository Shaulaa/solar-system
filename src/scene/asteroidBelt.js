import * as THREE from 'three';
import { asteroidBelt as beltData } from '../data/planets.js';
import { scaleDistance, scaleRadius, blendScale } from '../utils/scale.js';

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

// Faktor ukuran batu di mode Skala Nyata, disamain dengan seberapa jauh Bumi mengecil.
// Kalau ukurannya dibiarkan, batu asteroid bakal jauh lebih besar dari Bumi di mode nyata
const REAL_ROCK_FACTOR = scaleRadius(1, 'real') / scaleRadius(1);

export function createAsteroidBelt({ mobile = false } = {}) {
  const count = mobile ? beltData.count.mobile : beltData.count.desktop;

  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 1,
    metalness: 0,
    flatShading: true
  });

  const mesh = new THREE.InstancedMesh(createRockGeometry(), material, count);
  mesh.name = 'asteroid-belt';

  const color = new THREE.Color();
  const palette = ['#6b6259', '#857a6e', '#5a5550', '#9a8b78'].map((c) => new THREE.Color(c));

  // Parameter acak tiap batu disimpan (bukan langsung dijadiin matrix), biar posisinya
  // bisa dihitung ulang di mode skala mana pun. Jarak disimpan dalam AU, bukan unit scene
  const rocks = [];
  for (let i = 0; i < count; i++) {
    // Rata rata dua random bikin kepadatan numpuk di tengah sabuk, tipis di pinggir
    const t = (Math.random() + Math.random()) / 2;
    // Pangkat 3 bikin mayoritas batu kecil, cuma sedikit yang besar
    const size = 0.05 + Math.pow(Math.random(), 3) * 0.28;
    rocks.push({
      au: beltData.innerAU + (beltData.outerAU - beltData.innerAU) * t,
      angle: Math.random() * Math.PI * 2,
      height: (Math.random() + Math.random() + Math.random() - 1.5) * 0.9,
      rotation: new THREE.Euler(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      ),
      scale: new THREE.Vector3(
        size * (0.7 + Math.random() * 0.6),
        size * (0.7 + Math.random() * 0.6),
        size * (0.7 + Math.random() * 0.6)
      )
    });

    color.copy(palette[i % palette.length]).multiplyScalar(0.8 + Math.random() * 0.4);
    mesh.setColorAt(i, color);
  }
  mesh.instanceColor.needsUpdate = true;

  const dummy = new THREE.Object3D();
  let appliedK = null;

  // Hitung ulang matrix semua batu untuk mode skala k (0 = pretty, 1 = real).
  // Cuma jalan kalau k berubah, jadi di luar transisi gak ada biaya tambahan
  function applyScale(k) {
    if (k === appliedK) return;
    appliedK = k;
    const rockFactor = blendScale(1, REAL_ROCK_FACTOR, k);

    for (let i = 0; i < count; i++) {
      const rock = rocks[i];
      const pretty = scaleDistance(rock.au);
      const radius = blendScale(pretty, scaleDistance(rock.au, 'real'), k);
      // Ketebalan sabuk ikut melebar sebanding jaraknya
      const height = rock.height * (radius / pretty);

      dummy.position.set(Math.cos(rock.angle) * radius, height, Math.sin(rock.angle) * radius);
      dummy.rotation.copy(rock.rotation);
      dummy.scale.copy(rock.scale).multiplyScalar(rockFactor);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
    // Bounding sphere wajib dihitung ulang, kalau nggak frustum culling pakai ukuran lama
    // dan sabuk bisa hilang mendadak di mode nyata
    mesh.computeBoundingSphere();
  }

  applyScale(0);

  return {
    mesh,
    applyScale,
    update(simDays) {
      // Seluruh sabuk muter pelan sebagai satu grup, ngikut waktu simulasi biar ikut pause
      mesh.rotation.y = (simDays / beltData.orbitPeriod) * Math.PI * 2;
    }
  };
}
