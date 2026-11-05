import * as THREE from 'three';
import { planets as planetData, dwarfPlanets } from '../data/planets.js';
import { createPlanetTexture } from '../utils/planetTexture.js';
import { loadTexture, assignTexture } from '../utils/loader.js';
import { scaleDistance, scaleRadius, blendScale } from '../utils/scale.js';
import { createKeplerOrbit } from '../utils/kepler.js';
import { START_DAYS_SINCE_J2000 } from '../utils/time.js';
import { createEarth } from './earth.js';
import { createSaturnRing } from './saturnRing.js';

const DEG = Math.PI / 180;

// Kecepatan rotasi di-scale terpisah dari revolusi
// Kalo pake angka asli, di 10 hari per detik Bumi bakal muter 10 kali per detik dan bikin pusing
const ROTATION_SCALE = 0.04;

// Bola bertekstur generik, dipakai planet biasa dan bulan.
// Sebelum tekstur siap, material pakai warna dasar dari look biar gak kelihatan putih polos.
// Kalau file tekstur gak ada, fallback ke tekstur prosedural
export function createTexturedSphere(data, radius, seed, { textureSize, segments = 64 } = {}) {
  const material = new THREE.MeshStandardMaterial({
    color: data.look.colors[1] ?? data.look.colors[0],
    roughness: data.look.type === 'gas' || data.look.type === 'ice' ? 0.75 : 0.95,
    metalness: 0
  });

  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, segments, segments), material);
  mesh.name = data.id;
  mesh.userData.selectable = data.id;

  const fallback = () => createPlanetTexture(data.look, seed, textureSize);
  loadTexture(data.texture, { fallback }).then((texture) => {
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

// Jarak dari Matahari (AU) ke unit scene untuk nilai k mana pun (0 = pretty, 1 = real)
export function scaleDistanceAt(au, k) {
  return blendScale(scaleDistance(au), scaleDistance(au, 'real'), k);
}

// Hierarki tiap planet
// root (visibilitas) > anchor (posisi di orbit) > tiltGroup (miring sumbu) > mesh (rotasi)
// Bulan nanti ditempel ke anchor (lihat moons.js), cincin ke tiltGroup
//
// Orbitnya elips dan miring sesuai elemen orbit asli (utils/kepler.js), dan posisinya sesuai
// tanggal simulasi. Posisi dihitung dulu dalam AU, lalu jaraknya ke Matahari di-scale
// (arahnya tetap). Jadi di mode Enak Dilihat bentuk elipsnya ikut terkompres, tapi
// kemiringan dan arah perihelionnya tetap benar
//
// Geometry dibikin sekali di ukuran mode pretty. Pindah mode skala cukup ngubah
// scale tiltGroup (radius) dan posisi anchor (jarak), jadi gak ada geometry baru yang dibuat
function createPlanet(data, index) {
  const size = { pretty: scaleRadius(data.radius), real: scaleRadius(data.radius, 'real') };
  const radius = size.pretty;
  const seed = index + 1;
  const orbit = createKeplerOrbit(data.distance, data.orbitPeriod, data.orbit);

  const root = new THREE.Object3D();
  root.name = `${data.id}-root`;
  // Benda tersembunyi (easter egg Pluto) baru kelihatan setelah reveal()
  root.visible = !data.hidden;

  const anchor = new THREE.Object3D();
  anchor.name = `${data.id}-anchor`;
  root.add(anchor);

  const tiltGroup = new THREE.Object3D();
  tiltGroup.rotation.z = data.tilt * DEG;
  anchor.add(tiltGroup);

  const body = data.id === 'earth' ? createEarth(data, radius, seed) : createBody(data, radius, seed);
  tiltGroup.add(body.group);

  const ring = data.ring ? createSaturnRing(data.ring, radius) : null;
  if (ring) tiltGroup.add(ring.mesh);

  // Radius terluar benda (kelipatan radius planet): tepi cincin Saturnus, atmosfer Bumi, atau permukaannya.
  // Dipakai kamera biar seluruh benda muat di layar waktu difokus
  const boundingScale = Math.max(data.ring?.outer ?? 1, body.boundingScale ?? 1);

  // Posisi heliosentris dalam AU, diisi update()
  const helio = new THREE.Vector3();
  let k = 0;

  function place() {
    const au = helio.length();
    planet.distance = scaleDistanceAt(au, k);
    anchor.position.copy(helio).multiplyScalar(planet.distance / au);
  }

  const planet = {
    data,
    orbit,
    // Radius dan jarak ke Matahari sekarang (unit scene). Jarak berubah sepanjang orbit
    // (elips) dan waktu transisi mode skala
    radius,
    distance: 0,
    baseRadius: size.pretty,
    get boundingRadius() {
      return planet.radius * boundingScale;
    },
    root,
    anchor,
    tiltGroup,
    mesh: body.mesh,
    get visible() {
      return root.visible;
    },
    reveal() {
      root.visible = true;
    },
    applyScale(nextK) {
      k = nextK;
      planet.radius = blendScale(size.pretty, size.real, k);
      tiltGroup.scale.setScalar(planet.radius / size.pretty);
      place();
    },
    update(simDays) {
      orbit.positionAt(START_DAYS_SINCE_J2000 + simDays, helio);
      place();
      body.update((simDays / data.rotationPeriod) * Math.PI * 2 * ROTATION_SCALE);
      ring?.update(planet.radius);
    }
  };

  // Posisi awal langsung diisi, biar modul lain (garis orbit, kamera) gak pernah lihat posisi nol
  orbit.positionAt(START_DAYS_SINCE_J2000, helio);
  place();

  return planet;
}

export function createPlanets() {
  const group = new THREE.Group();
  group.name = 'planets';

  // Planet katai ikut list yang sama (biar mode skala, orbit, label, dan klik otomatis jalan),
  // bedanya ditandai lewat data.kind
  const list = [...planetData, ...dwarfPlanets].map((data, i) => {
    const planet = createPlanet(data, i);
    group.add(planet.root);
    return planet;
  });

  return {
    group,
    list,
    get: (id) => list.find((p) => p.data.id === id) ?? null,
    applyScale(k) {
      for (const p of list) p.applyScale(k);
    },
    update(simDays) {
      for (const p of list) p.update(simDays);
    }
  };
}
