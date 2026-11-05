import * as THREE from 'three';
import { scaleDistanceAt } from './planets.js';

// Garis orbit tipis buat tiap planet, bentuknya elips dan miring sesuai orbit aslinya
//
// Tiap planet punya satu geometry yang dibuat sekali. Titik titiknya disimpan dalam AU,
// lalu waktu mode skala berubah posisinya ditulis ulang ke buffer yang sama
// (jarak tiap titik ke Matahari di-scale, arahnya tetap, sama persis seperti planetnya).
// Gak ada geometry baru yang dibuat, jadi gak ada yang perlu di-dispose
const SEGMENTS = 256;

export function createOrbits(planetList) {
  const group = new THREE.Group();
  group.name = 'orbits';

  const material = new THREE.LineBasicMaterial({
    color: 0x8fa3c7,
    transparent: true,
    opacity: 0.18,
    depthWrite: false
  });

  const lines = planetList.map((planet) => {
    const pointsAU = planet.orbit.path(SEGMENTS, () => new THREE.Vector3());
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SEGMENTS * 3), 3));

    const line = new THREE.LineLoop(geometry, material);
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
    // Ikutin visibilitas planet (Pluto baru kelihatan setelah ketemu)
    update() {
      for (const { line, planet } of lines) line.visible = planet.visible;
    }
  };
}
