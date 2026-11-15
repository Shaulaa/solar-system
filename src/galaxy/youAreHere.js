import * as THREE from 'three';

// Penanda "Kamu di sini" di posisi Matahari pada galaxyScene (galaxy.sunPosition, ikut berputar
// bersama galaksi). Cincin tipis berdenyut + titik tengah (THREE.Points satu vertex, ukurannya tetap
// di layar) dan label teks HTML yang posisinya diproyeksikan tiap frame.
//
// Titik tengah dan cincin + label punya opacity sendiri sendiri. Titiknya (Matahari sebagai bintang)
// menggantikan titik bintang Matahari dari scene tata surya. Cincin dan labelnya baru muncul waktu
// piringan galaksi sudah kelihatan mengelilingi Matahari, kalau lebih awal penandanya kelihatan
// mengambang di ruang kosong (lihat STAGES di zoomLevels.js)

// Ukuran kotak penanda dalam piksel CSS
const MARKER_SIZE = 44;
// Satu denyut segini detik
const PULSE_SECONDS = 2.4;
// Label digeser ke kanan cincin, segini piksel dari titik tengah. Kalau mentok tepi kanan layar
// pindah ke kiri cincin, dan selalu dijaga minimal LABEL_MARGIN dari tepi layar
const LABEL_OFFSET = 18;
const LABEL_MARGIN = 8;

const vertexShader = /* glsl */ `
  uniform float uSize;
  void main() {
    gl_PointSize = uSize;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  uniform float uRingOpacity;
  uniform vec3 uColor;
  void main() {
    // r = 0 di tengah, 1 di tepi kotak titik
    float r = length(gl_PointCoord - 0.5) * 2.0;
    // Cincin diam yang tipis
    float ring = 1.0 - smoothstep(0.0, 0.06, abs(r - 0.42));
    // Cincin denyut: membesar dari cincin diam ke tepi sambil memudar
    float t = fract(uTime);
    float pulseRadius = mix(0.42, 0.95, t);
    float pulse = (1.0 - smoothstep(0.0, 0.05, abs(r - pulseRadius))) * (1.0 - t) * 0.7;
    // Titik tengah (posisi Matahari)
    float dot = 1.0 - smoothstep(0.08, 0.14, r);
    float alpha = max(max(ring * 0.9, pulse) * uRingOpacity, dot) * uOpacity;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

export function createYouAreHere({ pixelRatio = 1 } = {}) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uSize: { value: MARKER_SIZE * pixelRatio },
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uRingOpacity: { value: 0 },
      // Aksen oranye matahari dari desain (#ffb36b), dalam linear
      uColor: { value: new THREE.Color('#ffb36b') }
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    // Penanda harus selalu kelihatan, gak boleh ketutup partikel atau debu
    depthTest: false
  });

  const points = new THREE.Points(geometry, material);
  points.name = 'you-are-here';
  points.renderOrder = 10;
  points.frustumCulled = false;
  points.visible = false;

  // Label teks. Elemen HTML biasa (bukan di canvas) biar tajam dan pakai font yang sama dengan UI
  const label = document.createElement('div');
  label.className = 'you-are-here-label';
  label.textContent = 'Kamu di sini';
  label.setAttribute('aria-hidden', 'true');
  label.hidden = true;
  document.body.appendChild(label);

  let labelEnabled = true;
  // Ukuran label diukur dari DOM sekali (dan diulang waktu font selesai dimuat / layar di-resize),
  // gak tiap frame. Sebelum sempat diukur dipakai perkiraan
  let labelWidth = 110;
  let labelHeight = 14;
  let measured = false;
  const remeasure = () => {
    measured = false;
  };
  document.fonts?.ready.then(remeasure);
  window.addEventListener('resize', remeasure);
  const projected = new THREE.Vector3();
  let lastTransform = '';
  let lastOpacity = '';

  return {
    points,
    setPixelRatio(ratio) {
      material.uniforms.uSize.value = MARKER_SIZE * ratio;
    },
    // Ikut tombol label di toolbar. Cincinnya tetap tampil
    setLabelEnabled(value) {
      labelEnabled = value;
    },
    // position = galaxy.sunPosition, camera = kamera galaksi. opacity (titik) dan ringOpacity
    // (cincin + label) 0 sampai 1 dari zoomLevel
    update({ position, camera, opacity, ringOpacity, elapsed, width, height }) {
      points.position.copy(position);
      material.uniforms.uOpacity.value = opacity;
      material.uniforms.uRingOpacity.value = ringOpacity;
      material.uniforms.uTime.value = elapsed / PULSE_SECONDS;
      points.visible = opacity > 0;

      projected.copy(position).project(camera);
      const onScreen = projected.z < 1 && Math.abs(projected.x) < 1.1 && Math.abs(projected.y) < 1.1;
      const labelOpacityValue = opacity * ringOpacity;
      const showLabel = labelEnabled && labelOpacityValue > 0.01 && onScreen;
      if (label.hidden === showLabel) label.hidden = !showLabel;
      if (!showLabel) return;
      if (!measured && label.offsetWidth > 0) {
        labelWidth = label.offsetWidth;
        labelHeight = label.offsetHeight;
        measured = true;
      }

      const ringX = ((projected.x + 1) / 2) * width;
      let x = ringX + LABEL_OFFSET;
      if (x + labelWidth > width - LABEL_MARGIN) x = ringX - LABEL_OFFSET - labelWidth;
      x = THREE.MathUtils.clamp(x, LABEL_MARGIN, width - labelWidth - LABEL_MARGIN);
      const y = THREE.MathUtils.clamp(
        ((1 - projected.y) / 2) * height,
        LABEL_MARGIN + labelHeight / 2,
        height - LABEL_MARGIN - labelHeight / 2
      );
      const transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translateY(-50%)`;
      // Gaya cuma ditulis kalau berubah, biar gak nyentuh DOM tiap frame tanpa perlu
      if (transform !== lastTransform) {
        label.style.transform = transform;
        lastTransform = transform;
      }
      const labelOpacity = labelOpacityValue.toFixed(2);
      if (labelOpacity !== lastOpacity) {
        label.style.opacity = labelOpacity;
        lastOpacity = labelOpacity;
      }
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      label.remove();
      window.removeEventListener('resize', remeasure);
    }
  };
}
