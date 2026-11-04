import * as THREE from 'three';
import { scaleRadius } from '../utils/scale.js';
import { createTexturedSphere } from './planets.js';

// Bulan bulan planet, dibaca dari field moons di data/planets.js
// Hierarki: anchor planet > pivot (muter = revolusi bulan) > mesh
//
// Ditempel ke anchor, BUKAN tiltGroup, supaya bidang orbit bulan gak ikut miring
// sesuai kemiringan sumbu planet (23,4 derajat di Bumi).
// Rotasi mesh gak di-update sendiri: karena mesh ikut pivot, sisi yang sama selalu
// menghadap planet (tidal lock), persis kayak Bulan aslinya

// Seed fallback prosedural dipisah dari seed planet (1..8) biar polanya beda
const SEED_OFFSET = 100;

function createMoon(moonData, planet, index) {
  const radius = scaleRadius(moonData.radius);
  const orbitRadius = planet.radius * moonData.orbitRadius;

  const pivot = new THREE.Object3D();
  pivot.name = `${moonData.id}-orbit`;
  planet.anchor.add(pivot);

  const mesh = createTexturedSphere(moonData, radius, SEED_OFFSET + index);
  mesh.position.x = orbitRadius;
  // Bagian tengah tekstur (u = 0.5, sisi dekat Bulan) aslinya menghadap +X.
  // Diputar 180 derajat biar sisi itu yang menghadap planet induk
  mesh.rotation.y = Math.PI;
  pivot.add(mesh);

  const startAngle = (index * 1.7) % (Math.PI * 2);

  return {
    data: moonData,
    parent: planet,
    radius,
    pivot,
    mesh,
    update(simDays) {
      pivot.rotation.y = startAngle + (simDays / moonData.orbitPeriod) * Math.PI * 2;
    }
  };
}

export function createMoons(planetList) {
  const list = [];

  for (const planet of planetList) {
    for (const moonData of planet.data.moons ?? []) {
      list.push(createMoon(moonData, planet, list.length));
    }
  }

  return {
    list,
    update(simDays) {
      for (const m of list) m.update(simDays);
    }
  };
}
