import * as THREE from 'three';
import { planets as planetData, dwarfPlanets, comets, asteroids } from '../data/planets.js';
import { createPlanetTexture } from '../utils/planetTexture.js';
import { loadTexture, assignTexture } from '../utils/loader.js';
import { scaleDistance, scaleRadius, blendScale } from '../utils/scale.js';
import { createKeplerOrbit } from '../utils/kepler.js';
import { START_DAYS_SINCE_J2000 } from '../utils/time.js';
import { createEarth } from './earth.js';
import { createPlanetRing } from './planetRing.js';
import { createComet } from './comet.js';

const DEG = Math.PI / 180;

// Kecepatan rotasi di-scale terpisah dari revolusi
// Kalo pake angka asli, di 10 hari per detik Bumi bakal muter 10 kali per detik dan bikin pusing
const ROTATION_SCALE = 0.04;
// Jarak (AU) asteroid ke Bumi yang dianggap "lagi lewat dekat", sekitar dua kali jarak Bulan
const CLOSE_RANGE = 0.005;

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
  // Benda yang gak bulat (Haumea): tiga sumbunya dikali ellipsoid, sumbu Y = sumbu putar
  if (data.ellipsoid) mesh.scale.fromArray(data.ellipsoid);
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
  // tilt null = kemiringan sumbunya belum diketahui pasti, digambar tegak (panel info gak nampilin barisnya)
  tiltGroup.rotation.z = (data.tilt ?? 0) * DEG;
  anchor.add(tiltGroup);

  let body;
  if (data.id === 'earth') body = createEarth(data, radius, seed);
  else if (data.kind === 'comet') body = createComet(data, radius, seed);
  else body = createBody(data, radius, seed);
  tiltGroup.add(body.group);
  // Koma dan ekor komet ditempel ke anchor, gak ikut skala radius inti di tiltGroup
  if (body.attachment) anchor.add(body.attachment);

  const ring = data.ring ? createPlanetRing(data.ring, radius) : null;
  if (ring) tiltGroup.add(ring.mesh);

  // Radius terluar benda (kelipatan radius planet): tepi cincin Saturnus, atmosfer Bumi, atau permukaannya.
  // Dipakai kamera biar seluruh benda muat di layar waktu difokus
  const boundingScale = Math.max(data.ring?.outer ?? 1, body.boundingScale ?? 1);

  // Posisi heliosentris dalam AU, diisi update(). velocity cuma dipakai komet (arah ekor debu)
  const helio = new THREE.Vector3();
  const velocity = body.updateSun ? new THREE.Vector3() : null;
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
      // Komet: koma yang ukurannya berubah sesuai jarak ke Matahari
      if (body.boundingRadius) return Math.max(planet.radius, body.boundingRadius());
      // Asteroid yang lagi lewat dekat Bumi: kamera mundur sampai Bumi ikut kelihatan (lihat createPlanets)
      return Math.max(planet.radius * boundingScale, planet.companionRadius?.() ?? 0);
    },
    // Posisi heliosentris sekarang (AU), jangan diubah dari luar
    helio,
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
      ring?.update();
      if (velocity) {
        orbit.positionAt(START_DAYS_SINCE_J2000 + simDays + 1, velocity).sub(helio);
        body.updateSun(helio, velocity, k, scaleDistanceAt);
      }
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

  // Planet katai dan komet ikut list yang sama (biar mode skala, orbit, label, dan klik otomatis jalan),
  // bedanya ditandai lewat data.kind
  const list = [...planetData, ...dwarfPlanets, ...comets, ...asteroids].map((data, i) => {
    const planet = createPlanet(data, i);
    group.add(planet.root);
    return planet;
  });

  // Benda dengan closeApproach (Apophis): selama jaraknya ke Bumi di bawah CLOSE_RANGE AU, radius fokusnya
  // dilebarkan sampai mencakup Bumi, jadi waktu difokus pas lewat, Bumi ikut masuk bingkai.
  // Jarak AU diubah ke unit scene pakai perbandingan jarak benda itu sendiri (sama di sekitar 1 AU)
  const earth = list.find((p) => p.data.id === 'earth');
  for (const planet of list) {
    if (!planet.data.closeApproach) continue;
    planet.companionRadius = () => {
      const au = planet.helio.distanceTo(earth.helio);
      if (au > CLOSE_RANGE) return 0;
      return au * (planet.distance / planet.helio.length()) * 1.15 + earth.radius;
    };
  }

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
