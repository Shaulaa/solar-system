import * as THREE from 'three';

// Satu LoadingManager buat semua tekstur
// Sengaja cuma satu supaya loading screen di fase 4 tinggal dengerin onProgress / onLoad dari sini
export const loadingManager = new THREE.LoadingManager();

const textureLoader = new THREE.TextureLoader(loadingManager);

// BASE_URL dari Vite, biar path tetap benar kalau nanti di-deploy di subfolder (misal GitHub Pages)
const TEXTURE_DIR = `${import.meta.env.BASE_URL}textures/`;

// Muat tekstur dari public/textures
// Kalau filenya gak ada atau gagal di-decode, pakai hasil fallback() (biasanya tekstur prosedural)
// supaya project tetap jalan walau folder textures masih kosong.
// Resolve dengan null kalau gagal dan gak ada fallback.
//
// color: true buat tekstur warna (wajib sRGB). Tekstur data kayak alphaMap biarin linear
export function loadTexture(file, { color = true, fallback } = {}) {
  return new Promise((resolve) => {
    if (!file) {
      resolve(fallback ? fallback() : null);
      return;
    }

    textureLoader.load(
      TEXTURE_DIR + file,
      (texture) => {
        texture.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        // three.js otomatis nge-clamp ke batas maksimal GPU
        texture.anisotropy = 8;
        resolve(texture);
      },
      undefined,
      () => {
        resolve(fallback ? fallback() : null);
      }
    );
  });
}

// Pasang tekstur ke slot material (map, alphaMap, dll) setelah material sudah jadi.
// Tekstur lama di slot itu di-dispose biar gak numpuk di GPU.
// needsUpdate wajib karena nambah map ngubah define shader, jadi program harus di-compile ulang
export function assignTexture(material, slot, texture) {
  if (!texture) return;
  const previous = material[slot];
  if (previous && previous !== texture) previous.dispose();
  material[slot] = texture;
  material.needsUpdate = true;
}
