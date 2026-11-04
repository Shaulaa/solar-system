import * as THREE from 'three';

// Garis orbit tipis buat tiap planet
export function createOrbits(planetList) {
  const group = new THREE.Group();
  group.name = 'orbits';

  const material = new THREE.LineBasicMaterial({
    color: 0x8fa3c7,
    transparent: true,
    opacity: 0.18,
    depthWrite: false
  });

  for (const planet of planetList) {
    const curve = new THREE.EllipseCurve(0, 0, planet.distance, planet.distance, 0, Math.PI * 2);
    const points = curve.getPoints(256).map((p) => new THREE.Vector3(p.x, 0, p.y));
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.LineLoop(geometry, material);
    group.add(line);
  }

  return group;
}
