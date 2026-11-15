import * as THREE from 'three';
import { nearbyStars } from '../data/nearbyStars.js';

// Bintang tetangga Matahari di galaxyScene (data di data/nearbyStars.js)
//
// Satu THREE.Points di grup isi galaksi, posisinya = posisi Matahari di koordinat galaksi + arah
// bintang x jaraknya (1 unit = 100 tahun cahaya), jadi ikut berputar bareng Matahari.
// Ukurannya tetap di layar (bukan ikut jarak): ini penanda bintang yang bisa diklik, bukan partikel.
// Warna dari kelas spektral, ukuran dan kecerahan dari jenisnya (raksasa dan bintang A paling besar,
// katai merah paling kecil). Nama cuma ditampilkan buat bintang paling terkenal (labeled) dan bintang
// yang sedang dipilih

const SPECTRAL_COLOR = {
  O: '#9db4ff',
  B: '#a9c1ff',
  A: '#d5e0ff',
  F: '#f8f7ff',
  G: '#fff1d6',
  K: '#ffd2a1',
  M: '#ffb07a'
};

// Ukuran titik (piksel CSS) dan kecerahan tiap jenis
function lookOf(star) {
  if (star.giant || star.type === 'A' || star.type === 'B' || star.type === 'O') return { size: 9, brightness: 1.6 };
  if (star.type === 'F' || star.type === 'G') return { size: 7, brightness: 1.35 };
  if (star.type === 'K') return { size: 6, brightness: 1.15 };
  return { size: 5, brightness: 0.95 };
}

// Klik dianggap kena bintang kalau jaraknya ke kursor (piksel CSS) segini atau kurang
const PICK_RADIUS = 16;
// Label di kanan titik, segini piksel dari pusatnya
const LABEL_OFFSET = 9;
// Jarak minimal antar label (piksel). Label yang tabrakan disembunyikan, yang lebih dekat ke Matahari menang
const LABEL_GAP = 4;
// Bintang baru bisa diklik dan labelnya tampil kalau opacity-nya sudah segini
const INTERACTIVE_OPACITY = 0.5;

const vertexShader = /* glsl */ `
  attribute float size;
  attribute float brightness;
  attribute float starIndex;
  uniform float uPixelRatio;
  uniform float uSelected;
  varying vec3 vColor;
  varying float vSelected;
  void main() {
    vColor = color * brightness;
    vSelected = abs(starIndex - uSelected) < 0.5 ? 1.0 : 0.0;
    // Bintang yang dipilih digambar lebih besar biar ada ruang buat cincin penanda
    gl_PointSize = size * uPixelRatio * (vSelected > 0.5 ? 3.2 : 1.0);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uOpacity;
  varying vec3 vColor;
  varying float vSelected;
  void main() {
    // r = 0 di tengah, 1 di tepi kotak titik
    float r = length(gl_PointCoord - 0.5) * 2.0;
    // Bintang yang dipilih: titiknya mengecil ke tengah, ditambah cincin tipis
    float rr = vSelected > 0.5 ? r * 3.2 : r;
    float core = exp(-rr * rr * 9.0) + exp(-rr * rr * 2.5) * 0.25;
    core *= 1.0 - smoothstep(0.7, 1.0, rr);
    float ring = vSelected * (1.0 - smoothstep(0.0, 0.05, abs(r - 0.8))) * 0.8;
    vec3 color = vColor * core + vec3(1.0, 0.75, 0.45) * ring;
    float alpha = max(core, ring) * uOpacity;
    if (alpha < 0.005) discard;
    gl_FragColor = vec4(color * uOpacity, 1.0);
  }
`;

export function createNearbyStars({ pixelRatio = 1, sunLocal }) {
  const count = nearbyStars.length;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const brightness = new Float32Array(count);
  const indices = new Float32Array(count);
  const color = new THREE.Color();

  nearbyStars.forEach((star, i) => {
    const distance = star.distanceLy / 100;
    positions[i * 3] = sunLocal.x + star.direction[0] * distance;
    positions[i * 3 + 1] = sunLocal.y + star.direction[1] * distance;
    positions[i * 3 + 2] = sunLocal.z + star.direction[2] * distance;
    color.set(SPECTRAL_COLOR[star.type] ?? SPECTRAL_COLOR.G);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
    const look = lookOf(star);
    sizes[i] = look.size;
    brightness[i] = look.brightness;
    indices[i] = i;
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('brightness', new THREE.BufferAttribute(brightness, 1));
  geometry.setAttribute('starIndex', new THREE.BufferAttribute(indices, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uPixelRatio: { value: pixelRatio },
      uOpacity: { value: 0 },
      uSelected: { value: -1 }
    },
    vertexShader,
    fragmentShader,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    // Penanda yang bisa diklik, harus selalu kelihatan di atas partikel galaksi
    depthTest: false,
    blending: THREE.AdditiveBlending
  });

  const points = new THREE.Points(geometry, material);
  points.name = 'nearby-stars';
  points.renderOrder = 6;
  points.frustumCulled = false;
  points.visible = false;

  // Label HTML. Dibuat buat semua bintang, tapi yang tampil cuma yang berlabel dan yang dipilih
  const layer = document.createElement('div');
  layer.className = 'nearby-star-layer';
  layer.setAttribute('aria-hidden', 'true');
  document.body.appendChild(layer);
  const labels = nearbyStars.map((star) => {
    const element = document.createElement('div');
    element.className = 'nearby-star-label';
    element.textContent = star.name;
    element.hidden = true;
    layer.appendChild(element);
    return { element, width: star.name.length * 7 + 4, height: 14, measured: false, transform: '' };
  });

  // Posisi tiap bintang di layar (piksel CSS), diisi update(). null kalau di belakang kamera / di luar layar
  const screen = nearbyStars.map(() => ({ x: 0, y: 0, visible: false }));
  const world = new THREE.Vector3();
  let opacity = 0;
  let labelEnabled = true;
  let selectedIndex = -1;
  let lastLayerOpacity = '';

  function updateLabels(width, height) {
    const showLabels = labelEnabled && opacity >= INTERACTIVE_OPACITY;
    const placed = [];
    // Urutan data sudah dari yang terdekat, jadi yang lebih dekat menang kalau tabrakan.
    // Bintang yang dipilih selalu didahulukan
    const order = nearbyStars.map((_, i) => i);
    if (selectedIndex >= 0) order.unshift(...order.splice(selectedIndex, 1));
    for (const i of order) {
      const label = labels[i];
      const star = nearbyStars[i];
      const s = screen[i];
      let show = showLabels && s.visible && (star.labeled || i === selectedIndex);
      if (show && !label.measured && label.element.offsetWidth > 0) {
        label.width = label.element.offsetWidth;
        label.height = label.element.offsetHeight;
        label.measured = true;
      }
      const box = { x: s.x + LABEL_OFFSET, y: s.y - label.height / 2, w: label.width, h: label.height };
      if (show && (box.x + box.w > width - 4 || box.y < 4 || box.y + box.h > height - 4)) show = false;
      if (
        show &&
        placed.some((p) => box.x < p.x + p.w + LABEL_GAP && p.x < box.x + box.w + LABEL_GAP && box.y < p.y + p.h + LABEL_GAP && p.y < box.y + box.h + LABEL_GAP)
      ) {
        show = false;
      }
      if (show) placed.push(box);
      if (label.element.hidden === show) label.element.hidden = !show;
      if (!show) continue;
      const transform = `translate(${box.x.toFixed(1)}px, ${box.y.toFixed(1)}px)`;
      if (transform !== label.transform) {
        label.element.style.transform = transform;
        label.transform = transform;
      }
      label.element.classList.toggle('is-selected', i === selectedIndex);
    }
    // Semua label memudar bareng lewat layer-nya
    const layerOpacity = opacity.toFixed(2);
    if (layerOpacity !== lastLayerOpacity) {
      layer.style.opacity = layerOpacity;
      lastLayerOpacity = layerOpacity;
    }
  }

  return {
    points,
    list: nearbyStars,
    get interactive() {
      return opacity >= INTERACTIVE_OPACITY;
    },
    setPixelRatio(ratio) {
      material.uniforms.uPixelRatio.value = ratio;
    },
    setLabelEnabled(value) {
      labelEnabled = value;
    },
    setSelected(id) {
      selectedIndex = id ? nearbyStars.findIndex((s) => s.id === id) : -1;
      material.uniforms.uSelected.value = selectedIndex;
    },
    // Bintang terdekat dari titik layar (piksel CSS) dalam PICK_RADIUS, atau null
    pick(x, y) {
      if (opacity < INTERACTIVE_OPACITY) return null;
      let best = null;
      let bestDistance = PICK_RADIUS;
      nearbyStars.forEach((star, i) => {
        const s = screen[i];
        if (!s.visible) return;
        const d = Math.hypot(s.x - x, s.y - y);
        if (d <= bestDistance) {
          bestDistance = d;
          best = star;
        }
      });
      return best;
    },
    // camera = kamera galaksi (matrix sudah final), opacity 0 sampai 1 dari zoomLevel
    update({ camera, opacity: nextOpacity, width, height }) {
      opacity = nextOpacity;
      material.uniforms.uOpacity.value = opacity;
      points.visible = opacity > 0;
      if (opacity <= 0) {
        if (!layer.hidden) layer.hidden = true;
        return;
      }
      if (layer.hidden) layer.hidden = false;
      points.updateWorldMatrix(true, false);
      nearbyStars.forEach((_, i) => {
        world.fromArray(positions, i * 3).applyMatrix4(points.matrixWorld).project(camera);
        const s = screen[i];
        s.visible = world.z < 1 && Math.abs(world.x) <= 1 && Math.abs(world.y) <= 1;
        s.x = ((world.x + 1) / 2) * width;
        s.y = ((1 - world.y) / 2) * height;
      });
      updateLabels(width, height);
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      layer.remove();
    }
  };
}
