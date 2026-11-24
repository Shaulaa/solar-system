import * as THREE from 'three';
import { scaleDistanceAt } from './planets.js';

// Garis orbit tipis buat tiap planet, bentuknya elips dan miring sesuai orbit aslinya
//
// Tiap planet punya satu geometry yang dibuat sekali. Titik titiknya disimpan dalam AU,
// lalu waktu mode skala berubah posisinya ditulis ulang ke buffer yang sama
// (jarak tiap titik ke Matahari di-scale, arahnya tetap, sama persis seperti planetnya).
// Gak ada geometry baru yang dibuat, jadi gak ada yang perlu di-dispose
// Orbit yang sangat lonjong (komet) butuh titik lebih rapat, kalau nggak tikungan di dekat
// perihelion kelihatan patah patah
const SEGMENTS = { normal: 256, eccentric: 1024 };
const ECCENTRIC_FROM = 0.5;
// Planet katai dan komet digambar lebih redup dari planet, biar overview gak penuh garis
const OPACITY = { major: 0.18, minor: 0.09 };

export function createOrbits(planetList) {
  const group = new THREE.Group();
  group.name = 'orbits';

  const makeMaterial = (opacity) =>
    new THREE.LineBasicMaterial({ color: 0x8fa3c7, transparent: true, opacity, depthWrite: false });
  const materials = { major: makeMaterial(OPACITY.major), minor: makeMaterial(OPACITY.minor) };

  const lines = planetList.map((planet) => {
    const segments = planet.data.orbit.eccentricity >= ECCENTRIC_FROM ? SEGMENTS.eccentric : SEGMENTS.normal;
    const pointsAU = planet.orbit.path(segments, () => new THREE.Vector3());
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(segments * 3), 3));

    const line = new THREE.LineLoop(geometry, planet.data.kind ? materials.minor : materials.major);
    line.name = `${planet.data.id}-orbit-line`;
    line.visible = planet.visible;
    group.add(line);
    return { line, planet, pointsAU };
  });

  const point = new THREE.Vector3();

  function applyScale(k) {
    for (const { line, pointsAU } of lines) {
      const position = line.geometry.attributes.position;
      pointsAU.forEach((au, i) => {
        point.copy(au).multiplyScalar(scaleDistanceAt(au.length(), k) / au.length());
        position.setXYZ(i, point.x, point.y, point.z);
      });
      position.needsUpdate = true;
      line.geometry.computeBoundingSphere();
    }
  }

  applyScale(0);

  return {
    group,
    // Dipanggil scene/scaleMode.js tiap frame selama transisi mode skala
    applyScale,
    // 0 sampai 1, dipakai waktu zoom keluar tata surya (scene/solarFade.js).
    // Lewat material, bukan group.visible, karena group.visible punya tombol orbit di toolbar
    setOpacity(alpha) {
      for (const [name, material] of Object.entries(materials)) {
        material.opacity = OPACITY[name] * alpha;
        material.visible = alpha > 0;
      }
    },
    // Ikutin visibilitas planet (Pluto baru kelihatan setelah ketemu)
    update() {
      for (const { line, planet } of lines) line.visible = planet.visible;
    }
  };
}
