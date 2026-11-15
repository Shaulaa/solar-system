import { STAGES, fadeBetween } from '../galaxy/zoomLevels.js';

// Memudarkan isi tata surya waktu zoom keluar, semua dihitung dari zoomLevel
// (rentangnya di galaxy/zoomLevels.js)
//
//   orbit, label, planet, bulan, sabuk asteroid   memudar ke 0
//   bola Matahari                                 diganti titik bintang yang ukurannya tetap di layar
//   bintang kelap kelip dan sphere Bima Sakti     memudar, nanti digantikan isi galaxyScene

// Opacity semua material di bawah beberapa objek sekaligus.
// Material bawaan pakai material.opacity (dikali opacity aslinya), ShaderMaterial custom pakai
// uniform uOpacity. Material yang aslinya opaque baru dijadikan transparan selama memudar,
// biar urutan gambar di tampilan normal gak berubah. Objeknya disembunyikan kalau sudah 0
function createMaterialFade(roots) {
  const entries = [];
  const seen = new Set();
  for (const root of roots) {
    root.traverse((object) => {
      const material = object.material;
      if (!material || seen.has(material)) return;
      seen.add(material);
      entries.push({
        material,
        opacity: material.opacity,
        transparent: material.transparent,
        uniform: material.uniforms?.uOpacity ?? null
      });
    });
  }

  let current = 1;

  return function setOpacity(alpha) {
    if (alpha === current) return;
    current = alpha;
    for (const entry of entries) {
      const { material } = entry;
      if (entry.uniform) entry.uniform.value = alpha;
      else material.opacity = entry.opacity * alpha;
      const transparent = entry.transparent || alpha < 1;
      if (material.transparent !== transparent) {
        material.transparent = transparent;
        // Material bawaan three.js nge-compile versi opaque dan transparan secara terpisah
        material.needsUpdate = true;
      }
    }
    for (const root of roots) root.visible = alpha > 0;
  };
}

export function createSolarFade({ sun, planets, asteroidBelt, orbits, labels, stars, milkyWay }) {
  // Material dikumpulkan sekali di awal. Tekstur yang datang belakangan dipasang ke material
  // yang sama, jadi gak ada material baru yang kelewat
  const fadeBodies = createMaterialFade([planets.group, asteroidBelt.mesh]);

  const last = { solar: 1, backdrop: 1, sunBody: 1, sunStar: 0 };

  return {
    update(zoomLevel) {
      const { solarFade, backdropFade, sunBodyOut, sunStarIn, sunStarOut } = STAGES;
      const solar = 1 - fadeBetween(zoomLevel, solarFade.start, solarFade.end);
      const backdrop = 1 - fadeBetween(zoomLevel, backdropFade.start, backdropFade.end);
      const sunBody = 1 - fadeBetween(zoomLevel, sunBodyOut.start, sunBodyOut.end);
      const sunStar =
        fadeBetween(zoomLevel, sunStarIn.start, sunStarIn.end) *
        (1 - fadeBetween(zoomLevel, sunStarOut.start, sunStarOut.end));

      // Cuma ditulis kalau berubah, di tampilan tata surya biasa semuanya diam di 1
      if (solar !== last.solar) {
        last.solar = solar;
        fadeBodies(solar);
        orbits.setOpacity(solar);
        labels.setFade(solar);
      }
      if (backdrop !== last.backdrop) {
        last.backdrop = backdrop;
        stars.setOpacity(backdrop);
        milkyWay.setOpacity(backdrop);
      }
      if (sunBody !== last.sunBody || sunStar !== last.sunStar) {
        last.sunBody = sunBody;
        last.sunStar = sunStar;
        sun.setFade({ body: sunBody, star: sunStar });
      }
    }
  };
}
