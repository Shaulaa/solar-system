import * as THREE from 'three';
import { planets as planetData } from '../data/planets.js';
import { createPlanetTexture } from '../utils/planetTexture.js';
import { loadTexture, assignTexture } from '../utils/loader.js';
import { scaleDistance, scaleRadius, blendScale } from '../utils/scale.js';
import { createEarth } from './earth.js';
import { createSaturnRing } from './saturnRing.js';

const DEG = Math.PI / 180;

// Kecepatan rotasi di-scale terpisah dari revolusi
// Kalo pake angka asli, di 10 hari per detik Bumi bakal muter 10 kali per detik dan bikin pusing
const ROTATION_SCALE = 0.04;

// Bola bertekstur generik, dipakai planet biasa dan bulan.
// Sebelum tekstur siap, material pakai warna dasar dari look biar gak kelihatan putih polos.
// Kalau file tekstur gak ada, fallback ke tekstur prosedural
export function createTexturedSphere(data, radius, seed) {
  const material = new THREE.MeshStandardMaterial({
    color: data.look.colors[1] ?? data.look.colors[0],
    roughness: data.look.type === 'gas' || data.look.type === 'ice' ? 0.75 : 0.95,
    metalness: 0
  });

  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 64, 64), material);
  mesh.name = data.id;
  mesh.userData.selectable = data.id;

  loadTexture(data.texture, { fallback: () => createPlanetTexture(data.look, seed) }).then((texture) => {
    // Warna dasar dibalikin ke putih, kalau nggak teksturnya ikut ke-tint
    material.color.set(0xffffff);
    assignTexture(material, 'map', texture);
  });

  return mesh;
}

// Badan planet generik, bentuknya disamain sama createEarth biar planets.js gak perlu bedain
function createBody(data, radius, seed) {
  const mesh = createTexturedSphere(data, radius, seed);
  return {
    group: mesh,
    mesh,
    update(spin) {
      mesh.rotation.y = spin;
    }
  };
}

// Hierarki tiap planet
// orbitPivot (muter = revolusi) > anchor (geser sejauh jarak orbit) > tiltGroup (miring) > mesh (rotasi)
// Bulan nanti ditempel ke anchor (lihat moons.js), cincin ke tiltGroup
//
// Geometry dibikin sekali di ukuran mode pretty. Pindah mode skala cukup ngubah
// scale tiltGroup (radius) dan posisi anchor (jarak), jadi gak ada geometry baru yang dibuat
function createPlanet(data, index) {
  const size = { pretty: scaleRadius(data.radius), real: scaleRadius(data.radius, 'real') };
  const orbit = { pretty: scaleDistance(data.distance), real: scaleDistance(data.distance, 'real') };
  const radius = size.pretty;
  const distance = orbit.pretty;
  const seed = index + 1;

  const orbitPivot = new THREE.Object3D();
  orbitPivot.name = `${data.id}-orbit`;

  const anchor = new THREE.Object3D();
  anchor.position.x = distance;
  orbitPivot.add(anchor);

  const tiltGroup = new THREE.Object3D();
  tiltGroup.rotation.z = data.tilt * DEG;
  anchor.add(tiltGroup);

  const body = data.id === 'earth' ? createEarth(data, radius, seed) : createBody(data, radius, seed);
  tiltGroup.add(body.group);

  const ring = data.ring ? createSaturnRing(data.ring, radius) : null;
  if (ring) tiltGroup.add(ring.mesh);

  // Posisi awal acak biar planet gak baris lurus semua
  const startAngle = (index * 2.39996) % (Math.PI * 2);

  const planet = {
    data,
    // Radius dan jarak orbit sekarang (unit scene), berubah waktu transisi mode skala
    radius,
    distance,
    baseRadius: size.pretty,
    orbitPivot,
    anchor,
    tiltGroup,
    mesh: body.mesh,
    applyScale(k) {
      planet.radius = blendScale(size.pretty, size.real, k);
      planet.distance = blendScale(orbit.pretty, orbit.real, k);
      anchor.position.x = planet.distance;
      tiltGroup.scale.setScalar(planet.radius / size.pretty);
    },
    update(simDays) {
      orbitPivot.rotation.y = startAngle + (simDays / data.orbitPeriod) * Math.PI * 2;
      body.update((simDays / data.rotationPeriod) * Math.PI * 2 * ROTATION_SCALE);
      ring?.update(planet.radius);
    }
  };

  return planet;
}

export function createPlanets() {
  const group = new THREE.Group();
  group.name = 'planets';

  const list = planetData.map((data, i) => {
    const planet = createPlanet(data, i);
    group.add(planet.orbitPivot);
    return planet;
  });

  return {
    group,
    list,
    applyScale(k) {
      for (const p of list) p.applyScale(k);
    },
    update(simDays) {
      for (const p of list) p.update(simDays);
    }
  };
}
