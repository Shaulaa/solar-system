import * as THREE from 'three';

// Garis orbit tipis buat tiap planet
//
// Semua garis pakai SATU geometry lingkaran radius 1, lalu di-scale sejauh jarak orbit planet.
// Jadi waktu mode skala berubah, cukup scale-nya yang diganti tiap frame,
// gak perlu bikin ulang geometry (dan gak ada yang perlu di-dispose)
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

  const curve = new THREE.EllipseCurve(0, 0, 1, 1, 0, Math.PI * 2);
  const points = curve.getPoints(SEGMENTS).map((p) => new THREE.Vector3(p.x, 0, p.y));
  const geometry = new THREE.BufferGeometry().setFromPoints(points);

  const lines = planetList.map((planet) => {
    const line = new THREE.LineLoop(geometry, material);
    line.name = `${planet.data.id}-orbit-line`;
    line.scale.setScalar(planet.distance);
    group.add(line);
    return { line, planet };
  });

  return {
    group,
    // Ikutin jarak orbit planet sekarang (berubah waktu transisi mode skala)
    update() {
      for (const { line, planet } of lines) line.scale.setScalar(planet.distance);
    }
  };
}
