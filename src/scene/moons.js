import * as THREE from 'three';
import { scaleRadius, scaleKm, blendScale } from '../utils/scale.js';
import { createTexturedSphere } from './planets.js';
import { START_DAYS_SINCE_J2000 } from '../utils/time.js';
import { moonPosition } from '../utils/moon.js';

// Bulan bulan planet, dibaca dari field moons di data/planets.js
// Hierarki: anchor planet > pivot (muter = revolusi bulan) > mesh
//
// Ditempel ke anchor (lewat bidang orbit, createOrbitFrame), BUKAN tiltGroup, supaya bidang orbit
// bulan gak ikut skala dan rotasi harian planet. Kemiringannya diatur sendiri: Bulan Bumi di bidang
// ekliptika, bulan Saturnus, Uranus, dan Neptunus di bidang ekuator planetnya (plane: 'equator').
// Rotasi mesh gak di-update sendiri: karena mesh ikut pivot, sisi yang sama selalu
// menghadap planet (tidal lock), persis kayak Bulan aslinya
//
// Bulan Bumi (ephemeris: 'moon') posisinya gak dari periode orbit, tapi dari bujur dan lintang
// ekliptika aslinya di tanggal simulasi (utils/moon.js). Jadi Bulan di layar tampak purnama / sabit
// sesuai kalender, dan bulan baru cuma lewat persis di depan Matahari kalau lintangnya hampir 0
// (musim gerhana)

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

// Di mode Enak Dilihat bulan maksimal segini kali radius planet induknya.
// Pangkat 0.55 bikin Bulan Bumi hampir setengah Bumi, cukup besar buat nutupin Bumi waktu
// lewat di depannya. Batasnya 0,27 = perbandingan asli Bulan dan Bumi.
// Bulan Jupiter jauh di bawah batas ini, gak kena
const MAX_PRETTY_SIZE = 0.27;

const DEG = Math.PI / 180;

// Bidang orbit bulan, ditempel ke anchor planet (gak ikut skala tiltGroup).
// Default bidang ekliptika. plane: 'equator' = bidang ekuator planet (rotation.z sama dengan
// tiltGroup), lalu inclination memiringkan orbit di dalam bidang itu. Urutan 'ZYX' artinya
// kemiringan inclination dipasang duluan, baru seluruhnya ikut miring sumbu planet
function createOrbitFrame(moonData, planet) {
  const frame = new THREE.Object3D();
  frame.name = `${moonData.id}-plane`;
  if (moonData.plane === 'equator') {
    frame.rotation.set((moonData.inclination ?? 0) * DEG, 0, (planet.data.tilt ?? 0) * DEG, 'ZYX');
  }
  planet.anchor.add(frame);
  return frame;
}

// Bulan Bumi dari bujur dan lintang ekliptikanya. Sumbu scene: x = titik Aries, y = kutub utara
// ekliptika, -z = bujur 90 derajat. Mesh ada di +x pivot, jadi Rz(lintang) dulu (naik ke utara),
// baru Ry(bujur): urutan Euler 'YZX'. Sisi yang sama tetap menghadap Bumi karena mesh ikut pivot
function placeByEphemeris(pivot, days) {
  const { longitude, latitude } = moonPosition(days);
  pivot.rotation.set(0, longitude, latitude, 'YZX');
}

function createMoon(moonData, planet, index) {
  const size = {
    pretty: Math.min(scaleRadius(moonData.radius), planet.baseRadius * MAX_PRETTY_SIZE),
    real: scaleRadius(moonData.radius, 'real')
  };
  // Mode pretty pakai kelipatan radius planet induk, mode real pakai jarak asli dalam km
  const orbit = {
    pretty: planet.baseRadius * moonData.orbitRadius,
    real: scaleKm(moonData.distanceKm)
  };
  const radius = size.pretty;
  const orbitRadius = orbit.pretty;

  const pivot = new THREE.Object3D();
  pivot.name = `${moonData.id}-orbit`;
  createOrbitFrame(moonData, planet).add(pivot);

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
      if (moonData.ephemeris === 'moon') {
        placeByEphemeris(pivot, START_DAYS_SINCE_J2000 + simDays);
        return;
      }
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
