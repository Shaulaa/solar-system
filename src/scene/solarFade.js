import { STAGES, fadeBetween } from '../galaxy/zoomLevels.js';

// Memudarkan isi tata surya waktu zoom keluar, semua dihitung dari zoomLevel
// (rentangnya di galaxy/zoomLevels.js)
//
//   orbit, label, planet, bulan, sabuk asteroid   memudar ke 0
//   bola Matahari                                 diganti titik bintang yang ukurannya tetap di layar
//   bintang kelap kelip dan sphere Bima Sakti     memudar, nanti digantikan isi galaxyScene

// Memudarkan semua material di bawah beberapa objek sekaligus, TANPA pernah mengubah
// material.transparent. Three.js nge-compile versi opaque dan transparan sebagai shader terpisah,
// dan kalau versi itu belum ada di cache shader GPU, kompilasinya memblokir halaman sekitar 100 ms
// (terukur di zoomLevel 2,0 dan 2,58). Jadi:
//   material transparan (awan, cincin, atmosfer)   opacity dikali alpha
//   material opaque bawaan (planet, bulan, batu)   warna dikali alpha, memudar ke hitam
//   ShaderMaterial custom                          uniform uOpacity (shader-nya yang ngatur)
// Di latar hitam memudar ke hitam kelihatan sama dengan jadi transparan. Objeknya disembunyikan di 0
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
        uniform: material.uniforms?.uOpacity ?? null,
        // Warna asli disalin waktu mulai memudar, bukan sekarang: tekstur planet yang selesai dimuat
        // ngubah warna dasar material jadi putih
        color: !material.transparent && material.color ? material.color.clone() : null
      });
    });
  }

  let current = 1;

  return function setOpacity(alpha) {
    if (alpha === current) return;
    const starting = current === 1;
    current = alpha;
    for (const entry of entries) {
      const { material } = entry;
      if (entry.uniform) {
        entry.uniform.value = alpha;
      } else if (entry.color) {
        if (starting) entry.color.copy(material.color);
        material.color.copy(entry.color).multiplyScalar(alpha);
      } else {
        material.opacity = entry.opacity * alpha;
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
