import * as THREE from 'three';
import { createParticleMaterial, setMaterialPixelRatio } from './galaxyShaders.js';

// Partikel galaksi dari Web Worker (workers/galaxyWorker.js)
//
// Generate cuma sekali, dan baru waktu dibutuhkan (lazy). Selama worker jalan halaman tetap
// responsif. Hasilnya satu THREE.Points per komponen. Komponen bintang (bulge, batang, lengan,
// piringan, halo, nebula) berbagi satu material, gumpalan gas dan debu punya material sendiri
//
// Urutan gambar: bintang dulu, lalu gas, lalu debu (NormalBlending) yang menutupi cahaya di bawahnya
//
// Setelah data datang ada fase pemanasan: satu komponen digambar per frame dengan opacity 0.
// Kalau semua digambar pertama kali di frame yang sama, kompilasi shader plus upload sekitar 16 MB
// data partikel ke GPU bikin satu frame macet sekitar 50 ms (terukur, 2 dari 11 run). Opacity 0
// gak mengubah layar (additive nambah 0, debu alpha 0), dan selama pemanasan frustum culling
// dimatikan biar komponen di luar pandangan tetap ke-upload

// Kecerahan dasar. Dikalibrasi dari tampilan atas galaksi utuh di 1366x768 dengan REFERENCE_TOTAL
// partikel. Kalau partikelnya lebih sedikit (HP, desktop low), tiap partikel mewakili lebih banyak
// bintang, jadi kecerahannya dikali sebanding. Kecerahan galaksi secara keseluruhan sama di semua
// perangkat, cuma lebih kasar butirannya
const BRIGHTNESS = 0.9;
const REFERENCE_TOTAL = 500_000;
// Gumpalan gas cuma ngasih semburat warna, jauh lebih redup dari bintang
const GLOW_BRIGHTNESS = 0.035;
const GLOW_REFERENCE = 180;
// Setelah data siap, galaksi muncul pelan pelan segini detik (bukan langsung nongol)
const APPEAR_SECONDS = 0.8;
const SEED = 20261115;

// Komponen ke jenis material dan urutan gambar
const MATERIAL_OF = { glow: 'glow', dust: 'dust' };
const RENDER_ORDER = { star: 0, glow: 1, dust: 2 };

export function createGalaxyParticles({ pixelRatio }) {
  const group = new THREE.Group();
  group.name = 'galaxy-particles';
  group.visible = false;

  const materials = {
    star: createParticleMaterial('star', { brightness: BRIGHTNESS, pixelRatio }),
    glow: createParticleMaterial('glow', { brightness: GLOW_BRIGHTNESS, pixelRatio }),
    dust: createParticleMaterial('dust', { pixelRatio })
  };
  const materialList = Object.values(materials);
  const geometries = [];

  // idle -> generating -> warming -> ready (atau error)
  let state = 'idle';
  let warmIndex = 0;
  let appear = 0;
  let opacity = 0;
  // Angka buat laporan / debug: lama generate di worker, total sampai data diterima, dan
  // lama main thread bikin geometry
  const stats = { count: 0, workerMs: null, roundTripMs: null, buildMs: null };

  function build(components, total) {
    const start = performance.now();
    for (const c of components) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(c.position, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(c.color, 3));
      geometry.setAttribute('size', new THREE.BufferAttribute(c.size, 1));
      geometry.setAttribute('seed', new THREE.BufferAttribute(c.seed, 1));
      geometry.computeBoundingSphere();
      geometries.push(geometry);

      const kind = MATERIAL_OF[c.name] ?? 'star';
      const points = new THREE.Points(geometry, materials[kind]);
      points.name = `galaxy-${c.name}`;
      points.renderOrder = RENDER_ORDER[kind];
      group.add(points);
      stats.count += c.count;

      if (kind === 'glow') {
        materials.glow.uniforms.uBrightness.value = (GLOW_BRIGHTNESS * GLOW_REFERENCE) / c.count;
      }
    }
    const scale = REFERENCE_TOTAL / total;
    materials.star.uniforms.uBrightness.value = BRIGHTNESS * scale;
    // Debu yang lebih sedikit dibikin lebih pekat per partikel (maksimal pekat penuh)
    const dustAlpha = materials.dust.uniforms.uDustAlpha;
    dustAlpha.value = Math.min(dustAlpha.value * scale, 1);
    stats.buildMs = performance.now() - start;
  }

  // Mulai generate di worker. Aman dipanggil berkali kali, worker cuma dijalankan sekali
  function generate(total) {
    if (state !== 'idle') return;
    state = 'generating';
    const start = performance.now();
    const worker = new Worker(new URL('../workers/galaxyWorker.js', import.meta.url), {
      type: 'module'
    });
    worker.onmessage = ({ data }) => {
      stats.workerMs = data.ms;
      stats.roundTripMs = performance.now() - start;
      build(data.components, total);
      worker.terminate();
      for (const points of group.children) {
        points.visible = false;
        points.frustumCulled = false;
      }
      warmIndex = 0;
      state = 'warming';
    };
    worker.onerror = (event) => {
      event.preventDefault();
      worker.terminate();
      state = 'error';
    };
    worker.postMessage({ total, seed: SEED });
  }

  const cameraLocal = new THREE.Vector3();

  // Objek dummy satu vertex untuk tiap material, atributnya sama dengan partikel asli.
  // Dipakai buat ngompilasi shader duluan (renderer.compileAsync), sebelum partikelnya ada
  function createWarmupObjects() {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute([1, 1, 1], 3));
    geometry.setAttribute('size', new THREE.Float32BufferAttribute([1], 1));
    geometry.setAttribute('seed', new THREE.Float32BufferAttribute([0], 1));
    const warmup = new THREE.Group();
    for (const material of materialList) warmup.add(new THREE.Points(geometry, material));
    return { group: warmup, dispose: () => geometry.dispose() };
  }

  return {
    createWarmupObjects,
    group,
    generate,
    stats,
    materials,
    get state() {
      return state;
    },
    // 0 sampai 1 dari zoomLevel. Dikali transisi muncul setelah data siap dan pemanasan selesai
    setOpacity(alpha) {
      opacity = alpha;
    },
    setPixelRatio(ratio) {
      for (const material of materialList) setMaterialPixelRatio(material, ratio);
    },
    // camera = kamera galaksi, viewportHeight = tinggi drawing buffer dalam piksel device.
    // Posisi kamera diubah ke koordinat galaksi buat ekstinksi dan debu di shader
    update(delta, camera, viewportHeight) {
      group.updateWorldMatrix(true, false);
      group.worldToLocal(cameraLocal.copy(camera.position));
      let alpha = 0;
      if (state === 'warming' && warmIndex >= group.children.length) {
        // Semua komponen sudah digambar sekali (frame sebelumnya), culling dinyalakan lagi
        for (const points of group.children) points.frustumCulled = true;
        state = 'ready';
      }
      if (state === 'warming') {
        group.children[warmIndex].visible = true;
        warmIndex++;
        group.visible = true;
      } else {
        if (state === 'ready') appear = Math.min(appear + delta / APPEAR_SECONDS, 1);
        alpha = opacity * appear * appear * (3 - 2 * appear);
        group.visible = alpha > 0;
      }
      const tanHalfFov = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const pixelScale = viewportHeight / (2 * tanHalfFov);
      for (const material of materialList) {
        material.uniforms.uOpacity.value = alpha;
        material.uniforms.uPixelScale.value = pixelScale;
        material.uniforms.uCameraLocal.value.copy(cameraLocal);
      }
    },
    dispose() {
      for (const geometry of geometries) geometry.dispose();
      for (const material of materialList) material.dispose();
    }
  };
}
