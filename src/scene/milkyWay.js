import * as THREE from 'three';
import { loadTexture } from '../utils/loader.js';

// Latar Bima Sakti, sphere raksasa yang dilihat dari dalam (BackSide)
// Tambahan di luar PRD, lihat Catatan Keputusan
//
// Radiusnya 2000, lebih jauh dari cangkang bintang (900 sampai 1500 di stars.js),
// jadi bintang kelap kelip selalu ada di depannya. Masih di dalam far plane kamera (5000)
// selama kamera gak lebih jauh dari maxDistance

const TEXTURE = '2k_stars_milky_way.jpg';
const RADIUS = 2000;
const DEG = Math.PI / 180;

// Opacity sengaja rendah biar latar cuma jadi nuansa, gak ngalahin planet dan bintang
const OPACITY = 0.35;
// Tekstur aslinya gelap banget (pita galaksi rata rata cuma sekitar 5 dari 255),
// jadi warnanya dikali dulu. Tanpa ini, setelah opacity 0.35 latarnya praktis hitam
const BRIGHTNESS = 8;

// Tekstur diperkecil ke ukuran ini. 2048 px dibentang ke 360 derajat bikin bintang di tekstur
// jadi kotak buram sekitar 4 px di layar. Setelah diperkecil, titik bintang ikut rata,
// sementara pita galaksi yang lebar tetap ada. Bintang tajam biar diurus stars.js
const SOFT_WIDTH = 512;
const SOFT_HEIGHT = 256;
// Batas atas kecerahan piksel (0 sampai 255). Pita galaksi di bawah angka ini jadi aman,
// sisa bintang terang yang masih nongol setelah diperkecil dipotong biar gak jadi gumpalan
const STAR_CAP = 32;

// Bidang galaksi miring sekitar 60 derajat terhadap bidang ekliptika (bidang orbit planet)
const GALACTIC_TILT = 60 * DEG;
// Arah miringnya dipilih supaya pita galaksi melintang diagonal di belakang matahari
// waktu dilihat dari posisi overview default. Kalau cuma diputar di sumbu X,
// kamera overview malah menghadap kutub galaksi dan pitanya gak kelihatan sama sekali
const GALACTIC_AZIMUTH = -15.4 * DEG;
// Arah pandang kamera overview default (posisi akhir intro di main.js ke titik 0,0,0).
// Pusat galaksi (bagian paling terang) diarahkan ke sini, jadi pas di belakang matahari
const OVERVIEW_DIRECTION = new THREE.Vector3(0, -85, -185).normalize();

// Perkecil + potong bintang terang di canvas, hasilnya tekstur baru.
// Tekstur asli langsung di-dispose karena gak dipakai lagi
function softenTexture(texture) {
  const canvas = document.createElement('canvas');
  canvas.width = SOFT_WIDTH;
  canvas.height = SOFT_HEIGHT;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(texture.image, 0, 0, SOFT_WIDTH, SOFT_HEIGHT);

  const pixels = ctx.getImageData(0, 0, SOFT_WIDTH, SOFT_HEIGHT);
  const data = pixels.data;
  for (let i = 0; i < data.length; i += 4) {
    const peak = Math.max(data[i], data[i + 1], data[i + 2]);
    if (peak > STAR_CAP) {
      // Diskala bareng biar warnanya (kebiruan / kekuningan) gak berubah
      const k = STAR_CAP / peak;
      data[i] *= k;
      data[i + 1] *= k;
      data[i + 2] *= k;
    }
  }
  ctx.putImageData(pixels, 0, 0);
  texture.dispose();

  const soft = new THREE.CanvasTexture(canvas);
  soft.colorSpace = THREE.SRGBColorSpace;
  // Dilihat dari dalam bola, tekstur kebaca kebalik kiri kanan. Di-flip lewat repeat -1
  soft.wrapS = THREE.RepeatWrapping;
  soft.repeat.x = -1;
  return soft;
}

// Putar sphere: sumbu Y lokal (kutub tekstur) jadi normal bidang galaksi,
// sumbu X lokal (tengah tekstur = pusat galaksi) diarahkan sedekat mungkin ke OVERVIEW_DIRECTION
function galacticOrientation() {
  const normal = new THREE.Vector3(
    Math.sin(GALACTIC_TILT) * Math.cos(GALACTIC_AZIMUTH),
    Math.cos(GALACTIC_TILT),
    Math.sin(GALACTIC_TILT) * Math.sin(GALACTIC_AZIMUTH)
  );
  const center = OVERVIEW_DIRECTION.clone()
    .addScaledVector(normal, -normal.dot(OVERVIEW_DIRECTION))
    .normalize();
  const side = new THREE.Vector3().crossVectors(center, normal);
  const basis = new THREE.Matrix4().makeBasis(center, normal, side);
  return new THREE.Quaternion().setFromRotationMatrix(basis);
}

export function createMilkyWay() {
  const material = new THREE.MeshBasicMaterial({
    color: new THREE.Color().setScalar(BRIGHTNESS),
    side: THREE.BackSide,
    transparent: true,
    opacity: OPACITY,
    depthWrite: false,
    // Latar gak boleh ikut kabut kalau nanti scene dikasih fog
    fog: false
  });

  const mesh = new THREE.Mesh(new THREE.SphereGeometry(RADIUS, 64, 32), material);
  mesh.name = 'milky-way';
  mesh.quaternion.copy(galacticOrientation());
  // Digambar paling awal biar semua objek lain (termasuk bintang additive) numpuk di atasnya
  mesh.renderOrder = -1;
  // Disembunyikan sampai tekstur siap. Kalau file gak ada, latar tetap warna polos kayak sebelumnya
  mesh.visible = false;

  loadTexture(TEXTURE).then((texture) => {
    if (!texture) return;
    material.map = softenTexture(texture);
    material.needsUpdate = true;
    mesh.visible = true;
  });

  return { mesh };
}
