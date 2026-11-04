import * as THREE from 'three';
import { scaleRadius, scaleKm, blendScale } from '../utils/scale.js';
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
// Bulan kecil, tekstur prosedural seukuran ini sudah cukup dan generate-nya 4x lebih cepat
const TEXTURE_SIZE = { width: 256, height: 128 };

// Periode orbit visual. Fobos aslinya muter Mars tiap 7,6 jam, di 10 hari per detik itu 31 putaran
// per detik dan malah kelihatan diam / kedip (efek stroboskop). Periode di bawah ~3 hari dihaluskan:
// sqrt(p^2 + 3^2) tetap urut (yang aslinya lebih cepat tetap lebih cepat) dan
// Bulan Bumi (27,3 hari) cuma bergeser 0,6 persen. Panel info tetap nampilin angka asli
const MIN_VISUAL_PERIOD = 3;
const visualPeriod = (days) => Math.sqrt(days * days + MIN_VISUAL_PERIOD * MIN_VISUAL_PERIOD);

function createMoon(moonData, planet, index) {
  const size = { pretty: scaleRadius(moonData.radius), real: scaleRadius(moonData.radius, 'real') };
  // Mode pretty pakai kelipatan radius planet induk, mode real pakai jarak asli dalam km
  const orbit = {
    pretty: planet.baseRadius * moonData.orbitRadius,
    real: scaleKm(moonData.distanceKm)
  };
  const radius = size.pretty;
  const orbitRadius = orbit.pretty;

  const pivot = new THREE.Object3D();
  pivot.name = `${moonData.id}-orbit`;
  planet.anchor.add(pivot);

  const mesh = createTexturedSphere(moonData, radius, SEED_OFFSET + index, {
    textureSize: TEXTURE_SIZE,
    segments: 48
  });
  mesh.position.x = orbitRadius;
  // Bagian tengah tekstur (u = 0.5, sisi dekat Bulan) aslinya menghadap +X.
  // Diputar 180 derajat biar sisi itu yang menghadap planet induk
  mesh.rotation.y = Math.PI;
  pivot.add(mesh);

  const startAngle = (index * 1.7) % (Math.PI * 2);
  const period = visualPeriod(moonData.orbitPeriod);

  const moon = {
    data: moonData,
    parent: planet,
    // Radius sekarang (unit scene), berubah waktu transisi mode skala
    radius,
    pivot,
    mesh,
    applyScale(k) {
      moon.radius = blendScale(size.pretty, size.real, k);
      mesh.position.x = blendScale(orbit.pretty, orbit.real, k);
      mesh.scale.setScalar(moon.radius / size.pretty);
    },
    update(simDays) {
      pivot.rotation.y = startAngle + (simDays / period) * Math.PI * 2;
    }
  };

  return moon;
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
    applyScale(k) {
      for (const m of list) m.applyScale(k);
    },
    update(simDays) {
      for (const m of list) m.update(simDays);
    }
  };
}
