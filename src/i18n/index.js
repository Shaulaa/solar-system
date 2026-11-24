import { UI } from './ui.js';

// Bahasa antarmuka: Indonesia (default) atau Inggris
//
// Bahasa dipilih sekali waktu halaman dibuka, semua modul membaca teksnya waktu dibuat. Ganti bahasa
// = simpan pilihan lalu muat ulang halaman (hash tautan ikut terbawa), jadi gak perlu ada modul yang
// menyusun ulang teksnya di tengah jalan. Urutan pilihan:
//   1. ?lang=en atau ?lang=id di alamat (sekalian disimpan)
//   2. pilihan yang tersimpan di localStorage
//   3. Indonesia
// Isi data benda langit versi Inggris ada di content.en.js, digabung lewat localize()

export const LANGUAGES = ['id', 'en'];
const STORAGE_KEY = 'lang';

function readSaved() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    // localStorage bisa dilarang (mode privat lama, iframe pihak ketiga)
    return null;
  }
}

function save(value) {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Gak bisa disimpan: pilihan tetap berlaku lewat ?lang di alamat
  }
}

function detect() {
  const param = new URLSearchParams(location.search).get('lang');
  if (LANGUAGES.includes(param)) {
    save(param);
    return param;
  }
  const saved = readSaved();
  return LANGUAGES.includes(saved) ? saved : 'id';
}

export const lang = detect();
// Locale buat Intl (angka dan tanggal)
export const LOCALE = lang === 'en' ? 'en-US' : 'id-ID';

// Teks antarmuka. params mengisi {nama} di teksnya. Kunci yang belum diterjemahkan jatuh ke versi
// Indonesia, kunci yang gak ada sama sekali dikembalikan apa adanya biar ketahuan waktu dicek
export function t(key, params) {
  const text = UI[lang][key] ?? UI.id[key] ?? key;
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
}

// Ganti bahasa: simpan, lalu muat ulang tanpa ?lang (biar pilihan tersimpan yang dipakai)
export function switchLanguage(next) {
  save(next);
  const url = new URL(location.href);
  url.searchParams.delete('lang');
  // location.replace ke alamat yang cuma beda hash gak memuat ulang, jadi alamatnya diganti dulu baru reload
  history.replaceState(null, '', url);
  location.reload();
}

// Teks statis di index.html. Atribut yang dibaca:
//   data-i18n              textContent
//   data-i18n-html         innerHTML (cuma teks dari kamus sendiri, berisi tautan kredit)
//   data-i18n-aria         aria-label
//   data-i18n-tooltip      data-tooltip
//   data-i18n-placeholder  placeholder
export function applyDocumentText(root = document) {
  document.documentElement.lang = lang;
  document.title = t('app.title');
  const attributes = [
    ['i18nAria', 'aria-label'],
    ['i18nTooltip', 'data-tooltip'],
    ['i18nPlaceholder', 'placeholder']
  ];
  for (const element of root.querySelectorAll('[data-i18n], [data-i18n-html], [data-i18n-aria], [data-i18n-tooltip], [data-i18n-placeholder]')) {
    const { i18n, i18nHtml } = element.dataset;
    if (i18n) element.textContent = t(i18n);
    if (i18nHtml) element.innerHTML = t(i18nHtml);
    for (const [key, attribute] of attributes) {
      if (element.dataset[key]) element.setAttribute(attribute, t(element.dataset[key]));
    }
  }
}

// Gabungkan terjemahan ke objek data (rekursif untuk objek biasa, array dan nilai lain diganti).
// Nama asli disimpan di aliases, jadi nama Indonesia tetap bisa dicari dari versi Inggris
export function localize(item, overrides) {
  if (lang === 'id' || !overrides) return item;
  const merged = mergeDeep(item, overrides);
  if (overrides.name && overrides.name !== item.name) {
    merged.aliases = [...new Set([...(item.aliases ?? []), item.name])];
  }
  return merged;
}

function mergeDeep(base, extra) {
  const result = { ...base };
  for (const [key, value] of Object.entries(extra)) {
    const isPlain = value && typeof value === 'object' && !Array.isArray(value);
    result[key] = isPlain && base[key] && typeof base[key] === 'object' ? mergeDeep(base[key], value) : value;
  }
  return result;
}
