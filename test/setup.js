// Tiruan API browser yang dibaca beberapa modul waktu dimuat. Tes jalan di Node, tanpa DOM
//   location       pilihan bahasa (i18n/index.js), default tanpa ?lang
//   localStorage   pilihan bahasa tersimpan
//   matchMedia     prefers-reduced-motion (utils/motion.js)
//   self           worker memasang self.onmessage waktu dimuat

const store = new Map();

globalThis.location ??= new URL('http://localhost/');
// Node 25 punya localStorage bawaan yang belum lengkap tanpa --localstorage-file, jadi selalu diganti
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  writable: true,
  value: {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear()
  }
});
globalThis.window ??= globalThis;
globalThis.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
globalThis.self ??= globalThis;
