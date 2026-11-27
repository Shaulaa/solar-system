// Keadaan simulasi yang dibawa melewati muat ulang waktu ganti bahasa
//
// Ganti bahasa memuat ulang halaman (i18n/index.js): semua modul membaca teks bahasanya waktu dibuat,
// jadi menyusun ulang teks di tengah jalan butuh hampir semua modul diubah. Gantinya, keadaan yang
// dipilih user (tanggal, kecepatan, tampilan, mode skala, posisi kamera) disimpan di sessionStorage
// tepat sebelum reload, lalu dipakai sekali dan dihapus waktu halaman dimuat lagi. Benda yang lagi
// difokus sudah ikut lewat hash alamat (app/deepLink.js).
//
// Umurnya dibatasi: browser bisa memulihkan sessionStorage waktu tab yang ditutup dibuka lagi, dan
// itu gak boleh tiba tiba balik ke keadaan lama. Isinya dicek satu per satu sebelum dipakai, field
// yang rusak diganti nilai bawaan

const KEY = 'solar-session';
const MAX_AGE_MS = 60_000;
// Batas nilai Date di JavaScript (milidetik dari 1970)
const MAX_TIME = 8.64e15;

const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);
const isVector = (value) => Array.isArray(value) && value.length === 3 && value.every(isNumber);

// Teks JSON dari sessionStorage ke keadaan yang aman dipakai main.js, atau null kalau gak bisa dipakai
export function parseSession(raw, now = Date.now()) {
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object' || !isNumber(data.savedAt)) return null;
  // Kedaluwarsa, atau jam perangkat mundur jauh sejak disimpan
  if (now - data.savedAt > MAX_AGE_MS || data.savedAt - now > MAX_AGE_MS) return null;
  if (!isNumber(data.moment) || Math.abs(data.moment) > MAX_TIME) return null;

  const camera = data.camera;
  return {
    moment: data.moment,
    paused: data.paused === true,
    speedIndex: Number.isInteger(data.speedIndex) ? data.speedIndex : null,
    reversed: data.reversed === true,
    orbits: data.orbits !== false,
    labels: data.labels !== false,
    scale: data.scale === 'real' ? 'real' : 'pretty',
    camera: camera && isVector(camera.position) && isVector(camera.target) ? { position: camera.position, target: camera.target } : null,
    zoomOffset: isNumber(data.zoomOffset) && data.zoomOffset > 0 ? data.zoomOffset : 0
  };
}

export function saveSession(state) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ ...state, savedAt: Date.now() }));
  } catch {
    // sessionStorage dilarang / penuh: ganti bahasa tetap jalan, cuma keadaannya mulai dari awal
  }
}

// Ambil sekali lalu hapus, biar reload biasa berikutnya mulai dari awal lagi
export function takeSession() {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw === null) return null;
    sessionStorage.removeItem(KEY);
    return parseSession(raw);
  } catch {
    return null;
  }
}
