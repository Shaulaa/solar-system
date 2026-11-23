import * as THREE from 'three';
import { localGroup, localGroupPosition, dwarfGalaxies } from '../data/localGroup.js';
import { createParticleMaterial, setMaterialPixelRatio } from './galaxyShaders.js';

// Galaksi Grup Lokal di galaxyScene (data di data/localGroup.js)
//
// Ditaruh di grup `galaxy` (bukan `content` yang berputar), jadi galaksi lain diam di tempatnya
// waktu Bima Sakti berputar. Tiap galaksi punya anchor sendiri: posisi dari arah langit x jarak,
// orientasi dari kemiringan dan sudut posisi piringannya. Partikelnya dibuat sekali di Web Worker
// (workers/localGroupWorker.js), lazy, setelah partikel Bima Sakti siap.
//
// Satu material bintang dipakai semua galaksi, shader-nya sama persis dengan bintang Bima Sakti
// (program WebGL-nya dipakai ulang, gak ada kompilasi baru). Ekstinksi debu dimatikan: lapisan debu
// di shader itu ada di koordinat Bima Sakti, sedangkan partikel di sini pakai koordinat lokal galaksinya.
// Galaksi ini selalu dilihat dari ribuan unit, jadi semua partikelnya jauh di bawah 2 px dan gak perlu
// debu atau gas: kecerahan total diatur lewat ukuran partikel di worker
//
// Label nama (HTML) dan klik bekerja di tahap Grup Lokal, termasuk label "Bima Sakti" yang
// partikelnya tetap dari galaxyScene.
//
// Dua tambahan khusus tahap Grup Lokal, biar galaksi yang di sana cuma puluhan piksel tetap terbaca:
//   pendar   satu titik gas lembut per galaksi (termasuk Bima Sakti), muncul bareng tahap Grup Lokal.
//            Sebelumnya disembunyikan: dari dalam Bima Sakti pendar pusat galaksi bakal jadi gumpalan raksasa
//   kerdil   25 galaksi kerdil asli sebagai bercak redup (partikel dari worker yang sama, satu komponen)

// Kecerahan dasar dan fluks acuan Bima Sakti: jumlah (kecerahan x ukuran^2) semua partikel bintang
// Bima Sakti, dinormalkan ke 500 ribu partikel dengan kecerahan BRIGHTNESS galaxyParticles.js.
// Diukur langsung dari keluaran workers/galaxyWorker.js (111.583 di 500 ribu, 111.090 di 100 ribu)
const BRIGHTNESS = 0.9;
const REFERENCE_FLUX = 111_500;
const APPEAR_SECONDS = 1.2;
const SEED = 20261123;

// Klik kena galaksi kalau jaraknya ke pusat galaksi di layar segini piksel CSS atau kurang,
// atau di dalam 80% jari jarinya di layar kalau lebih besar
const PICK_RADIUS = 18;
const PICK_DISK = 0.8;
// Label di kanan pusat galaksi, sejauh setengah jari jarinya di layar (dibatasi segini piksel)
const LABEL_OFFSET = { min: 12, max: 80 };
const LABEL_GAP = 4;
const INTERACTIVE_OPACITY = 0.5;
// Ruang di tepi bingkai Grup Lokal, kelipatan bola terkecil yang memuat semuanya
const FRAME_MARGIN = 1.05;
// Pendar galaksi: diameter titik (kelipatan jari jari galaksi), warna (linear RGB), dan kecerahannya
const HALO = { size: 2.4, color: [1.0, 0.86, 0.72], brightness: 0.16 };
// Jari jari Bima Sakti buat bingkai dan klik (unit galaksi), sama dengan bingkai galaksi utuh
const MILKY_WAY_RADIUS = 540;

// Bola kecil (belum tentu terkecil) yang memuat semua galaksi: dua galaksi yang tepinya paling
// berjauhan jadi diameter awal, lalu diperbesar kalau masih ada yang keluar
function boundingSphere(members) {
  const center = new THREE.Vector3();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  let radius = 0;
  for (const p of members) {
    for (const q of members) {
      const span = p.position.distanceTo(q.position) + p.radius + q.radius;
      if (span / 2 <= radius || p === q) continue;
      const direction = b.subVectors(q.position, p.position).normalize();
      a.copy(p.position).addScaledVector(direction, -p.radius);
      center.copy(q.position).addScaledVector(direction, q.radius).add(a).multiplyScalar(0.5);
      radius = span / 2;
    }
  }
  for (const p of members) radius = Math.max(radius, center.distanceTo(p.position) + p.radius);
  return { center, radius };
}

export function createLocalGroup({ pixelRatio = 1, sunLocal }) {
  const group = new THREE.Group();
  group.name = 'local-group';

  const material = createParticleMaterial('star', { brightness: BRIGHTNESS, pixelRatio });
  material.uniforms.uExtinction.value = 0;

  const basis = new THREE.Matrix4();
  const members = localGroup.map((data) => {
    const anchor = new THREE.Object3D();
    anchor.name = `local-group-${data.id}`;
    anchor.position.fromArray(localGroupPosition(data, sunLocal.toArray()));
    if (data.orientation) {
      const major = new THREE.Vector3().fromArray(data.orientation.major);
      const normal = new THREE.Vector3().fromArray(data.orientation.normal);
      basis.makeBasis(major, normal, new THREE.Vector3().crossVectors(major, normal));
      anchor.quaternion.setFromRotationMatrix(basis);
    }
    group.add(anchor);
    return {
      data,
      anchor,
      position: anchor.position,
      radius: data.shape?.radius ?? MILKY_WAY_RADIUS,
      screen: { x: 0, y: 0, radius: 0, visible: false }
    };
  });

  const frame = boundingSphere(members);
  const frameRadius = frame.radius * FRAME_MARGIN;
  const dwarfs = dwarfGalaxies(sunLocal.toArray());

  // Pendar: satu vertex per galaksi, material gas yang sama dengan gumpalan gas Bima Sakti (glow)
  const haloMaterial = createParticleMaterial('glow', { brightness: HALO.brightness, pixelRatio });
  haloMaterial.uniforms.uExtinction.value = 0;
  const haloGeometry = new THREE.BufferGeometry();
  haloGeometry.setAttribute('position', new THREE.Float32BufferAttribute(members.flatMap((m) => m.position.toArray()), 3));
  haloGeometry.setAttribute('color', new THREE.Float32BufferAttribute(members.flatMap(() => HALO.color), 3));
  haloGeometry.setAttribute('size', new THREE.Float32BufferAttribute(members.map((m) => m.radius * HALO.size), 1));
  haloGeometry.setAttribute('seed', new THREE.Float32BufferAttribute(members.map(() => 0.5), 1));
  const halos = new THREE.Points(haloGeometry, haloMaterial);
  halos.name = 'local-group-halos';
  halos.frustumCulled = false;
  halos.visible = false;
  group.add(halos);

  // idle -> generating -> warming -> ready (atau error), sama dengan galaxyParticles.js.
  // Selama pemanasan satu galaksi per frame mulai digambar (opacity 0) biar upload ke GPU gak numpuk
  let state = 'idle';
  const pointsList = [];
  const geometries = [];
  let warmIndex = 0;
  let appear = 0;

  function build(components) {
    for (const c of components) {
      // Galaksi kerdil posisinya sudah di koordinat grup, sisanya di koordinat lokal galaksinya
      const parent = c.name === 'dwarfs' ? group : members.find((m) => m.data.id === c.name)?.anchor;
      if (!parent) continue;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(c.position, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(c.color, 3));
      geometry.setAttribute('size', new THREE.BufferAttribute(c.size, 1));
      geometry.setAttribute('seed', new THREE.BufferAttribute(c.seed, 1));
      geometry.computeBoundingSphere();
      geometries.push(geometry);
      const points = new THREE.Points(geometry, material);
      points.name = `local-group-${c.name}-particles`;
      points.visible = false;
      points.frustumCulled = false;
      parent.add(points);
      pointsList.push(points);
    }
  }

  // Mulai generate di worker. Aman dipanggil berkali kali, worker cuma dijalankan sekali.
  // scale = pengali jumlah partikel (HP lebih sedikit, lihat main.js)
  function generate(scale) {
    if (state !== 'idle') return;
    state = 'generating';
    const worker = new Worker(new URL('../workers/localGroupWorker.js', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }) => {
      build(data.components);
      worker.terminate();
      warmIndex = 0;
      state = 'warming';
    };
    worker.onerror = (event) => {
      event.preventDefault();
      worker.terminate();
      state = 'error';
    };
    worker.postMessage({
      galaxies: localGroup.filter((g) => g.shape).map((g) => ({ id: g.id, shape: g.shape })),
      dwarfs: dwarfs.map(({ position, radius }) => ({ position, radius })),
      scale,
      seed: SEED,
      referenceFlux: REFERENCE_FLUX
    });
  }

  // Label HTML, gaya sama dengan label bintang tetangga
  const layer = document.createElement('div');
  layer.className = 'nearby-star-layer';
  layer.setAttribute('aria-hidden', 'true');
  layer.hidden = true;
  document.body.appendChild(layer);
  const labels = members.map((member) => {
    const element = document.createElement('div');
    element.className = 'nearby-star-label local-group-label';
    element.textContent = member.data.name;
    element.hidden = true;
    layer.appendChild(element);
    return { element, width: member.data.name.length * 8 + 4, height: 15, measured: false, transform: '' };
  });
  // Urutan prioritas label (yang lebih penting menang kalau tabrakan)
  const byPriority = members.map((_, i) => i).sort((a, b) => members[b].data.labelPriority - members[a].data.labelPriority);

  let labelOpacity = 0;
  let labelEnabled = true;
  let selectedIndex = -1;
  let lastLayerOpacity = '';

  function updateLabels(width, height) {
    const show = labelEnabled && labelOpacity >= INTERACTIVE_OPACITY;
    if (layer.hidden === show) layer.hidden = !show;
    if (!show) return;
    const placed = [];
    const order = selectedIndex >= 0 ? [selectedIndex, ...byPriority.filter((i) => i !== selectedIndex)] : byPriority;
    for (const i of order) {
      const label = labels[i];
      const s = members[i].screen;
      let visible = s.visible;
      if (visible && !label.measured && label.element.offsetWidth > 0) {
        label.width = label.element.offsetWidth;
        label.height = label.element.offsetHeight;
        label.measured = true;
      }
      const offset = THREE.MathUtils.clamp(s.radius * 0.5, LABEL_OFFSET.min, LABEL_OFFSET.max);
      const box = { x: s.x + offset, y: s.y - label.height / 2, w: label.width, h: label.height };
      if (visible && (box.x + box.w > width - 4 || box.y < 4 || box.y + box.h > height - 4)) visible = false;
      if (
        visible &&
        placed.some((p) => box.x < p.x + p.w + LABEL_GAP && p.x < box.x + box.w + LABEL_GAP && box.y < p.y + p.h + LABEL_GAP && p.y < box.y + box.h + LABEL_GAP)
      ) {
        visible = false;
      }
      if (visible) placed.push(box);
      if (label.element.hidden === visible) label.element.hidden = !visible;
      if (!visible) continue;
      const transform = `translate(${box.x.toFixed(1)}px, ${box.y.toFixed(1)}px)`;
      if (transform !== label.transform) {
        label.element.style.transform = transform;
        label.transform = transform;
      }
      label.element.classList.toggle('is-selected', i === selectedIndex);
    }
    const layerOpacity = labelOpacity.toFixed(2);
    if (layerOpacity !== lastLayerOpacity) {
      layer.style.opacity = layerOpacity;
      lastLayerOpacity = layerOpacity;
    }
  }

  const world = new THREE.Vector3();
  const view = new THREE.Vector3();

  return {
    group,
    list: members.map((m) => m.data),
    // Pusat dan jari jari bingkai Grup Lokal di koordinat grup `galaxy` (galaxyScene.js)
    center: frame.center,
    frameRadius,
    generate,
    get state() {
      return state;
    },
    get interactive() {
      return labelOpacity >= INTERACTIVE_OPACITY;
    },
    setPixelRatio(ratio) {
      setMaterialPixelRatio(material, ratio);
      setMaterialPixelRatio(haloMaterial, ratio);
    },
    setLabelEnabled(value) {
      labelEnabled = value;
    },
    setSelected(id) {
      selectedIndex = id ? members.findIndex((m) => m.data.id === id) : -1;
    },
    // Galaksi yang paling dekat dengan titik layar (piksel CSS), atau null
    pick(x, y) {
      if (labelOpacity < INTERACTIVE_OPACITY) return null;
      let best = null;
      let bestScore = 1;
      for (const member of members) {
        const s = member.screen;
        if (!s.visible) continue;
        const reach = Math.max(PICK_RADIUS, s.radius * PICK_DISK);
        const score = Math.hypot(s.x - x, s.y - y) / reach;
        if (score <= bestScore) {
          bestScore = score;
          best = member.data;
        }
      }
      return best;
    },
    // camera = kamera galaksi (matrix sudah final). opacity = partikel, halo = pendar, labels = label dan
    // klik (semuanya 0 sampai 1). viewportHeight dalam piksel device, width / height CSS
    update({ camera, opacity, halo, labels: nextLabelOpacity, delta, viewportHeight, width, height }) {
      labelOpacity = nextLabelOpacity;
      if (state === 'warming' && warmIndex >= pointsList.length) {
        for (const points of pointsList) points.frustumCulled = true;
        state = 'ready';
      }
      // Transisi muncul setelah data siap (0 sampai 1), dipakai partikel dan pendar
      let shown = 0;
      if (state === 'warming') {
        pointsList[warmIndex].visible = true;
        warmIndex++;
      } else if (state === 'ready') {
        appear = Math.min(appear + delta / APPEAR_SECONDS, 1);
        shown = appear * appear * (3 - 2 * appear);
      }
      const alpha = opacity * shown;
      const haloAlpha = halo * shown;
      halos.visible = haloAlpha > 0;
      group.visible = state === 'warming' || alpha > 0 || halos.visible;
      const tanHalfFov = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const pixelScale = viewportHeight / (2 * tanHalfFov);
      material.uniforms.uOpacity.value = alpha;
      material.uniforms.uPixelScale.value = pixelScale;
      haloMaterial.uniforms.uOpacity.value = haloAlpha;
      haloMaterial.uniforms.uPixelScale.value = pixelScale;

      if (labelOpacity <= 0) {
        if (!layer.hidden) layer.hidden = true;
        return;
      }
      // Posisi dan jari jari tiap galaksi di layar, buat label dan klik
      const cssScale = height / (2 * tanHalfFov);
      group.updateWorldMatrix(true, true);
      for (const member of members) {
        member.anchor.getWorldPosition(world);
        view.copy(world).applyMatrix4(camera.matrixWorldInverse);
        world.project(camera);
        const s = member.screen;
        s.visible = view.z < 0 && Math.abs(world.x) <= 1 && Math.abs(world.y) <= 1;
        s.x = ((world.x + 1) / 2) * width;
        s.y = ((1 - world.y) / 2) * height;
        s.radius = (member.radius * cssScale) / Math.max(-view.z, 1e-6);
      }
      updateLabels(width, height);
    },
    dispose() {
      for (const geometry of geometries) geometry.dispose();
      haloGeometry.dispose();
      material.dispose();
      haloMaterial.dispose();
      layer.remove();
    }
  };
}
