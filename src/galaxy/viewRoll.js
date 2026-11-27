import { Vector3 } from 'three';

// Tanda arah "atas" kamera galaksi di tahap Grup Lokal (galaxy/galaxyScene.js)
//
// Di tahap itu kamera diputar di sumbu pandangnya supaya sumbu panjang Grup Lokal sejajar sisi layar
// yang panjang. Garis sumbu itu punya dua arah yang sama sahnya (atas dan bawah layar). Dulu arahnya
// dipilih tiap frame yang paling searah dengan kutub utara galaksi, jadi begitu user memutar kamera dan
// dot-nya lewat nol, layar langsung berputar 180 derajat dalam satu frame. Sekarang arah acuan cuma
// dipakai sekali waktu masuk tahap Grup Lokal (previous = null), frame berikutnya ikut arah frame
// sebelumnya, jadi putarannya selalu nyambung
//
//   candidate   calon arah atas (THREE.Vector3, satuan), diubah di tempat dan dikembalikan
//   previous    arah atas frame sebelumnya, atau null
//   reference   arah acuan pertama kali (kutub utara galaksi dicampur arah atas dunia)
export function alignRoll(candidate, previous, reference) {
  const toward = previous ?? reference;
  if (candidate.dot(toward) < 0) candidate.negate();
  return candidate;
}

const a = new Vector3();
const b = new Vector3();
const cross = new Vector3();

// Arah atas di antara from (t = 0) dan to (t = 1), diputar di sumbu pandang `axis` (satuan), ditulis ke
// target. Dipakai selama peralihan ke tahap Grup Lokal. Campuran lerp biasa gagal kalau dua arahnya
// berlawanan (bisa terjadi sejak alignRoll ikut arah frame sebelumnya): di tengah jalan vektornya nol
// dan kamera loncat. Putaran sudut selalu berpanjang 1
export function blendRoll(from, to, t, axis, target) {
  a.copy(from).addScaledVector(axis, -from.dot(axis));
  b.copy(to).addScaledVector(axis, -to.dot(axis));
  if (a.lengthSq() < 1e-12 || b.lengthSq() < 1e-12) return target.copy(t < 0.5 ? from : to).normalize();
  a.normalize();
  b.normalize();
  const angle = Math.atan2(cross.crossVectors(a, b).dot(axis), a.dot(b));
  return target.copy(a).applyAxisAngle(axis, angle * t);
}

// Sinus sudut arah pandang ke acuan atas. Di bawah ROLL_LOCK (1,5 derajat) acuannya gak bisa menentukan
// putaran kamera dan putaran frame sebelumnya dipertahankan penuh, di atas ROLL_FREE (10 derajat) acuan
// dipakai penuh, di antaranya dicampur halus
const ROLL_LOCK = Math.sin((1.5 * Math.PI) / 180);
const ROLL_FREE = Math.sin((10 * Math.PI) / 180);
const desiredFlat = new Vector3();
const previousFlat = new Vector3();

// Arah atas kamera yang aman buat lookAt, ditulis ke target. Kalau kamera melihat hampir sepanjang acuan
// atasnya (misal setelah user memutar kamera galaksi sampai tampak tegak lurus dari kutub, lalu zoom masuk),
// proyeksi acuan ke bidang layar tinggal vektor sangat pendek yang arahnya berputar cepat: kamera berayun
// puluhan derajat per frame walaupun arah pandangnya hampir diam. Jadi kamera mulai dari arah atasnya di
// frame sebelumnya dan cuma boleh berputar ke arah acuan paling banyak maxStep per panggilan, dikali
// seberapa jelas acuannya (0 di dekat kutub, 1 jauh darinya). Setelah lewat kutub acuannya berbalik, dan
// kamera kembali ke sana dengan putaran tenang, bukan sentakan
//
//   desired    acuan atas (satuan)
//   previous   arah atas kamera di frame sebelumnya (satuan)
//   view       arah pandang kamera (satuan)
//   maxStep    putaran paling besar per panggilan (radian), Infinity = langsung ke acuan
export function stabilizeRoll(desired, previous, view, target, maxStep = Infinity) {
  desiredFlat.copy(desired).addScaledVector(view, -desired.dot(view));
  const strength = desiredFlat.length();
  previousFlat.copy(previous).addScaledVector(view, -previous.dot(view));
  if (previousFlat.lengthSq() < 1e-12) return target.copy(desiredFlat).normalize();
  previousFlat.normalize();
  if (strength < 1e-9) return target.copy(previousFlat);
  desiredFlat.normalize();
  const t = Math.min(Math.max((strength - ROLL_LOCK) / (ROLL_FREE - ROLL_LOCK), 0), 1);
  const allowed = maxStep * t * t * (3 - 2 * t);
  const angle = Math.atan2(cross.crossVectors(previousFlat, desiredFlat).dot(view), previousFlat.dot(desiredFlat));
  if (Math.abs(angle) <= allowed) return target.copy(desiredFlat);
  return target.copy(previousFlat).applyAxisAngle(view, Math.sign(angle) * allowed);
}
