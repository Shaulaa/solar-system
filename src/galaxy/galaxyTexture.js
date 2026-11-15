import * as THREE from 'three';

// Lapisan cahaya lembut di bawah partikel galaksi: ilustrasi Bima Sakti NASA/JPL-Caltech (R. Hurt),
// public/textures/milky_way_top.webp (crop persegi, pusat galaksi di tengah, 2048 px).
// Sumber: https://photojournal.jpl.nasa.gov/catalog/PIA10748
// Kredit wajib tampil selama lapisan ini dipakai (lihat main.js dan modal Tentang).
// Kalau filenya gak ada, lapisan ini dilewati dan galaksi tetap utuh dari partikel saja
//
// Ilustrasinya dilihat dari kutub utara galaksi dengan Matahari di bawah pusat. Dipetakan ke
// bidang XZ koordinat galaksi: bawah gambar ke arah Matahari (-X), kiri gambar ke arah gerak
// Matahari (-Z, bujur galaksi positif). Lalu diputar sedikit supaya batang di gambar (34 derajat
// dari garis Matahari ke pusat, diukur dari pikselnya) sejajar batang partikel (26,6 derajat)

// BASE_URL dari Vite, sama seperti utils/loader.js. Dijadikan URL lengkap karena dipakai di worker
const TEXTURE_URL = new URL(`${import.meta.env.BASE_URL}textures/milky_way_top.webp`, window.location.href).href;
// Lebar gambar dalam unit galaksi. Tepi piringan di gambar (kecerahan turun ke sepertiga, radius
// sekitar 2300 px dari 5580 px crop) disamakan dengan tepi piringan partikel (520 unit)
const SIZE = 1260;
const BAR_ALIGN = 7.4 * (Math.PI / 180);
// Cuma semburat cahaya, opacity rendah. Struktur lengan dan detail tajamnya dari partikel.
// Dengan 0,3 ilustrasi ini menyumbang sekitar 80 persen cahaya tampilan atas, dan karena lengannya
// gak berimpit dengan lengan partikel, celah partikel keisi dan lengannya kelihatan kayak cincin
const OPACITY = 0.12;
// Ukuran tekstur (px), sama dengan filenya. 2048 cukup karena lapisan ini cuma tampil dari jauh
// (lihat STAGES.galaxyTexture). Plus mipmap butuh sekitar 22 MB memori GPU. Versi 4096 (89 MB)
// bikin satu frame macet 50 sampai 83 ms waktu ANGLE mengisi nol memori tekstur barunya
const TEXTURE_SIZE = 2048;
// Diupload ke GPU satu tile tiap TILE_INTERVAL frame (1024 px = 4 MB per tile, 4 tile)
const TILE_SIZE = 1024;
const TILE_INTERVAL = 2;
// Jeda (frame) antara alokasi tekstur dan tile pertama, biar pengisian nol memori tekstur baru
// (ANGLE, Chrome di Windows) selesai di belakang dan tile pertama gak nunggu
const ALLOCATE_SETTLE_FRAMES = 20;
// Kalau user scroll cepat dan tekstur baru siap waktu sudah di tahap galaksi, munculnya pelan
// pelan segini detik (bukan langsung nongol)
const APPEAR_SECONDS = 0.8;

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldPosition;
  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPosition = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uOpacity;
  uniform vec3 uNormal;
  varying vec2 vUv;
  varying vec3 vWorldPosition;
  void main() {
    // Bidang datar yang dilihat dari samping cuma garis, dan dari dalam piringan malah jadi
    // "lantai" terang. Makin menyamping makin pudar
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    float faceOn = smoothstep(0.15, 0.5, abs(dot(viewDir, uNormal)));
    vec3 color = texture2D(uMap, vUv).rgb;
    gl_FragColor = vec4(color * uOpacity * faceOn, 1.0);
  }
`;

export function createGalaxyTexture({ renderer, anisotropy = 1 }) {
  const geometry = new THREE.PlaneGeometry(SIZE, SIZE);
  geometry.rotateX(-Math.PI / 2);
  geometry.rotateY(-Math.PI / 2 + BAR_ALIGN);

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: null },
      uOpacity: { value: 0 },
      uNormal: { value: new THREE.Vector3(0, 1, 0) }
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'galaxy-texture';
  // Digambar paling awal, partikel numpuk di atasnya
  mesh.renderOrder = -1;
  mesh.visible = false;

  // idle -> loading -> uploading -> ready (atau missing kalau file gak ada / gagal)
  let state = 'idle';
  let texture = null;
  let pendingTiles = [];
  let waitFrames = 0;
  let appear = 0;
  const tilePosition = new THREE.Vector2();
  const stats = { decodeMs: null, tiles: 0, maxTileMs: 0, allocateMs: null, tileMs: [] };

  // Tekstur tujuan cuma dialokasikan di GPU (texStorage2D), isinya belum ada (dataReady = false).
  // Isinya diisi tile demi tile lewat copyTextureToTexture (texSubImage2D)
  function allocate(size) {
    texture = new THREE.DataTexture(null, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
    texture.source.dataReady = false;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    texture.anisotropy = anisotropy;
    // initTexture cuma jalan kalau version > 0
    texture.needsUpdate = true;
    renderer.initTexture(texture);
    // Mipmap baru dibuat sekali di tile terakhir, bukan tiap tile
    texture.generateMipmaps = false;
  }

  function uploadNextTile() {
    const tile = pendingTiles.shift();
    const start = performance.now();
    const source = new THREE.Texture(tile.bitmap);
    texture.generateMipmaps = pendingTiles.length === 0;
    renderer.copyTextureToTexture(source, texture, null, tilePosition.set(tile.x, tile.y));
    tile.bitmap.close();
    stats.tiles++;
    const ms = performance.now() - start;
    stats.tileMs.push(+ms.toFixed(1));
    stats.maxTileMs = Math.max(stats.maxTileMs, ms);
    if (pendingTiles.length === 0) {
      material.uniforms.uMap.value = texture;
      state = 'ready';
    }
  }

  function load() {
    if (state !== 'idle') return;
    state = 'loading';
    const worker = new Worker(new URL('../workers/imageWorker.js', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }) => {
      worker.terminate();
      if (data.missing) {
        state = 'missing';
        return;
      }
      stats.decodeMs = data.ms;
      const allocateStart = performance.now();
      allocate(data.size);
      stats.allocateMs = performance.now() - allocateStart;
      pendingTiles = data.tiles;
      waitFrames = ALLOCATE_SETTLE_FRAMES;
      state = 'uploading';
    };
    worker.onerror = (event) => {
      event.preventDefault();
      worker.terminate();
      state = 'missing';
    };
    worker.postMessage({ url: TEXTURE_URL, size: TEXTURE_SIZE, tile: TILE_SIZE });
  }

  const normal = new THREE.Vector3();

  return {
    mesh,
    load,
    stats,
    get state() {
      return state;
    },
    // true kalau lapisannya lagi kelihatan (dipakai buat nampilin kredit)
    get visible() {
      return mesh.visible;
    },
    // alpha 0 sampai 1 dari zoomLevel, delta detik sejak frame sebelumnya
    update(alpha, delta) {
      if (state === 'uploading') {
        if (waitFrames > 0) waitFrames--;
        else {
          uploadNextTile();
          waitFrames = TILE_INTERVAL - 1;
        }
      }
      if (state === 'ready') appear = Math.min(appear + delta / APPEAR_SECONDS, 1);
      const opacity = alpha * appear * appear * (3 - 2 * appear);
      material.uniforms.uOpacity.value = opacity * OPACITY;
      mesh.visible = opacity > 0;
      if (mesh.visible) {
        mesh.updateWorldMatrix(true, false);
        material.uniforms.uNormal.value.copy(normal.set(0, 1, 0).transformDirection(mesh.matrixWorld));
      }
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      texture?.dispose();
      for (const tile of pendingTiles) tile.bitmap.close();
      pendingTiles = [];
    }
  };
}
